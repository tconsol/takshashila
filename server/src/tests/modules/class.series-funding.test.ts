/* Recurring requests are funded in 30-day blocks: the student funds the next block from 15 days
   before it starts; if it is not funded by its first session, the rest of the series is cancelled. */
import { classService } from '../../modules/classes/class.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { studentService } from '../../modules/students/student.service';
import { walletService } from '../../modules/wallets/wallet.service';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { BillingMode, ClassStatus, RequestStatus } from '../../modules/schedules/schedule.types';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const DAY = 86_400_000;
const at = (days: number) => new Date(Date.now() + days * DAY);

const accepted = (over: Record<string, unknown> = {}) => ({
  publicId: 'c1', tutorPublicId: 'tp1', studentPublicId: 'sp1', title: 'Algebra', seriesPublicId: 'series-1',
  billingMode: BillingMode.TUTOR_REQUESTED, requestStatus: RequestStatus.ACCEPTED, status: ClassStatus.SCHEDULED,
  costCents: 2000, ...over,
});
/** Daily sessions from `firstDay` for `n` days, all unfunded (the funded block ended 1 day before the first). */
const unfundedSeries = (firstDay: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ costCents: 2000, startUTC: at(firstDay + i), fundedThrough: at(firstDay - 1) }));

describe('fundNextBlock', () => {
  let updateMany: jest.SpyInstance;
  let lock: jest.SpyInstance;
  let emit: jest.SpyInstance;

  function arrange(balanceCents: number, sessions = unfundedSeries(10, 3), cls = accepted()) {
    jest.restoreAllMocks();
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(cls) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp1' }) as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'tu1' }) as never);
    jest.spyOn(ScheduledClassModel, 'find').mockReturnValue({ sort: () => lean(sessions) } as never);
    updateMany = jest.spyOn(ScheduledClassModel, 'updateMany').mockResolvedValue({ modifiedCount: sessions.length } as never);
    jest.spyOn(ScheduledClassModel, 'aggregate').mockReturnValue({ session: () => Promise.resolve([]) } as never);
    jest.spyOn(studentService, 'getProfileIdsByUser').mockResolvedValue(['sp1']);
    jest.spyOn(walletService, 'getWallet').mockResolvedValue({ balanceCents } as never);
    lock = jest.spyOn(walletService, 'runWithBookingLock').mockImplementation(
      (async (_o: string, fn: (c: unknown) => unknown) => fn({ session: { id: 's' }, wallet: { balanceCents } })) as never,
    );
    emit = jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
  }

  it('is refused for someone whose profile does not own the class', async () => {
    arrange(10_000);
    (StudentProfileModel.findOne as jest.Mock).mockReturnValue(lean(null));
    await expect(classService.fundNextBlock('c1', 'su-other')).rejects.toThrow(/not found/i);
  });

  it.each([
    ['not accepted', { requestStatus: RequestStatus.PENDING }],
    ['not a request', { billingMode: BillingMode.STUDENT_REQUESTED, requestStatus: undefined }],
  ])('is refused for a class that is %s', async (_n, over) => {
    arrange(10_000, unfundedSeries(10, 3), accepted(over));
    await expect(classService.fundNextBlock('c1', 'su1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('is refused when every upcoming session is already funded', async () => {
    arrange(10_000, [{ costCents: 2000, startUTC: at(3), fundedThrough: at(30) }]);
    await expect(classService.fundNextBlock('c1', 'su1')).rejects.toThrow(/already funded/);
  });

  it('is refused until 15 days before the next block starts', async () => {
    arrange(10_000, unfundedSeries(20, 3)); // first unfunded session in 20 days: opens in 5 days
    await expect(classService.fundNextBlock('c1', 'su1')).rejects.toThrow(/You can fund the next 30 days from/);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('opens exactly 15 days before: funds the block, anchored on its first session', async () => {
    arrange(6300, unfundedSeries(14.9, 3)); // 3 x (2000 + 100)
    const res = await classService.fundNextBlock('c1', 'su1');

    expect(res.funded).toBe(3);
    const firstStart = Date.now() + 14.9 * DAY;
    expect(Math.round((res.fundedThrough.getTime() - firstStart) / DAY)).toBe(30);
    const [filter, update, opts] = updateMany.mock.calls[0];
    expect(filter).toMatchObject({ studentPublicId: 'sp1', seriesPublicId: 'series-1', requestStatus: RequestStatus.ACCEPTED });
    expect(update.$set.fundedThrough).toEqual(res.fundedThrough);
    expect(opts).toEqual({ session: { id: 's' } });
    expect(emit).toHaveBeenCalledWith(DomainEvent.CLASS_REQUEST_RESPONDED, expect.objectContaining({ answer: 'FUNDED', sessions: 3 }));
  });

  it('one credit short: 402 saying what is needed, nothing extended', async () => {
    arrange(6299, unfundedSeries(10, 3));
    await expect(classService.fundNextBlock('c1', 'su1')).rejects.toMatchObject({
      statusCode: 402, message: expect.stringContaining('63 credits'),
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('asks only for the sessions of the next 30 days, not the whole rest of the series', async () => {
    arrange(30 * 2100 - 1, unfundedSeries(10, 45));
    await expect(classService.fundNextBlock('c1', 'su1')).rejects.toMatchObject({ statusCode: 402 });
    arrange(30 * 2100, unfundedSeries(10, 45));
    await expect(classService.fundNextBlock('c1', 'su1')).resolves.toMatchObject({ funded: 30 });
  });

  it('a free block needs no balance and takes no lock', async () => {
    arrange(0, unfundedSeries(10, 3).map((s) => ({ ...s, costCents: 0 })));
    await expect(classService.fundNextBlock('c1', 'su1')).resolves.toMatchObject({ funded: 3 });
    expect(lock).not.toHaveBeenCalled();
  });
});

describe('cancelUnfundedSeries', () => {
  let updateMany: jest.SpyInstance;
  let emit: jest.SpyInstance;
  let debit: jest.SpyInstance;
  const due = (publicId: string, student: string, series = 'series-1') => ({
    publicId, studentPublicId: student, tutorPublicId: 'tp1', seriesPublicId: series, title: 'Algebra',
  });

  function arrange(rows: unknown[], modified = 5) {
    jest.restoreAllMocks();
    jest.spyOn(ScheduledClassModel, 'find').mockReturnValue({ limit: () => lean(rows) } as never);
    updateMany = jest.spyOn(ScheduledClassModel, 'updateMany').mockResolvedValue({ modifiedCount: modified } as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockImplementation(((q: { publicId: string }) =>
      lean({ userPublicId: q.publicId === 'sp1' ? 'su1' : 'su2' })) as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'tu1' }) as never);
    emit = jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
    debit = jest.spyOn(walletService, 'debitWallet');
    jest.spyOn(walletService, 'refundWallet');
  }

  it('looks for scheduled, accepted sessions that have begun without being funded', async () => {
    arrange([]);
    const now = new Date();
    await classService.cancelUnfundedSeries(now);
    const filter = (ScheduledClassModel.find as jest.Mock).mock.calls[0][0];
    expect(filter).toMatchObject({
      billingMode: BillingMode.TUTOR_REQUESTED, requestStatus: RequestStatus.ACCEPTED, status: ClassStatus.SCHEDULED,
      startUTC: { $lte: now }, $expr: { $gte: ['$startUTC', '$fundedThrough'] },
    });
  });

  it('does nothing when nothing is due', async () => {
    arrange([]);
    await expect(classService.cancelUnfundedSeries()).resolves.toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('cancels every remaining unfunded session of that student\'s series, with no money moving', async () => {
    arrange([due('c1', 'sp1')], 5);
    await expect(classService.cancelUnfundedSeries()).resolves.toBe(5);

    const [filter, update] = updateMany.mock.calls[0];
    expect(filter).toMatchObject({ studentPublicId: 'sp1', seriesPublicId: 'series-1', status: ClassStatus.SCHEDULED });
    expect(update.$set).toMatchObject({ status: ClassStatus.CANCELLED, cancelledBy: 'system' });
    expect(debit).not.toHaveBeenCalled();
    expect(walletService.refundWallet).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(DomainEvent.CLASS_REQUEST_RESPONDED, expect.objectContaining({
      answer: 'UNFUNDED', sessions: 5, tutorUserPublicId: 'tu1', studentUserPublicId: 'su1',
    }));
  });

  it('handles each student series once, however many sessions of it are due', async () => {
    arrange([due('c1', 'sp1'), due('c2', 'sp1')], 4);
    await classService.cancelUnfundedSeries();
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls.filter(([e]) => e === DomainEvent.CLASS_REQUEST_RESPONDED)).toHaveLength(1);
  });

  it('in a group only the student who did not fund loses their sessions', async () => {
    arrange([due('c1', 'sp1')], 3); // student sp2 funded, so none of their records is due
    await classService.cancelUnfundedSeries();
    expect(updateMany.mock.calls[0][0]).toMatchObject({ studentPublicId: 'sp1' });
    expect(updateMany.mock.calls[0][0].studentPublicId).not.toBe('sp2');
  });

  it('says nothing when another run already cancelled them', async () => {
    arrange([due('c1', 'sp1')], 0);
    await expect(classService.cancelUnfundedSeries()).resolves.toBe(0);
    expect(emit).not.toHaveBeenCalled();
  });
});

describe('sendFundingReminders', () => {
  let updateMany: jest.SpyInstance;
  let emit: jest.SpyInstance;
  const now = new Date();
  const candidate = (over: Record<string, unknown> = {}) => ({
    publicId: 'c1', studentPublicId: 'sp1', seriesPublicId: 'series-1', title: 'Algebra', ...over,
  });

  function arrange(rows: unknown[], unfunded = unfundedSeries(10, 3)) {
    jest.restoreAllMocks();
    const find = jest.spyOn(ScheduledClassModel, 'find');
    // 1st: candidates (sort -> limit -> lean); then each series' unfunded sessions (sort -> lean)
    find.mockReturnValueOnce({ sort: () => ({ limit: () => lean(rows) }) } as never);
    find.mockReturnValue({ sort: () => lean(unfunded) } as never);
    updateMany = jest.spyOn(ScheduledClassModel, 'updateMany').mockResolvedValue({ modifiedCount: 3 } as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'su1' }) as never);
    emit = jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
  }

  it('reminds a student whose next block starts within 15 days, with the sessions and credits to fund', async () => {
    arrange([candidate()]);
    await expect(classService.sendFundingReminders(now)).resolves.toBe(1);
    expect(emit).toHaveBeenCalledWith(DomainEvent.CLASS_FUNDING_REMINDER, expect.objectContaining({
      studentUserPublicId: 'su1', sessions: 3, needCents: 6300, title: 'Algebra',
    }));
    expect(updateMany.mock.calls[0][1]).toEqual({ $set: { fundingReminderAt: now } });
  });

  it('only counts the next 30 days in the amount', async () => {
    arrange([candidate()], unfundedSeries(10, 45));
    await classService.sendFundingReminders(now);
    expect(emit.mock.calls[0][1]).toMatchObject({ sessions: 30, needCents: 30 * 2100 });
  });

  it('reminds at most once a day', async () => {
    arrange([candidate({ fundingReminderAt: new Date(now.getTime() - 3 * 3_600_000) })]);
    await expect(classService.sendFundingReminders(now)).resolves.toBe(0);
    expect(emit).not.toHaveBeenCalled();
  });

  it('reminds again after a day', async () => {
    arrange([candidate({ fundingReminderAt: new Date(now.getTime() - 25 * 3_600_000) })]);
    await expect(classService.sendFundingReminders(now)).resolves.toBe(1);
  });

  it('one reminder per student series however many of its sessions are close', async () => {
    arrange([candidate(), candidate({ publicId: 'c2' })]);
    await expect(classService.sendFundingReminders(now)).resolves.toBe(1);
  });

  it('skips a series that turns out to be fully funded', async () => {
    arrange([candidate()], []);
    await expect(classService.sendFundingReminders(now)).resolves.toBe(0);
    expect(emit).not.toHaveBeenCalled();
  });
});
