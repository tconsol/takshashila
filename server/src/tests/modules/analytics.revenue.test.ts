import { AnalyticsService } from '../../modules/analytics/analytics.service';
import { WalletTransactionModel } from '../../modules/wallets/wallet-transaction.model';
import { UserModel } from '../../modules/users/user.model';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { TransactionType, CreditType, TransactionStatus } from '../../modules/wallets/wallet.types';

/** Does a row satisfy a $match (equality, $in and $or, as the service uses them)? */
function matches(row: Record<string, any>, m: Record<string, any>): boolean {
  return Object.entries(m).every(([k, v]) => {
    if (k === 'createdAt') return true;
    if (k === '$or') return (v as Array<Record<string, any>>).some((clause) => matches(row, clause));
    if (v && typeof v === 'object' && Array.isArray(v.$in)) return v.$in.includes(row[k]);
    return row[k] === v;
  });
}

/** Fake aggregate: inspects the $match so the test proves what is (not) counted.
    Refunds and reversals are netted out, as the real pipeline does. */
function fakeAggregate(rows: Array<Record<string, unknown>>) {
  return (pipeline: Array<Record<string, any>>) => {
    const m = pipeline[0].$match as Record<string, any>;
    const total = rows
      .filter((r) => matches(r, m))
      .reduce((s, r) => s + (r.type === TransactionType.REFUND || r.type === TransactionType.REVERSAL
        ? -(r.amountCents as number)
        : (r.amountCents as number)), 0);
    return Promise.resolve(total ? [{ _id: null, totalCents: total }] : []);
  };
}

const TX = [
  { type: TransactionType.DEBIT, status: TransactionStatus.COMPLETED, amountCents: 10000 },
  { type: TransactionType.DEBIT, status: TransactionStatus.PENDING, amountCents: 999 },
  { type: TransactionType.CREDIT, creditType: CreditType.EARNED_CREDITS, status: TransactionStatus.COMPLETED, amountCents: 7000 },
  { type: TransactionType.CREDIT, creditType: CreditType.BONUS_CREDITS, status: TransactionStatus.COMPLETED, amountCents: 50000 },
  { type: TransactionType.CREDIT, creditType: CreditType.PURCHASED_CREDITS, status: TransactionStatus.COMPLETED, amountCents: 20000 },
];

describe('AnalyticsService revenue', () => {
  const service = new AnalyticsService();
  let agg: jest.SpyInstance;

  beforeEach(() => {
    agg = jest.spyOn(WalletTransactionModel, 'aggregate').mockImplementation(fakeAggregate(TX) as never);
  });

  it('counts only completed DEBITs as revenue; bonus/purchased credits are ignored', async () => {
    const r = await service.getPlatformRevenue();
    expect(r.totalCents).toBe(10000);
    expect(r.tutorEarningsCents).toBe(7000);
    expect(r.platformCommissionCents).toBe(3000);
  });

  it('subtracts refunds from revenue and clawbacks from tutor earnings', async () => {
    agg.mockImplementation(fakeAggregate([
      ...TX,
      { type: TransactionType.REFUND, status: TransactionStatus.COMPLETED, amountCents: 2100 },
      { type: TransactionType.REVERSAL, status: TransactionStatus.COMPLETED, amountCents: 1900 },
    ]) as never);
    const r = await service.getPlatformRevenue();
    expect(r.totalCents).toBe(10000 - 2100);
    expect(r.tutorEarningsCents).toBe(7000 - 1900);
  });

  it('never reports negative commission', async () => {
    agg.mockImplementation(fakeAggregate([
      { type: TransactionType.DEBIT, status: TransactionStatus.COMPLETED, amountCents: 100 },
      { type: TransactionType.CREDIT, creditType: CreditType.EARNED_CREDITS, status: TransactionStatus.COMPLETED, amountCents: 500 },
    ]) as never);
    expect((await service.getPlatformRevenue()).platformCommissionCents).toBe(0);
  });

  it('returns zeros for an empty ledger', async () => {
    agg.mockResolvedValue([] as never);
    expect(await service.getPlatformRevenue()).toEqual({ totalCents: 0, tutorEarningsCents: 0, platformCommissionCents: 0 });
  });

  it('applies the date range to both queries; lifetime adds no createdAt filter', async () => {
    const from = new Date('2026-01-01');
    const to = new Date('2026-02-01');
    await service.getPlatformRevenue({ from, to });
    for (const call of agg.mock.calls) {
      expect(call[0][0].$match.createdAt).toEqual({ $gte: from, $lt: to });
    }
    agg.mockClear();
    await service.getPlatformRevenue();
    for (const call of agg.mock.calls) expect(call[0][0].$match).not.toHaveProperty('createdAt');
  });

  it('getPlatformOverview reports revenue from getPlatformRevenue (not summed credits)', async () => {
    jest.spyOn(UserModel, 'countDocuments').mockResolvedValue(1 as never);
    jest.spyOn(ScheduledClassModel, 'countDocuments').mockResolvedValue(1 as never);
    const overview = await service.getPlatformOverview();
    expect(overview.totalRevenueCents).toBe(10000);
    expect(overview.tutorEarningsCents).toBe(7000);
    expect(overview.platformCommissionCents).toBe(3000);
    expect(overview.revenueWindow).toBe('lifetime');
  });
});
