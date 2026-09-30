import type { DocxParagraph } from './docx-reader';

export interface ParsedChapter { title: string; topics: string[] }
export interface ParsedSubject { name: string; courseName?: string; note?: string; notVerified: boolean; chapters: ParsedChapter[] }
export type GradeLevel = 'KINDERGARTEN' | 'GRADE' | 'HIGH_SCHOOL';
/** Grades 9-12 keep their own label ('Grade 10') with level HIGH_SCHOOL; the importer merges them into courses. */
export interface ParsedGrade { grade: string; level: GradeLevel; subjects: ParsedSubject[] }
export interface ParsedDoc {
  grades: ParsedGrade[];
  countyParagraphs: DocxParagraph[];
  sourceParagraphs: DocxParagraph[];
}

const headingLevel = (style: string): number => {
  const m = /^heading\s*(\d)$/i.exec(style.trim());
  return m ? Number(m[1]) : 0;
};

/** Grade H1s may carry a state prefix ("Colorado - Grade 7"), so match the end of the text. */
function matchGrade(text: string): { label: string; level: GradeLevel } | null {
  if (/kindergarten\s*$/i.test(text)) return { label: 'Kindergarten', level: 'KINDERGARTEN' };
  const m = /\bgrade\s+(\d{1,2})\s*$/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  return { label: `Grade ${n}`, level: n >= 9 ? 'HIGH_SCHOOL' : 'GRADE' };
}

/** "Science (Biology (High School Life Science))" -> name "Science", course "Biology (High School Life Science)".
 *  Splits only when the heading ends with the bracket group opened by its first "(" (so nested parens stay in the course). */
export function splitSubjectHeading(text: string): { name: string; courseName?: string } {
  const t = text.trim();
  const open = t.indexOf('(');
  if (open <= 0 || !t.endsWith(')')) return { name: t };
  let depth = 0;
  for (let i = open; i < t.length; i++) {
    if (t[i] === '(') depth++;
    else if (t[i] === ')' && --depth === 0) {
      if (i !== t.length - 1) return { name: t };
      const name = t.slice(0, open).trim();
      const courseName = t.slice(open + 1, i).trim();
      return name && courseName ? { name, courseName } : { name: t };
    }
  }
  return { name: t };
}

export function parseCurriculumDoc(paras: DocxParagraph[]): ParsedDoc {
  const doc: ParsedDoc = { grades: [], countyParagraphs: [], sourceParagraphs: [] };
  // 'ignored' = front matter before the first H1, or an unrecognised H1 section
  let section: 'grades' | 'county' | 'sources' | 'ignored' = 'ignored';
  let grade: ParsedGrade | null = null;
  let subject: ParsedSubject | null = null;
  let chapter: ParsedChapter | null = null;
  let noteParts: string[] = [];

  const finishNote = () => {
    if (subject && noteParts.length) {
      subject.note = noteParts.join(' ');
      subject.notVerified = /^not verified/i.test(subject.note);
    }
    noteParts = [];
  };

  for (const para of paras) {
    const level = headingLevel(para.style);
    const text = para.text;

    if (level === 1) {
      finishNote();
      subject = null;
      chapter = null;
      grade = null;
      const g = matchGrade(text);
      if (/^county additions/i.test(text)) { section = 'county'; }
      else if (/^sources and verification/i.test(text)) { section = 'sources'; }
      else if (g) {
        section = 'grades';
        grade = { grade: g.label, level: g.level, subjects: [] };
        doc.grades.push(grade);
      } else section = 'ignored';
      continue;
    }

    if (section === 'county') { doc.countyParagraphs.push(para); continue; }
    if (section === 'sources') { doc.sourceParagraphs.push(para); continue; }
    if (section !== 'grades' || !grade) continue;

    if (level === 2) {
      finishNote();
      chapter = null;
      const { name, courseName } = splitSubjectHeading(text);
      subject = { name, ...(courseName ? { courseName } : {}), notVerified: false, chapters: [] };
      grade.subjects.push(subject);
    } else if (level === 3) {
      if (!subject) continue;
      finishNote();
      chapter = { title: text, topics: [] };
      subject.chapters.push(chapter);
    } else if (chapter) chapter.topics.push(text);
    else if (subject) noteParts.push(text);
  }
  finishNote();
  return doc;
}
