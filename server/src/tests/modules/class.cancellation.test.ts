/* The two rules that decide whether the platform settles a class by itself, and
   who pays when someone walks away.

   MIN_SESSION_MINUTES: a LIVE class past its end time only auto-completes when
   tutor AND student were in the room together for long enough. Anything shorter
   is held (needsTutorDecision) so a person decides instead of the platform
   moving money on a guess.

   Cancellation fee: falls on whoever cancelled, but only if they were a party to
   the class — an admin or the sweep cancelling on someone's behalf charges
   nobody. It is allowed to push the wallet negative so it cannot be dodged. */
import { classService } from '../../modules/classes/class.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { ClassStatus, ClassType, BillingMode } from '../../modules/schedules/schedule.types';
import { walletService } from '../../modules/wallets/wallet.service';
import { tutorService } from '../../modules/tutors/tutor.service';
import { scheduleService } from '../../modules/schedules/schedule.service';
import { domainEvents } from '../../events/event-emitter';
import { PLATFORM_FEE_CENTS } from '../../utils/currency';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const MINUTE = 60_000;

const TUTOR_USER = 'tutor-user-1';
const STUDENT_USER = 'student-user-1';

function cancellableClass(over: Record<string, unknown> = {}) {
  return {
    publicId: 'class-1',
    tutorPublicId: 'tutor-prof-1',
    studentPublicId: 'student-prof-1',
    status: ClassStatus.SCHEDULED,
    classType: ClassType.ONE_ON_ONE,
    costCents: 2000,
    billingMode: BillingMode.STUDENT_REQUESTED,
    ...over,
  };
}

describe('ClassService.cancelClass — who pays the platform fee', () => {
  let debit: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(cancellableClass()) as never);
    jest.spyOn(ScheduledClassModel, 'findOneAndUpdate')
      .mockReturnValue(lean({ ...cancellableClass(), status: ClassStatus.CANCELLED }) as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: TUTOR_USER }) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: STUDENT_USER }) as never);
    jest.spyOn(tutorService, 'recordClassCancelled').mockResolvedValue(undefined as never);
    jest.spyOn(scheduleService, 'releaseSlot').mockResolvedValue(undefined as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
    debit = jest.spyOn(walletService, 'debitWallet').mockResolvedValue({} as never);
  });

  it('charges the student when the student cancels', async () => {
    await classService.cancelClass('class-1', STUDENT_USER, { reason: 'busy' });

    expect(debit).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerPublicId: STUDENT_USER,
        amountCents: PLATFORM_FEE_CENTS,
        allowNegative: true,
      }),
    );
  });

  it('charges the tutor when the tutor cancels', async () => {
    await classService.cancelClass('class-1', TUTOR_USER, { reason: 'ill' });

    expect(debit).toHaveBeenCalledWith(
      expect.objectContaining({ ownerPublicId: TUTOR_USER, amountCents: PLATFORM_FEE_CENTS }),
    );
  });

  it('charges nobody when an admin or the system cancels', async () => {
    await classService.cancelClass('class-1', 'system', { reason: 'auto' });
    expect(debit).not.toHaveBeenCalled();
  });

  it('uses a per-class idempotency key so a retry cannot double-charge', async () => {
    await classService.cancelClass('class-1', STUDENT_USER, { reason: 'busy' });
    expect(debit).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'cancel-fee-class-1' }),
    );
  });

  it('still cancels the class when the fee cannot be charged', async () => {
    debit.mockRejectedValue(new Error('wallet locked'));

    const result = await classService.cancelClass('class-1', STUDENT_USER, { reason: 'busy' });

    expect(result.status).toBe(ClassStatus.CANCELLED);
  });
});

describe('ClassService.autoResolveOverdueClasses — 30 minute rule', () => {
  const longAgo = new Date(Date.now() - 120 * MINUTE);

  function overdue(over: Record<string, unknown> = {}) {
    return {
      publicId: 'class-1',
      status: ClassStatus.LIVE,
      tutorPublicId: 'tutor-prof-1',
      endUTC: new Date(Date.now() - 20 * MINUTE),
      ...over,
    };
  }

  let updateOne: jest.SpyInstance;
  let complete: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(tutorService, 'getByPublicId').mockResolvedValue({ userPublicId: TUTOR_USER } as never);
    updateOne = jest.spyOn(ScheduledClassModel, 'updateOne').mockResolvedValue({} as never);
    complete = jest.spyOn(classService, 'completeClass').mockResolvedValue({} as never);
  });

  function mockOverdueList(cls: Record<string, unknown>) {
    jest.spyOn(ScheduledClassModel, 'find').mockReturnValue({
      limit: () => ({ lean: () => Promise.resolve([cls]) }),
    } as never);
    jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(lean(cls) as never);
  }

  it('auto-completes when both were present for the full 30 minutes', async () => {
    mockOverdueList(overdue({
      tutorJoinedAt: longAgo,
      studentJoinedAt: longAgo,
    }));

    const result = await classService.autoResolveOverdueClasses();

    expect(complete).toHaveBeenCalled();
    expect(result.completed).toBe(1);
    expect(result.held).toBe(0);
  });

  it('holds for the tutor when they overlapped for less than 30 minutes', async () => {
    mockOverdueList(overdue({
      tutorJoinedAt: longAgo,
      // Joined 5 minutes before the end → only 5 minutes together.
      studentJoinedAt: new Date(Date.now() - 25 * MINUTE),
    }));

    const result = await classService.autoResolveOverdueClasses();

    expect(complete).not.toHaveBeenCalled();
    expect(result.held).toBe(1);
    expect(updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ publicId: 'class-1' }),
      { $set: { needsTutorDecision: true } },
    );
  });

  it('holds when the student never joined, however long the tutor waited', async () => {
    mockOverdueList(overdue({ tutorJoinedAt: longAgo, studentJoinedAt: undefined }));

    const result = await classService.autoResolveOverdueClasses();

    expect(complete).not.toHaveBeenCalled();
    expect(result.held).toBe(1);
  });

  it('holds when the tutor never joined', async () => {
    mockOverdueList(overdue({ tutorJoinedAt: undefined, studentJoinedAt: longAgo }));

    const result = await classService.autoResolveOverdueClasses();

    expect(result.held).toBe(1);
  });

  it('counts only overlap, not time either person sat alone', async () => {
    // Tutor in for 2h, student for the last 10 minutes before the end.
    mockOverdueList(overdue({
      tutorJoinedAt: longAgo,
      studentJoinedAt: new Date(Date.now() - 30 * MINUTE),
      endUTC: new Date(Date.now() - 20 * MINUTE),
    }));

    const result = await classService.autoResolveOverdueClasses();

    expect(result.held).toBe(1);
  });
});
