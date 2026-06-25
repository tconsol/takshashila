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

describe('ClassService.completeClass — money flow', () => {
  let debit: jest.SpyInstance;
  let credit: jest.SpyInstance;
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
    recordCompleted = jest.spyOn(tutorService, 'recordClassCompleted').mockResolvedValue(undefined as never);
  });

  it('attended + paid class → debits student (cost + fee), credits tutor (cost − fee)', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(baseClass()) as never);

    await classService.completeClass('class-1', 'tutor-user-1');

    expect(debit).toHaveBeenCalledTimes(1);
    // 2000 + 100 fee = 2100 charged to the student
    expect(debit.mock.calls[0][0]).toMatchObject({ ownerPublicId: 'student-user-1', amountCents: 2100 });

    expect(credit).toHaveBeenCalledTimes(1);
    // 2000 − 100 fee = 1900 credited to the tutor's user wallet
    expect(credit.mock.calls[0][0]).toMatchObject({ ownerPublicId: 'tutor-user-1', amountCents: 1900 });
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

  it('student did NOT attend → no debit, no credit', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(baseClass({ studentJoinedAt: undefined })) as never);

    await classService.completeClass('class-1', 'tutor-user-1');

    expect(debit).not.toHaveBeenCalled();
    expect(credit).not.toHaveBeenCalled();
  });

  it('free class (costCents = 0) → no money moves', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(baseClass({ costCents: 0 })) as never);

    await classService.completeClass('class-1', 'tutor-user-1');

    expect(debit).not.toHaveBeenCalled();
    expect(credit).not.toHaveBeenCalled();
  });

  it('insufficient student balance → tutor NOT paid, class still completes', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(baseClass()) as never);
    debit.mockRejectedValueOnce(Object.assign(new Error('Insufficient credits'), { statusCode: 402 }));

    const result = await classService.completeClass('class-1', 'tutor-user-1');

    expect(debit).toHaveBeenCalledTimes(1);
    expect(credit).not.toHaveBeenCalled();        // debit failed → no tutor payout
    expect(recordCompleted).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: ClassStatus.COMPLETED }); // class still closed
  });

  it('rejects when class is already completed', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(baseClass({ status: ClassStatus.COMPLETED })) as never);
    await expect(classService.completeClass('class-1', 'tutor-user-1')).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('ClassService.refundClass — refund/reversal flow', () => {
  let refund: jest.SpyInstance;
  let reverse: jest.SpyInstance;

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
  });

  it('STUDENT_REQUESTED → refunds student (cost + fee), reverses tutor (cost − fee)', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(completed()) as never);

    await classService.refundClass('class-1', 'admin-1', 'duplicate charge');

    expect(refund).toHaveBeenCalledTimes(1);
    expect(refund.mock.calls[0][0]).toMatchObject({ ownerPublicId: 'student-user-1', amountCents: 2100 });
    expect(reverse).toHaveBeenCalledTimes(1);
    expect(reverse.mock.calls[0][0]).toMatchObject({ ownerPublicId: 'tutor-user-1', amountCents: 1900 });
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
