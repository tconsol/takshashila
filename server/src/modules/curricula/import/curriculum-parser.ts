import type { DocxParagraph } from './docx-reader';

export interface ParsedChapter { title: string; topics: string[] }
export interface ParsedSubject { name: string; courseName?: string; note?: string; notVerified: boolean; chapters: ParsedChapter[] }
export interface ParsedGrade { grade: string; level: 'KINDERGARTEN' | 'GRADE'; subjects: ParsedSubject[] }
export interface ParsedDoc {
  grades: ParsedGrade[];
  skippedHighSchoolGrades: string[];
  countyParagraphs: DocxParagraph[];
  sourceParagraphs: DocxParagraph[];
}

const headingLevel = (style: string): number => {
  const m = /^heading\s*(\d)$/i.exec(style.trim());
  return m ? Number(m[1]) : 0;
};

/** Grade H1s may carry a state prefix ("Colorado - Grade 7"), so match the end of the text. */
function matchGrade(text: string): { label: string; level: 'KINDERGARTEN' | 'GRADE'; n: number } | null {
  if (/kindergarten\s*$/i.test(text)) return { label: 'Kindergarten', level: 'KINDERGARTEN', n: 0 };
  const m = /\bgrade\s+(\d{1,2})\s*$/i.exec(text);
  return m ? { label: `Grade ${Number(m[1])}`, level: 'GRADE', n: Number(m[1]) } : null;
}

export function parseCurriculumDoc(paras: DocxParagraph[]): ParsedDoc {
  const doc: ParsedDoc = { grades: [], skippedHighSchoolGrades: [], countyParagraphs: [], sourceParagraphs: [] };
  // 'ignored' = front matter before the first H1, or an unrecognised H1 section
  let section: 'grades' | 'county' | 'sources' | 'ignored' = 'ignored';
  let skipGrade = false;
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
        if (g.n >= 9) { skipGrade = true; doc.skippedHighSchoolGrades.push(g.label); }
        else { skipGrade = false; grade = { grade: g.label, level: g.level, subjects: [] }; doc.grades.push(grade); }
      } else section = 'ignored';
      continue;
    }

    if (section === 'county') { doc.countyParagraphs.push(para); continue; }
    if (section === 'sources') { doc.sourceParagraphs.push(para); continue; }
    if (section !== 'grades' || skipGrade || !grade) continue;

    if (level === 2) {
      finishNote();
      chapter = null;
      const m = /^(.*?)\s*\((.+)\)\s*$/.exec(text);
      subject = { name: m ? m[1] : text, ...(m ? { courseName: m[2] } : {}), notVerified: false, chapters: [] };
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
