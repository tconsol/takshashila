export const GRADE_LIST = [
  'Kindergarten',
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4',
  'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8',
  'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
] as const;

export type Grade = (typeof GRADE_LIST)[number];

export const GRADE_OPTIONS = GRADE_LIST.map((g) => ({ value: g, label: g }));

/** Imported high school curricula are organised by course under this grade value, not per grade. */
export const HIGH_SCHOOL = 'High School';
export const isHighSchoolGrade = (grade?: string | null) =>
  grade === 'Grade 9' || grade === 'Grade 10' || grade === 'Grade 11' || grade === 'Grade 12';
