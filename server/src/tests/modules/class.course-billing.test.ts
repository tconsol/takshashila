// server/src/tests/modules/class.course-billing.test.ts
import { classService } from '../../modules/classes/class.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { ClassStatus, ClassType, BillingMode } from '../../modules/schedules/schedule.types';
import { walletService } from '../../modules/wallets/wallet.service';
import { tutorService } from '../../modules/tutors/tutor.service';
import { attendanceService } from '../../modules/attendance/attendance.service';
import { studentService } from '../../modules/students/student.service';
import { scheduleService } from '../../modules/schedules/schedule.service';
import { tutorRepository } from '../../modules/tutors/tutor.repository';
import { domainEvents } from '../../events/event-emitter';
import { CourseRequestModel } from '../../modules/course-requests/course-request.model';
import { CourseRequestStatus } from '../../modules/course-requests/course-request.types';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

function coursePrepaidClass(over: Record<string, unknown> = {}) {
  return {
    publicId: 'course-class-1',
    tutorPublicId: 'tutor-prof-1',
    studentPublicId: 'student-prof-1',
    status: ClassStatus.LIVE,
    classType: ClassType.ONE_ON_ONE,
    costCents: 1500, // rate for this course class
    billingMode: BillingMode.COURSE_PREPAID,
    durationMinutes: 60,
    title: 'Algebra I – Topic 2',
    studentJoinedAt: new Date(),
    courseRequestPublicId: 'cr-1',
    ...over,
  };
}

