/**
 * The curriculum files spell the same subject many ways ("English Language Arts / Literacy",
 * "Language Arts", "History–Social Science" ...). Tutors, the admin dropdown and the student
 * catalog all match on subject text, so the importer folds each variant onto one standard name.
 * The Word files are not changed. Names that match no rule are kept as written and listed in the
 * import preview so they can be added here.
 */

export interface CanonicalSubject {
  name: string;
  /** The name matched a rule (it may still equal the original). False means "kept as written". */
  mapped: boolean;
  /** Not a subject at all: a "Grade / Course Emphasis" or "Additional ..." block. */
  notSubject: boolean;
}

const plain = (s: string): string =>
  s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

/** First match wins, so the specific rules sit above the general ones. */
const RULES: Array<[RegExp, string]> = [
  [/^(english language (development|proficiency)|eld|english learner)|multilingual/, 'English Language Development'],
  [/^(english language arts|language arts|ela)\b/, 'English Language Arts'],
  [/^(mathematics|math)\b/, 'Mathematics'],
  [/computer science/, 'Computer Science'],
  [/^science\b/, 'Science'],
  [/^(social stud|social scien|history)/, 'Social Studies'],
  [/^(?=.*\bhealth\b)(?=.*(\bphysical\b|\bpe\b))/, 'Health and Physical Education'],
  [/^physical education/, 'Physical Education'],
  [/^health/, 'Health Education'],
  [/^visual arts?$/, 'Visual Arts'],
  [/^music$/, 'Music'],
  [/^dance/, 'Dance'],
  [/^(theatre|theater)/, 'Theatre'],
  [/^media arts/, 'Media Arts'],
  [/^(fine arts|the arts|arts\b|visual and performing|visual performing|visual arts )/, 'Fine Arts'],
  [/world languages/, 'World Languages'],
  [/^career (and )?(technical|tech)/, 'Career and Technical Education'],
  [/financial|personal finance/, 'Financial Literacy'],
  [/library|information literacy/, 'Library Media'],
];

export function canonicalSubject(raw: string): CanonicalSubject {
  const text = plain(raw);
  if (/\bemphasis\b/.test(text) || /^additional\b/.test(text)) return { name: raw, mapped: false, notSubject: true };
  for (const [re, name] of RULES) if (re.test(text)) return { name, mapped: true, notSubject: false };
  return { name: raw, mapped: false, notSubject: false };
}
