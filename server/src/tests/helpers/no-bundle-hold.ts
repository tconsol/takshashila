import { CourseModel } from '../../modules/courses/course.model';
import { ProgramEnrollmentModel } from '../../modules/programs/program.model';

/** Booking tests that predate held courses have none; keep those two lookups off a real database. */
export function mockNoBundleHold(): void {
  const none = {
    session: () => Promise.resolve([]),
    then: (res: (v: unknown[]) => unknown) => Promise.resolve([]).then(res),
  };
  jest.spyOn(CourseModel, 'aggregate').mockReturnValue(none as never);
  jest.spyOn(ProgramEnrollmentModel, 'aggregate').mockReturnValue(none as never);
}
