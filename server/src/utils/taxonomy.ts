/**
 * Subjects and languages are typed free-hand by tutors, so the same thing
 * arrives spelled a dozen ways: "maths", "MATHS ", "Mathematics", "math".
 * Left alone, search and analytics fracture across those variants.
 *
 * Normalising on write gives one canonical spelling per concept while still
 * letting a tutor type whatever they call it.
 */

/** Common aliases folded onto one canonical name. Extend as real data shows up. */
const SUBJECT_ALIASES: Record<string, string> = {
  math: 'Mathematics',
  maths: 'Mathematics',
  mathematic: 'Mathematics',
  mathematics: 'Mathematics',
  bio: 'Biology',
  biology: 'Biology',
  chem: 'Chemistry',
  chemistry: 'Chemistry',
  phy: 'Physics',
  physics: 'Physics',
  'computer science': 'Computer Science',
  cs: 'Computer Science',
  compsci: 'Computer Science',
  it: 'Information Technology',
  'social studies': 'Social Studies',
  sst: 'Social Studies',
  eng: 'English',
  english: 'English',
  evs: 'Environmental Science',
  'environmental science': 'Environmental Science',
  'gen knowledge': 'General Knowledge',
  gk: 'General Knowledge',
};

const LANGUAGE_ALIASES: Record<string, string> = {
  eng: 'English',
  english: 'English',
  hin: 'Hindi',
  hindi: 'Hindi',
  tel: 'Telugu',
  telugu: 'Telugu',
  tam: 'Tamil',
  tamil: 'Tamil',
  kan: 'Kannada',
  kannada: 'Kannada',
  mal: 'Malayalam',
  malayalam: 'Malayalam',
  mar: 'Marathi',
  marathi: 'Marathi',
  ben: 'Bengali',
  bengali: 'Bengali',
  guj: 'Gujarati',
  gujarati: 'Gujarati',
  urdu: 'Urdu',
  punjabi: 'Punjabi',
  odia: 'Odia',
  sanskrit: 'Sanskrit',
  french: 'French',
  german: 'German',
  spanish: 'Spanish',
};

/** Words that stay lowercase inside a name unless they lead it. */
const MINOR_WORDS = new Set(['and', 'of', 'the', 'for', 'in', 'to']);

/** Collapse whitespace, strip stray punctuation, lowercase — the lookup key. */
function toKey(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[._/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Title Case, preserving minor words and any all-caps acronym the user typed. */
function titleCase(key: string, original: string): string {
  const originalWords = original.trim().split(/\s+/);

  return key
    .split(' ')
    .map((word, i) => {
      // "IB", "CBSE", "ICSE" and friends should not become "Ib".
      const source = originalWords[i];
      if (source && source.length <= 5 && source === source.toUpperCase() && /[A-Z]/.test(source)) {
        return source;
      }
      if (i > 0 && MINOR_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function normalizeWith(aliases: Record<string, string>, raw: string): string {
  const key = toKey(raw);
  if (!key) return '';
  return aliases[key] ?? titleCase(key, raw);
}

export function normalizeSubject(raw: string): string {
  return normalizeWith(SUBJECT_ALIASES, raw);
}

export function normalizeLanguage(raw: string): string {
  return normalizeWith(LANGUAGE_ALIASES, raw);
}

/** Normalises a list, drops blanks, and de-duplicates case-insensitively. */
function normalizeList(fn: (raw: string) => string, values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = fn(String(value ?? ''));
    if (!normalized) continue;
    const dedupeKey = normalized.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(normalized);
  }
  return out;
}

export const normalizeSubjects = (values: string[]): string[] => normalizeList(normalizeSubject, values);
export const normalizeLanguages = (values: string[]): string[] => normalizeList(normalizeLanguage, values);

/** Canonical names offered as suggestions in the UI. */
export const SUGGESTED_SUBJECTS = [...new Set(Object.values(SUBJECT_ALIASES))].sort();
export const SUGGESTED_LANGUAGES = [...new Set(Object.values(LANGUAGE_ALIASES))].sort();
