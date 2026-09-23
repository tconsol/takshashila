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
});
