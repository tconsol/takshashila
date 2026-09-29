/* Money-critical flow: class completion → charge student → pay tutor.
   Verifies the exact balance-movement rules in ClassService.completeClass:
   STUDENT_REQUESTED (flat 1-credit / 100-cent platform fee each side):
     - charge only when the student actually attended (studentJoinedAt set)
     - debit student (cost + 100), credit tutor (cost − 100); platform keeps 200
     - free (costCents = 0) classes move no money
     - if the student debit fails (insufficient funds), tutor is NOT paid and
       the class still completes
   TUTOR_INVITED:
     - students attend free; tutor is debited the fee for both sides (200) and
       earns nothing
   Spies on the real singletons so we exercise the actual orchestration. */
import { classService } from '../../modules/classes/class.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { ClassStatus, ClassType, BillingMode } from '../../modules/schedules/schedule.types';
import { walletService } from '../../modules/wallets/wallet.service';
import { tutorService } from '../../modules/tutors/tutor.service';
import { attendanceService } from '../../modules/attendance/attendance.service';
import { studentService } from '../../modules/students/student.service';
import { auditService } from '../../modules/audit/audit.service';
import { logger } from '../../lib/logger';
import { domainEvents } from '../../events/event-emitter';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

function baseClass(over: Record<string, unknown> = {}) {
  return {
    publicId: 'class-1',
    tutorPublicId: 'tutor-prof-1',
    studentPublicId: 'student-prof-1',
    status: ClassStatus.LIVE,
    classType: ClassType.ONE_ON_ONE,
    costCents: 2000,            // $20 (20 credits)
    billingMode: BillingMode.STUDENT_REQUESTED,
    durationMinutes: 60,
    title: 'Physics',
    studentJoinedAt: new Date(), // attended by default
    ...over,
  };
}