describe('ClassService COURSE_PREPAID billing', () => {
  let debit: jest.SpyInstance;
  let credit: jest.SpyInstance;
  let refund: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'student-user-1' }) as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'tutor-user-1' }) as never);
    jest.spyOn(tutorService, 'getByPublicId').mockResolvedValue({ userPublicId: 'tutor-user-1' } as never);
    jest.spyOn(attendanceService, 'markAttendance').mockResolvedValue({} as never);
    jest.spyOn(studentService, 'recordDemoClassUsed').mockResolvedValue(undefined as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
    jest.spyOn(tutorService, 'recordClassCompleted').mockResolvedValue(undefined as never);
    jest.spyOn(scheduleService, 'releaseSlot').mockResolvedValue(undefined as never);
    jest.spyOn(tutorService, 'recordClassCancelled').mockResolvedValue(undefined as never);
    jest.spyOn(tutorRepository, 'incrementStats').mockResolvedValue(undefined as never);
    debit = jest.spyOn(walletService, 'debitWallet').mockResolvedValue({} as never);
    credit = jest.spyOn(walletService, 'creditWallet').mockResolvedValue({} as never);
    refund = jest.spyOn(walletService, 'refundWallet').mockResolvedValue({} as never);
  });

  it('completeClass: does NOT re-debit the student, but DOES credit the tutor (cost − fee)', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(coursePrepaidClass()) as never);
    jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(
      lean({ ...coursePrepaidClass(), status: ClassStatus.COMPLETED }) as never,
    );
    // Not the final class of the series — no status flip expected.
    jest.spyOn(CourseRequestModel, 'findOneAndUpdate').mockReturnValue(
      lean({ publicId: 'cr-1', status: CourseRequestStatus.ACCEPTED, classesRequired: 4, classesCompletedCount: 1 }) as never,
    );

    await classService.completeClass('course-class-1', 'tutor-user-1');

    expect(debit).not.toHaveBeenCalled();
    expect(credit).toHaveBeenCalledTimes(1);
    // 1500 − 100 platform fee = 1400 credited to the tutor
    expect(credit.mock.calls[0][0]).toMatchObject({ ownerPublicId: 'tutor-user-1', amountCents: 1400 });
  });

  it('cancelClass: refunds the student the full costCents (unlike STUDENT_REQUESTED, which refunds nothing)', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(
      lean(coursePrepaidClass({ status: ClassStatus.SCHEDULED, studentJoinedAt: undefined })) as never,
    );
    jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(
      lean({ ...coursePrepaidClass(), status: ClassStatus.CANCELLED }) as never,
    );

    await classService.cancelClass('course-class-1', 'tutor-user-1', { reason: 'Rescheduling' });

    expect(refund).toHaveBeenCalledTimes(1);
    expect(refund.mock.calls[0][0]).toMatchObject({ ownerPublicId: 'student-user-1', amountCents: 1500 });
  });

  describe('refundClass on a completed COURSE_PREPAID class', () => {
    it('refunds exactly costCents (not costCents + PLATFORM_FEE_CENTS) and reverses costCents - PLATFORM_FEE_CENTS from the tutor', async () => {
      jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(
        lean(coursePrepaidClass({ status: ClassStatus.COMPLETED, costCents: 1500 })) as never,
      );
      const reverse = jest.spyOn(walletService, 'reverseWallet').mockResolvedValue({} as never);
      jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(
        lean({ ...coursePrepaidClass(), status: ClassStatus.COMPLETED, isRefunded: true }) as never,
      );

      await classService.refundClass('course-class-1', 'admin-user-1', 'Refund requested');

      expect(refund).toHaveBeenCalledTimes(1);
      expect(refund.mock.calls[0][0]).toMatchObject({ ownerPublicId: 'student-user-1', amountCents: 1500 });
      expect(reverse).toHaveBeenCalledTimes(1);
      expect(reverse.mock.calls[0][0]).toMatchObject({ ownerPublicId: 'tutor-user-1', amountCents: 1400 });
    });
  });

  describe('completeClass CourseRequest progress tracking', () => {
    it('increments classesCompletedCount and flips CourseRequest status to COMPLETED when it reaches classesRequired', async () => {
      jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(coursePrepaidClass()) as never);
      jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(
        lean({ ...coursePrepaidClass(), status: ClassStatus.COMPLETED }) as never,
      );
      const crFindOneAndUpdate = jest.spyOn(CourseRequestModel, 'findOneAndUpdate');
      // 1st call: the $inc, returning the post-increment doc at classesRequired.
      crFindOneAndUpdate.mockReturnValueOnce(
        lean({ publicId: 'cr-1', status: CourseRequestStatus.ACCEPTED, classesRequired: 4, classesCompletedCount: 4 }) as never,
      );
      // 2nd call: the status flip to COMPLETED.
      crFindOneAndUpdate.mockReturnValueOnce(
        lean({ publicId: 'cr-1', status: CourseRequestStatus.COMPLETED, classesRequired: 4, classesCompletedCount: 4 }) as never,
      );
      const emit = jest.spyOn(domainEvents, 'emit');

      await classService.completeClass('course-class-1', 'tutor-user-1');

      expect(crFindOneAndUpdate).toHaveBeenNthCalledWith(
        1,
        { publicId: 'cr-1' },
        { $inc: { classesCompletedCount: 1 } },
        { new: true },
      );
      expect(crFindOneAndUpdate).toHaveBeenNthCalledWith(
        2,
        { publicId: 'cr-1' },
        { $set: { status: CourseRequestStatus.COMPLETED } },
      );
      expect(emit).toHaveBeenCalledWith('COURSE_REQUEST_COMPLETED', expect.objectContaining({ requestPublicId: 'cr-1' }));
    });

    it('just increments the count, without changing status, on a non-final class', async () => {
      jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(coursePrepaidClass()) as never);
      jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(
        lean({ ...coursePrepaidClass(), status: ClassStatus.COMPLETED }) as never,
      );
      const crFindOneAndUpdate = jest.spyOn(CourseRequestModel, 'findOneAndUpdate').mockReturnValue(
        lean({ publicId: 'cr-1', status: CourseRequestStatus.ACCEPTED, classesRequired: 4, classesCompletedCount: 2 }) as never,
      );
      const emit = jest.spyOn(domainEvents, 'emit');

      await classService.completeClass('course-class-1', 'tutor-user-1');

      expect(crFindOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(emit).not.toHaveBeenCalledWith('COURSE_REQUEST_COMPLETED', expect.anything());
    });
  });
});
