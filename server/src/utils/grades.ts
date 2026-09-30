/** Tutors record grades taught as 'Grade 1'..'Grade 12'; High School curricula use one grade, 'High School'. */
export const HIGH_SCHOOL_GRADE = 'High School';
export const HIGH_SCHOOL_TUTOR_GRADES = ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

/** Curriculum grades a tutor with these gradesTaught matches (adds 'High School' when they teach any of 9-12). */
export function curriculumGradesForTutor(gradesTaught: string[]): string[] {
  return gradesTaught.some((g) => HIGH_SCHOOL_TUTOR_GRADES.includes(g))
    ? [...gradesTaught, HIGH_SCHOOL_GRADE]
    : gradesTaught;
}

/** Tutor gradesTaught values that qualify a tutor for a curriculum of this grade. */
export function tutorGradesForCurriculum(grade: string): string[] {
  return grade === HIGH_SCHOOL_GRADE ? HIGH_SCHOOL_TUTOR_GRADES : [grade];
}