describe('ClassService.completeClass money flow', () => {
  let debit: jest.SpyInstance;
  let credit: jest.SpyInstance;
  let transfer: jest.SpyInstance;
  let recordCompleted: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'student-user-1' }) as never);
    jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(lean({ ...baseClass(), status: ClassStatus.COMPLETED }) as never);
    jest.spyOn(tutorService, 'getByPublicId').mockResolvedValue({ userPublicId: 'tutor-user-1', commissionRatePercent: 20 } as never);
    jest.spyOn(attendanceService, 'markAttendance').mockResolvedValue({} as never);
    jest.spyOn(studentService, 'recordDemoClassUsed').mockResolvedValue(undefined as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
    debit = jest.spyOn(walletService, 'debitWallet').mockResolvedValue({} as never);
    credit = jest.spyOn(walletService, 'creditWallet').mockResolvedValue({} as never);
    // STUDENT_REQUESTED debits the student and credits the tutor atomically —
    // see wallet.service.ts's transferWallet.
    transfer = jest.spyOn(walletService, 'transferWallet').mockResolvedValue({ debit: {}, credit: {} } as never);
    recordCompleted = jest.spyOn(tutorService, 'recordClassCompleted').mockResolvedValue(undefined as never);
    jest.spyOn(auditService, 'log').mockResolvedValue({} as never);
  });

  it('attended + paid class → debits student (cost + fee), credits tutor (cost − fee)', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(baseClass()) as never);

    await classService.completeClass('class-1', 'tutor-user-1');

    expect(transfer).toHaveBeenCalledTimes(1);
    // 2000 + 100 fee = 2100 charged to the student, 2000 − 100 fee = 1900
    // credited to the tutor's user wallet, in one atomic transfer.
    expect(transfer.mock.calls[0][0]).toMatchObject({
      fromOwnerPublicId: 'student-user-1',
      toOwnerPublicId: 'tutor-user-1',
      debitAmountCents: 2100,
      creditAmountCents: 1900,
    });
    expect(recordCompleted).toHaveBeenCalledWith('tutor-prof-1', 1900);
  });

  it('TUTOR_INVITED + attended → student free, tutor debited 200 (2 credits), earns nothing', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(
      lean(baseClass({ billingMode: BillingMode.TUTOR_INVITED, costCents: 0, studentJoinedAt: new Date() })) as never,
    );

    await classService.completeClass('class-1', 'tutor-user-1');

    expect(debit).toHaveBeenCalledTimes(1);
    // 100 × 2 = 200 charged to the tutor; student never charged
    expect(debit.mock.calls[0][0]).toMatchObject({ ownerPublicId: 'tutor-user-1', amountCents: 200 });
    expect(credit).not.toHaveBeenCalled();
    expect(recordCompleted).not.toHaveBeenCalled();
  });

  it('TUTOR_INVITED + student did NOT attend → no fee charged (no-shows are free)', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(
      lean(baseClass({ billingMode: BillingMode.TUTOR_INVITED, costCents: 0, studentJoinedAt: undefined })) as never,
    );

    await classService.completeClass('class-1', 'tutor-user-1');

    expect(debit).not.toHaveBeenCalled();
    expect(credit).not.toHaveBeenCalled();
  });

  it('student did NOT attend → no transfer', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(baseClass({ studentJoinedAt: undefined })) as never);

    await classService.completeClass('class-1', 'tutor-user-1');

    expect(transfer).not.toHaveBeenCalled();
  });

  it('free class (costCents = 0) → no money moves', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(baseClass({ costCents: 0 })) as never);

    await classService.completeClass('class-1', 'tutor-user-1');

    expect(transfer).not.toHaveBeenCalled();
  });

  it('insufficient student balance → tutor NOT paid, class still completes', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(baseClass()) as never);
    transfer.mockRejectedValueOnce(Object.assign(new Error('Insufficient credits'), { statusCode: 402 }));

    const result = await classService.completeClass('class-1', 'tutor-user-1');

    expect(transfer).toHaveBeenCalledTimes(1);
    expect(recordCompleted).not.toHaveBeenCalled();  // transfer failed → no tutor payout
    expect(result).toMatchObject({ status: ClassStatus.COMPLETED }); // class still closed
  });

  it('insufficient balance → class flagged billingFailed and audit-logged', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(baseClass()) as never);
    transfer.mockRejectedValueOnce(new Error('Insufficient credits'));
    const flagUpdate = jest.spyOn(ScheduledClassModel, 'findOneAndUpdate');
    flagUpdate.mockReturnValueOnce(lean({ ...baseClass(), status: ClassStatus.COMPLETED }) as never);
    flagUpdate.mockReturnValueOnce(
      lean({ ...baseClass(), status: ClassStatus.COMPLETED, billingFailed: true, billingFailureReason: 'Insufficient credits' }) as never,
    );

    const result = await classService.completeClass('class-1', 'tutor-user-1');

    expect(flagUpdate.mock.calls[1][1]).toEqual({
      $set: { billingFailed: true, billingFailureReason: 'Insufficient credits' },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CLASS_BILLING_FAILED', resourceId: 'class-1' }),
    );
    expect(result).toMatchObject({ status: ClassStatus.COMPLETED, billingFailed: true });
  });

  it('successful billing → no billingFailed flag, no audit entry', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(baseClass()) as never);
    await classService.completeClass('class-1', 'tutor-user-1');
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('rejects when class is already completed', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(baseClass({ status: ClassStatus.COMPLETED })) as never);
    await expect(classService.completeClass('class-1', 'tutor-user-1')).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('ClassService.refundClass refund/reversal flow', () => {
  let refund: jest.SpyInstance;
  let reverse: jest.SpyInstance;
  let atomic: jest.SpyInstance;

  function completed(over: Record<string, unknown> = {}) {
    return baseClass({ status: ClassStatus.COMPLETED, isRefunded: false, ...over });
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'student-user-1' }) as never);
    jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(lean({ ...completed(), isRefunded: true }) as never);
    jest.spyOn(tutorService, 'getByPublicId').mockResolvedValue({ userPublicId: 'tutor-user-1', commissionRatePercent: 20 } as never);
    refund = jest.spyOn(walletService, 'refundWallet').mockResolvedValue({} as never);
    reverse = jest.spyOn(walletService, 'reverseWallet').mockResolvedValue({} as never);
    atomic = jest.spyOn(walletService, 'refundWithClawback').mockResolvedValue({ refund: {}, reversal: {}, clawbackSkipped: false } as never);
    jest.spyOn(auditService, 'log').mockResolvedValue({} as never);
  });

  it('STUDENT_REQUESTED → refunds student (cost + fee), reverses tutor (cost − fee)', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(completed()) as never);

    await classService.refundClass('class-1', 'admin-1', 'duplicate charge');

    // Student refund + tutor clawback happen in one atomic wallet call.
    expect(atomic).toHaveBeenCalledTimes(1);
    expect(atomic.mock.calls[0][0]).toMatchObject({
      studentOwnerPublicId: 'student-user-1',
      tutorOwnerPublicId: 'tutor-user-1',
      refundAmountCents: 2100,
      clawbackAmountCents: 1900,
      refundIdempotencyKey: 'class-refund-class-1',
      clawbackIdempotencyKey: 'tutor-reversal-class-1',
    });
    expect(refund).not.toHaveBeenCalled();
    expect(reverse).not.toHaveBeenCalled();
  });

  it('prepaid class → refunds flat costCents (no fee) atomically with clawback', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(
      lean(completed({ billingMode: BillingMode.COURSE_PREPAID })) as never,
    );
    await classService.refundClass('class-1', 'admin-1', 'x');
    expect(atomic.mock.calls[0][0]).toMatchObject({ refundAmountCents: 2000, clawbackAmountCents: 1900 });
  });

  it('tutor cannot cover clawback → class still refunded, amounts unchanged, warning logged', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(completed()) as never);
    atomic.mockResolvedValueOnce({ refund: {}, clawbackSkipped: true });
    const warn = jest.spyOn(logger, 'warn').mockImplementation((() => logger) as never);

    const result = await classService.refundClass('class-1', 'admin-1', 'x');

    expect(atomic.mock.calls[0][0]).toMatchObject({ refundAmountCents: 2100, clawbackAmountCents: 1900 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('claw back'), expect.objectContaining({ unrecoveredClawbackCents: 1900 }));
    expect(result).toMatchObject({ isRefunded: true });
  });

  it('atomic refund failure → class is NOT marked refunded', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(completed()) as never);
    atomic.mockRejectedValueOnce(new Error('db down'));
    const upd = jest.spyOn(ScheduledClassModel, 'findOneAndUpdate');
    await expect(classService.refundClass('class-1', 'admin-1', 'x')).rejects.toThrow('db down');
    expect(upd).not.toHaveBeenCalled();
  });

  it('TUTOR_INVITED → refunds tutor the 200 platform fee, no reversal', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(
      lean(completed({ billingMode: BillingMode.TUTOR_INVITED, costCents: 0 })) as never,
    );

    await classService.refundClass('class-1', 'admin-1', 'class did not happen');

    expect(refund).toHaveBeenCalledTimes(1);
    expect(refund.mock.calls[0][0]).toMatchObject({ ownerPublicId: 'tutor-user-1', amountCents: 200 });
    expect(reverse).not.toHaveBeenCalled();
  });

  it('rejects refunding a class that is not completed', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(completed({ status: ClassStatus.SCHEDULED })) as never);
    await expect(classService.refundClass('class-1', 'admin-1', 'x')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects refunding an already-refunded class', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(completed({ isRefunded: true })) as never);
    await expect(classService.refundClass('class-1', 'admin-1', 'x')).rejects.toMatchObject({ statusCode: 409 });
    expect(refund).not.toHaveBeenCalled();
  });
});
