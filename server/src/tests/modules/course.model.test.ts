// server/src/tests/modules/course.model.test.ts
import { CourseModel } from '../../modules/courses/course.model';
import { CourseStatus } from '../../modules/courses/course.types';

describe('Course model', () => {
  it('validates a pending request with an availability window', () => {
    const doc = new CourseModel({
      publicId: 'cr-1',
      studentPublicId: 'student-1',
      tutorPublicId: 'tutor-1',
      curriculumPublicId: 'curriculum-1',
      topicPublicIds: ['topic-1', 'topic-2'],
      availabilityWindow: {
        daysOfWeek: [1, 2, 3, 4, 5],
        startLocalTime: '16:00',
        endLocalTime: '19:00',
        ianaTimezone: 'America/New_York',
      },
      status: CourseStatus.PENDING,
      classesScheduledCount: 0,
      classesCompletedCount: 0,
      isDeleted: false,
    });

    expect(doc.validateSync()).toBeUndefined();
    expect(doc.status).toBe('PENDING');
    expect(doc.availabilityWindow.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
  });
});
