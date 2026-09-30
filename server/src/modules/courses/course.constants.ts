/**
 * Every class in a course is exactly this long. A course is priced as
 * `tutor hourly rate × classesRequired`, so the price of a class never depends
 * on how long it happens to run.
 */
export const COURSE_CLASS_MINUTES = 60;

/** True when [start, end) is exactly one course class long. */
export function isCourseClassLength(start: Date, end: Date): boolean {
  return end.getTime() - start.getTime() === COURSE_CLASS_MINUTES * 60_000;
}
