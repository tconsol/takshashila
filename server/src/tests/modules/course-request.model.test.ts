// server/src/tests/modules/course-request.model.test.ts
import { CourseRequestModel } from '../../modules/course-requests/course-request.model';
import { CourseRequestStatus } from '../../modules/course-requests/course-request.types';

describe('CourseRequest model', () => {
  it('validates a pending request with an availability window', () => {
    const doc = new CourseRequestModel({
      publicId: 'cr-1',
      studentPublicId: 'student-1',
      tutorPublicId: 'tutor-1',
      coursePublicId: 'course-1',
      selectedTopicPublicIds: ['topic-1', 'topic-2'],
      availabilityWindow: {
        daysOfWeek: [1, 2, 3, 4, 5],
        startLocalTime: '16:00',
        endLocalTime: '19:00',
        ianaTimezone: 'America/New_York',
      },
      status: CourseRequestStatus.PENDING,
      classesScheduledCount: 0,
      classesCompletedCount: 0,
      isDeleted: false,
    });

    expect(doc.validateSync()).toBeUndefined();
    expect(doc.status).toBe('PENDING');
    expect(doc.availabilityWindow.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
  });
});
