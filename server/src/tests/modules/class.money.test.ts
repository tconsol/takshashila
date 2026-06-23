/* Money-critical flow: class completion → charge student → pay tutor.
   Verifies the exact balance-movement rules in ClassService.completeClass:
     - charge only when the student actually attended (studentJoinedAt set)
     - debit student the full per-class cost, credit tutor (cost − commission)
     - free (costCents = 0) classes move no money
     - if the student debit fails (insufficient funds), tutor is NOT paid and
       the class still completes
   Spies on the real singletons so we exercise the actual orchestration. */
import { classService } from '../../modules/classes/class.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { ClassStatus, ClassType } from '../../modules/schedules/schedule.types';
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
    costCents: 2000,            // $20
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

  it('attended + paid class → debits student full cost, credits tutor (cost − 20% commission)', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(baseClass()) as never);

    await classService.completeClass('class-1', 'tutor-user-1');

    expect(debit).toHaveBeenCalledTimes(1);
    expect(debit.mock.calls[0][0]).toMatchObject({ ownerPublicId: 'student-user-1', amountCents: 2000 });

    expect(credit).toHaveBeenCalledTimes(1);
    // $20 − 20% = $16 → 1600 cents to the tutor's user wallet
    expect(credit.mock.calls[0][0]).toMatchObject({ ownerPublicId: 'tutor-user-1', amountCents: 1600 });
    expect(recordCompleted).toHaveBeenCalledWith('tutor-prof-1', 1600);
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
