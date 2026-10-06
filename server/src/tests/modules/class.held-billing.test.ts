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
import { auditService } from '../../modules/audit/audit.service';
import { domainEvents } from '../../events/event-emitter';
import { CourseModel } from '../../modules/courses/course.model';
import { CourseStatus } from '../../modules/courses/course.types';
import { ProgramEnrollmentModel, ProgramModel } from '../../modules/programs/program.model';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

function heldClass(over: Record<string, unknown> = {}) {
  return {
    publicId: 'held-class-1',
    tutorPublicId: 'tutor-prof-1',
    studentPublicId: 'student-prof-1',
    status: ClassStatus.LIVE,
    classType: ClassType.ONE_ON_ONE,
    costCents: 1500,
    billingMode: BillingMode.COURSE_HELD,
    durationMinutes: 60,
    title: 'Algebra I – Topic 2',
    studentJoinedAt: new Date(),
    tutorJoinedAt: new Date(),
    coursePublicId: 'cr-1',
    ...over,
  };
}

describe('held course/program billing', () => {
  let debit: jest.SpyInstance;
  let credit: jest.SpyInstance;
  let refund: jest.SpyInstance;
  let transfer: jest.SpyInstance;

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
    jest.spyOn(auditService, 'log').mockResolvedValue(undefined as never);
    debit = jest.spyOn(walletService, 'debitWallet').mockResolvedValue({} as never);
    credit = jest.spyOn(walletService, 'creditWallet').mockResolvedValue({} as never);
    refund = jest.spyOn(walletService, 'refundWallet').mockResolvedValue({} as never);
    transfer = jest.spyOn(walletService, 'transferWallet').mockResolvedValue({} as never);
    jest.spyOn(CourseModel, 'findOneAndUpdate').mockReturnValue(
      lean({ publicId: 'cr-1', status: CourseStatus.ACCEPTED, classesRequired: 4, classesCompletedCount: 1 }) as never,
    );
  });

  function arrangeComplete(over: Record<string, unknown> = {}) {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(heldClass(over)) as never);
    return jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(
      lean({ ...heldClass(over), status: ClassStatus.COMPLETED }) as never,
    );
  }

  it('completeClass: charges the student the session price (no fee) and pays the tutor price − fee, in one transfer', async () => {
    arrangeComplete();
    await classService.completeClass('held-class-1', 'tutor-user-1');

    expect(transfer).toHaveBeenCalledTimes(1);
    expect(transfer.mock.calls[0][0]).toMatchObject({
      fromOwnerPublicId: 'student-user-1',
      toOwnerPublicId: 'tutor-user-1',
      debitAmountCents: 1500,
      creditAmountCents: 1400,
      debitIdempotencyKey: 'class-charge-held-class-1',
      creditIdempotencyKey: 'tutor-earning-held-class-1',
    });
    expect(debit).not.toHaveBeenCalled();
    expect(credit).not.toHaveBeenCalled();
    expect(tutorService.recordClassCompleted).toHaveBeenCalledWith('tutor-prof-1', 1400);
  });

  it('completeClass: student absent → nothing charged or paid, but the course still advances (hold is released)', async () => {
    arrangeComplete({ studentJoinedAt: undefined });
    await classService.completeClass('held-class-1', 'tutor-user-1');

    expect(transfer).not.toHaveBeenCalled();
    expect(CourseModel.findOneAndUpdate).toHaveBeenCalledWith(
      { publicId: 'cr-1' }, { $inc: { classesCompletedCount: 1 } }, { new: true },
    );
  });

  it('completeClass: short balance → class still completes, flagged billingFailed, audited, tutor not paid', async () => {
    const update = arrangeComplete();
    transfer.mockRejectedValue(Object.assign(new Error('Insufficient credits'), { statusCode: 402 }));

    await expect(classService.completeClass('held-class-1', 'tutor-user-1')).resolves.toBeDefined();

    expect(update).toHaveBeenCalledWith(
      { publicId: 'held-class-1' },
      { $set: { billingFailed: true, billingFailureReason: 'Insufficient credits' } },
      { new: true },
    );
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CLASS_BILLING_FAILED', resourceId: 'held-class-1' }));
    expect(tutorService.recordClassCompleted).not.toHaveBeenCalled();
    expect(CourseModel.findOneAndUpdate).toHaveBeenCalled(); // progress still advances
  });

  it('cancelClass: refunds nothing (nothing was taken) and charges no cancellation fee', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(
      lean(heldClass({ status: ClassStatus.SCHEDULED, studentJoinedAt: undefined })) as never,
    );
    jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(
      lean({ ...heldClass(), status: ClassStatus.CANCELLED }) as never,
    );

    await classService.cancelClass('held-class-1', 'tutor-user-1', { reason: 'Rescheduling' });

    expect(refund).not.toHaveBeenCalled();
    expect(debit).not.toHaveBeenCalled();
  });

  it('cancelClass on a PROGRAM_HELD session frees the booked slot count like a prepaid one', async () => {
    const cls = heldClass({
      status: ClassStatus.SCHEDULED, studentJoinedAt: undefined, billingMode: BillingMode.PROGRAM_HELD,
      programEnrollmentPublicId: 'e-1', coursePublicId: undefined,
    });
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(cls) as never);
    jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(lean({ ...cls, status: ClassStatus.CANCELLED }) as never);
    const dec = jest.spyOn(ProgramEnrollmentModel, 'updateOne').mockResolvedValue({} as never);

    await classService.cancelClass('held-class-1', 'tutor-user-1', { reason: 'x' });

    expect(dec).toHaveBeenCalledWith(
      { publicId: 'e-1', status: 'ACTIVE', sessionsScheduledCount: { $gt: 0 } },
      { $inc: { sessionsScheduledCount: -1 } },
    );
    expect(refund).not.toHaveBeenCalled();
  });

  it('refundClass on a completed held class refunds exactly costCents and claws back price − fee', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(heldClass({ status: ClassStatus.COMPLETED })) as never);
    const atomic = jest.spyOn(walletService, 'refundWithClawback').mockResolvedValue({ refund: {}, clawbackSkipped: false } as never);
    jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(
      lean({ ...heldClass(), status: ClassStatus.COMPLETED, isRefunded: true }) as never,
    );

    await classService.refundClass('held-class-1', 'admin-user-1', 'Refund requested');

    expect(atomic.mock.calls[0][0]).toMatchObject({
      studentOwnerPublicId: 'student-user-1', refundAmountCents: 1500,
      tutorOwnerPublicId: 'tutor-user-1', clawbackAmountCents: 1400,
    });
  });

  describe('recordProgramSessionCompleted', () => {
    function arrangeLastSession(billing: 'HELD' | undefined) {
      jest.spyOn(ScheduledClassModel, 'find').mockReturnValue(lean([{ costCents: 333 }, { costCents: 333 }, { costCents: 333 }]) as never);
      jest.spyOn(ProgramEnrollmentModel, 'findOneAndUpdate')
        .mockReturnValueOnce(lean({
          publicId: 'e-1', status: 'ACTIVE', sessionCount: 3, priceCentsPaid: 1000, studentPublicId: 'sp-1', programPublicId: 'p-1', billing,
        }) as never)
        .mockReturnValueOnce(lean({ publicId: 'e-1', status: 'COMPLETED' }) as never);
      jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'student-user-1' }) as never);
      jest.spyOn(ProgramModel, 'updateOne').mockResolvedValue({} as never);
    }

    it('held enrollment: the 1-credit rounding remainder was never taken, so nothing is refunded', async () => {
      arrangeLastSession('HELD');
      await classService.recordProgramSessionCompleted('e-1');
      expect(refund).not.toHaveBeenCalled();
    });

    it('legacy prepaid enrollment: the remainder is still refunded', async () => {
      arrangeLastSession(undefined);
      await classService.recordProgramSessionCompleted('e-1');
      expect(refund).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 1, referenceType: 'PROGRAM_COMPLETE' }));
    });
  });
});
