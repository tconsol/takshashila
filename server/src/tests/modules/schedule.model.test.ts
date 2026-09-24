import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { BillingMode, ClassStatus, ClassType } from '../../modules/schedules/schedule.types';

describe('ScheduledClass curriculum fields', () => {
  it('accepts COURSE_PREPAID billing mode and optional curriculum link fields', () => {
    const doc = new ScheduledClassModel({
      publicId: 'class-1',
      tutorPublicId: 'tutor-1',
      studentPublicId: 'student-1',
      classType: ClassType.ONE_ON_ONE,
      status: ClassStatus.SCHEDULED,
      startUTC: new Date(),
      endUTC: new Date(),
      ianaTimezone: 'UTC',
      durationMinutes: 60,
      title: 'Algebra I – Topic 2',
      costCents: 1500,
      billingMode: BillingMode.COURSE_PREPAID,
      idempotencyKey: 'course-class-1',
      coursePublicId: 'cr-1',
      curriculumPublicId: 'curriculum-1',
      topicPublicId: 'topic-2',
      isDeleted: false,
    });

    const err = doc.validateSync();
    expect(err).toBeUndefined();
    expect(doc.billingMode).toBe('COURSE_PREPAID');
    expect(doc.coursePublicId).toBe('cr-1');
  });

  it('still allows a plain class with no curriculum fields', () => {
    const doc = new ScheduledClassModel({
      publicId: 'class-2',
      tutorPublicId: 'tutor-1',
      studentPublicId: 'student-1',
      classType: ClassType.ONE_ON_ONE,
      status: ClassStatus.SCHEDULED,
      startUTC: new Date(),
      endUTC: new Date(),
      ianaTimezone: 'UTC',
      durationMinutes: 60,
      title: 'Regular class',
      costCents: 1500,
      idempotencyKey: 'plain-class-2',
      isDeleted: false,
    });

    expect(doc.validateSync()).toBeUndefined();
    expect(doc.coursePublicId).toBeUndefined();
  });
});
