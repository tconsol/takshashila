/* Every course class is exactly COURSE_CLASS_MINUTES long: at first scheduling and on reschedule. */
import { courseService } from '../../modules/courses/course.service';
import { CourseModel } from '../../modules/courses/course.model';
import { CourseStatus } from '../../modules/courses/course.types';
import { COURSE_CLASS_MINUTES, isCourseClassLength } from '../../modules/courses/course.constants';
import { classService } from '../../modules/classes/class.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { ClassStatus } from '../../modules/schedules/schedule.types';
import { tutorService } from '../../modules/tutors/tutor.service';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const MIN = 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

describe('isCourseClassLength', () => {
  it('accepts exactly 60 minutes only', () => {
    const s = new Date('2026-10-01T10:00:00.000Z');
    expect(COURSE_CLASS_MINUTES).toBe(60);
    expect(isCourseClassLength(s, new Date(s.getTime() + 60 * MIN))).toBe(true);
    expect(isCourseClassLength(s, new Date(s.getTime() + 59 * MIN))).toBe(false);
    expect(isCourseClassLength(s, new Date(s.getTime() + 61 * MIN))).toBe(false);
    expect(isCourseClassLength(s, new Date(s.getTime() + 90 * MIN))).toBe(false);
  });
});

describe('courseService.scheduleClass length rule', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tutor-prof-1' } as never);
    jest.spyOn(CourseModel, 'findOne').mockReturnValue(lean({
      publicId: 'cr-1',
      tutorPublicId: 'tutor-prof-1',
      studentPublicId: 'student-prof-1',
      status: CourseStatus.ACCEPTED,
      classesRequired: 4,
      classesScheduledCount: 0,
      topicPublicIds: ['topic-1'],
      costCentsPerClass: 1500,
    }) as never);
  });

  it.each([30, 59, 61, 90])('rejects a %i-minute class before anything is created', async (minutes) => {
    const create = jest.spyOn(ScheduledClassModel, 'create');
    const start = Date.now() + 3 * 24 * 60 * MIN;
    await expect(
      courseService.scheduleClass('cr-1', 'tutor-user-1', {
        startUTC: iso(start),
        endUTC: iso(start + minutes * MIN),
        title: 'Session',
        topicPublicId: 'topic-1',
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/exactly 60 minutes/) });
    expect(create).not.toHaveBeenCalled();
  });
});

describe('classService.tutorReschedule for a course class', () => {
  const courseClass = {
    publicId: 'class-1',
    tutorPublicId: 'tutor-prof-1',
    studentPublicId: 'student-prof-1',
    status: ClassStatus.SCHEDULED,
    coursePublicId: 'cr-1',
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tutor-prof-1' } as never);
    jest.spyOn(ScheduledClassModel, 'findOne')
      .mockReturnValueOnce(lean(courseClass) as never)
      .mockReturnValue(lean(null) as never);
  });

  it('refuses to change the length', async () => {
    const update = jest.spyOn(ScheduledClassModel, 'findOneAndUpdate');
    const start = Date.now() + 24 * 60 * MIN;
    await expect(
      classService.tutorReschedule('class-1', 'u', { startUTC: iso(start), endUTC: iso(start + 90 * MIN) }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/exactly 60 minutes/) });
    expect(update).not.toHaveBeenCalled();
  });
});
