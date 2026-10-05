/* Free demo credits are for demo classes only, tutors cannot complete a class
   before it starts, and fresh earnings are held before they can be withdrawn.
   These three rules together stop free credits turning into withdrawable cash. */
import { spendableCents } from '../../modules/wallets/wallet.service';
import { getWithdrawableCents, EARNINGS_HOLD_HOURS } from '../../modules/wallets/payout.service';
import { WalletTransactionModel } from '../../modules/wallets/wallet-transaction.model';
import { classService } from '../../modules/classes/class.service';
import { classPresenceService } from '../../modules/classes/class-presence.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { ClassStatus, ClassType, BillingMode } from '../../modules/schedules/schedule.types';

// Presence records are not part of these tests: keep every class on the join-time rule.
beforeEach(() => { jest.spyOn(classPresenceService, 'hasPresenceData').mockResolvedValue(false); });

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const MINUTE = 60_000;

describe('spendableCents — demo credits are not spendable on paid things', () => {
  it('excludes demo credits from what a paid class or course can use', () => {
    expect(spendableCents({ balanceCents: 10_000, demoCreditsCents: 10_000 })).toBe(0);
    expect(spendableCents({ balanceCents: 15_000, demoCreditsCents: 10_000 })).toBe(5_000);
  });

  it('is the whole balance when there are no demo credits', () => {
    expect(spendableCents({ balanceCents: 4_000 })).toBe(4_000);
    expect(spendableCents({ balanceCents: 4_000, demoCreditsCents: 0 })).toBe(4_000);
  });

  it('never goes negative when demo credits exceed the balance', () => {
    expect(spendableCents({ balanceCents: 500, demoCreditsCents: 1_000 })).toBe(0);
  });
});

describe('getWithdrawableCents — earnings hold', () => {
  const aggregate = (total: number | null) =>
    jest.spyOn(WalletTransactionModel, 'aggregate').mockReturnValue({
      session: () => Promise.resolve(total === null ? [] : [{ _id: null, total }]),
    } as never);

  afterEach(() => jest.restoreAllMocks());

  it('holds back earnings from the last hold window', async () => {
    aggregate(1_900); // earned in the last 48h
    await expect(
      getWithdrawableCents('tutor-1', { earnedCreditsCents: 1_900, balanceCents: 1_900 }),
    ).resolves.toBe(0);
  });

  it('lets older earnings through', async () => {
    aggregate(1_000);
    await expect(
      getWithdrawableCents('tutor-1', { earnedCreditsCents: 5_000, balanceCents: 5_000 }),
    ).resolves.toBe(4_000);
  });

  it('is limited by the wallet balance as well', async () => {
    aggregate(null);
    await expect(
      getWithdrawableCents('tutor-1', { earnedCreditsCents: 5_000, balanceCents: 3_000 }),
    ).resolves.toBe(3_000);
  });

  it('documents the hold length', () => {
    expect(EARNINGS_HOLD_HOURS).toBeGreaterThanOrEqual(24);
  });
});

describe('ClassService.completeClass — manual completion timing', () => {
  afterEach(() => jest.restoreAllMocks());

  function classAt(startOffsetMin: number, over: Record<string, unknown> = {}) {
    return {
      publicId: 'class-1',
      tutorPublicId: 'tutor-prof-1',
      studentPublicId: 'student-prof-1',
      status: ClassStatus.LIVE,
      classType: ClassType.ONE_ON_ONE,
      billingMode: BillingMode.STUDENT_REQUESTED,
      costCents: 2000,
      durationMinutes: 60,
      startUTC: new Date(Date.now() + startOffsetMin * MINUTE),
      endUTC: new Date(Date.now() + (startOffsetMin + 60) * MINUTE),
      studentJoinedAt: new Date(),
      tutorJoinedAt: new Date(),
      ...over,
    };
  }

  it('refuses to complete a class that has not started yet', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(classAt(30)) as never);
    const update = jest.spyOn(ScheduledClassModel, 'findOneAndUpdate');

    await expect(classService.completeClass('class-1', 'tutor-user-1', { manual: true }))
      .rejects.toThrow(/not started yet/i);
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses when the student joined moments ago and the class is far from over', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(classAt(-1)) as never);
    const update = jest.spyOn(ScheduledClassModel, 'findOneAndUpdate');

    await expect(classService.completeClass('class-1', 'tutor-user-1', { manual: true }))
      .rejects.toThrow(/minutes together|minute\(s\) ago/i);
    expect(update).not.toHaveBeenCalled();
  });
});
