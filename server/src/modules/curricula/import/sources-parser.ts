import type { DocxParagraph } from './docx-reader';

export interface SourceRef { name: string; year: number | null; url: string }
export interface ParsedSources { bySubject: Map<string, SourceRef>; stateWide: SourceRef | null; notes: string[] }

const URL_RE = /https?:\/\/\S+/;
const YEAR_RE = /\b(19|20)\d{2}\b/;

const headingLevel = (style: string): number => {
  const m = /^heading\s*(\d)$/i.exec(style.trim());
  return m ? Number(m[1]) : 0;
};

/** Lower-case, "&" -> "and", punctuation -> single spaces. */
const norm = (s: string): string =>
  s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

// Wording variants found in the source documents -> one canonical subject name.
const ALIASES: Record<string, string> = {
  'ela': 'english language arts',
  'english': 'english language arts',
  'english language arts and literacy': 'english language arts',
  'math': 'mathematics',
  'maths': 'mathematics',
  'health': 'health education',
  'pe': 'physical education',
  'phys ed': 'physical education',
  'theater': 'theatre',
  'theatre arts': 'theatre',
  'drama': 'theatre',
  'cs': 'computer science',
  'visual art': 'visual arts',
  'media art': 'media arts',
};
const KNOWN_SUBJECTS = new Set([
  'english language arts', 'mathematics', 'science', 'social studies', 'health education', 'physical education',
  'visual arts', 'music', 'dance', 'theatre', 'media arts', 'computer science',
]);
const canon = (s: string): string => {
  const n = norm(s);
  return ALIASES[n] ?? n;
};

const stripParen = (s: string): string => s.replace(/\s*\([^)]*\)\s*$/, '').trim();

/**
 * Builds a SourceRef from citation text (already without any "Subject:" prefix).
 * With a URL: name = text before the URL, minus trailing "-"/":" separators and a trailing "(year)" / "(None)"
 * group (the year the document assigns). Parentheses inside the name are kept.
 * Without a URL (Georgia layout): name = text up to the first "): " (or the whole text), url = ''.
 */
function buildRef(text: string, url: string | null, before: string): SourceRef {
  if (url) {
    let name = before.replace(/[\s\-–—:]+$/, '');
    let year: number | null = null;
    const tail = /\s*\((\d{4}|None)\)$/i.exec(name);
    if (tail) {
      year = /^none$/i.test(tail[1]) ? null : Number(tail[1]);
      name = name.slice(0, tail.index);
    } else {
      const y = YEAR_RE.exec(name);
      year = y ? Number(y[0]) : null;
    }
    return { name: name.trim(), year, url };
  }
  const cut = /^(.*?\))\s*:\s/.exec(text);
  const name = (cut ? cut[1] : text).trim();
  const y = YEAR_RE.exec(name);
  return { name, year: y ? Number(y[0]) : null, url: '' };
}

export function parseSources(paras: DocxParagraph[]): ParsedSources {
  const out: ParsedSources = { bySubject: new Map(), stateWide: null, notes: [] };
  const seen = new Set<string>(); // canonical subject names already holding a citation (first wins)

  // Current H3 group: are its paragraphs citations, and which subject does its title imply?
  let group: { title: string; isSource: boolean; subject: string | null } = { title: '', isSource: false, subject: null };
  let sawHeading = false;

  const addSubject = (label: string, ref: SourceRef) => {
    const c = canon(label);
    if (seen.has(c)) return;
    seen.add(c);
    out.bySubject.set(label, ref);
  };

  for (const para of paras) {
    const text = para.text.trim();
    if (headingLevel(para.style) >= 2) {
      sawHeading = true;
      const m = /^(?:standards|sources)\s+used(?:\s+for\s+(.+))?$/i.exec(text);
      if (m) {
        const subj = m[1] ? stripParen(m[1]) : '';
        // "Sources Used for Georgia" names a state, not a subject: those citations are state-wide.
        group = { title: text, isSource: true, subject: subj && KNOWN_SUBJECTS.has(canon(subj)) ? subj : null };
      } else group = { title: stripParen(text), isSource: false, subject: null };
      continue;
    }
    if (!text) continue;

    const urlMatch = URL_RE.exec(text);
    const isCitation = group.isSource || (!sawHeading && !!urlMatch);
    if (!isCitation) {
      out.notes.push(!group.title || /^notes$/i.test(group.title) ? text : `${group.title}: ${text}`);
      continue;
    }

    const url = urlMatch ? urlMatch[0].replace(/[.,;)]+$/, '') : null;
    const before = urlMatch ? text.slice(0, urlMatch.index) : text;
    const pre = /^([^:]{1,40}?):\s+(\S[\s\S]*)$/.exec(before);
    let subjects: string[] = group.subject ? [group.subject] : [];
    let rest = before;
    let full = text;
    if (pre && !URL_RE.test(pre[1])) {
      subjects = pre[1].split('/').map(s => s.trim()).filter(Boolean);
      rest = pre[2];
      full = text.slice(text.indexOf(pre[2]));
    }
    const ref = buildRef(full, url, rest);
    if (!subjects.length) { if (!out.stateWide) out.stateWide = ref; }
    else for (const s of subjects) addSubject(s, ref);
  }
  return out;
}

/**
 * Finds the citation for a subject: case/punctuation-insensitive, alias-aware (ELA, Math, PE, ...),
 * exact match first, then "starts with" on a word boundary in either direction
 * ("English Language Arts and Literacy" ~ "English Language Arts"). Falls back to the state-wide citation.
 */
export function pickSource(sources: ParsedSources, subjectName: string): SourceRef | null {
  const want = canon(subjectName);
  const keys = [...sources.bySubject.keys()].map(k => ({ k, c: canon(k) }));
  const exact = keys.find(e => e.c === want);
  if (exact) return sources.bySubject.get(exact.k)!;
  const prefix = keys.find(e => e.c.startsWith(want + ' ') || want.startsWith(e.c + ' '));
  if (prefix) return sources.bySubject.get(prefix.k)!;
  return sources.stateWide;
}
