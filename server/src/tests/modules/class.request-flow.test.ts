/* Tutor-created classes are requests: the student accepts first, and the hold (a balance
   check for the first 30-day block, nothing deducted) happens at accept time. */
import { classService } from '../../modules/classes/class.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { studentService } from '../../modules/students/student.service';
import { tutorService } from '../../modules/tutors/tutor.service';
import { walletService } from '../../modules/wallets/wallet.service';
import { settingsService } from '../../modules/settings/settings.service';
import { classPresenceService } from '../../modules/classes/class-presence.service';
import { attendanceService } from '../../modules/attendance/attendance.service';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { mockNoBundleHold } from '../helpers/no-bundle-hold';
import { BillingMode, ClassStatus, RequestStatus, ClassType } from '../../modules/schedules/schedule.types';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
const base = (over: object = {}) => ({
  title: 'Algebra', classType: 'GROUP', recurrence: 'NONE', studentPublicIds: ['s1', 's2'],
  startUTC: iso(DAY), endUTC: iso(DAY + HOUR), ...over,
}) as never;

describe('creating a class request', () => {
  let create: jest.SpyInstance;
  let emit: jest.SpyInstance;
  let getWallet: jest.SpyInstance;
  let rate = 2000;

  beforeEach(() => {
    jest.restoreAllMocks();
    rate = 2000;
    jest.spyOn(tutorService, 'getByUserPublicId').mockImplementation((async () => ({
      publicId: 'tp1', userPublicId: 'tu1', hourlyRateCents: rate,
    })) as never);
    jest.spyOn(StudentProfileModel, 'find').mockReturnValue(lean([
      { publicId: 's1', userPublicId: 'su1' }, { publicId: 's2', userPublicId: 'su2' },
    ]) as never);
    jest.spyOn(settingsService, 'get').mockResolvedValue({ maxAdvanceBookingDays: 30, minClassDurationMinutes: 30, maxClassDurationMinutes: 180 } as never);
    getWallet = jest.spyOn(walletService, 'getWallet').mockResolvedValue({ balanceCents: 0 } as never);
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(null) as never);
    create = jest.spyOn(ScheduledClassModel, 'create').mockImplementation((async (d: object) => ({ toObject: () => d })) as never);
    emit = jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
  });

  it('creates a pending, priced request per student; the tutor needs no credits', async () => {
    await classService.tutorCreateClasses('tu1', base());
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0]).toMatchObject({
      billingMode: BillingMode.TUTOR_REQUESTED,
      requestStatus: RequestStatus.PENDING,
      status: ClassStatus.SCHEDULED,
      costCents: 2000, // the tutor's own hourly rate by default, for a 60 minute class
      pricePerHourCents: 2000,
    });
    expect(getWallet).not.toHaveBeenCalled(); // no tutor wallet check
  });

  it('uses the price the tutor typed, scaled by the class length', async () => {
    await classService.tutorCreateClasses('tu1', base({ pricePerHourCents: 3000, endUTC: iso(DAY + HOUR / 2) }));
    expect(create.mock.calls[0][0]).toMatchObject({ costCents: 1500, pricePerHourCents: 3000 });
  });

  it('allows a free class (price 0)', async () => {
    await classService.tutorCreateClasses('tu1', base({ pricePerHourCents: 0 }));
    expect(create.mock.calls[0][0]).toMatchObject({ costCents: 0, requestStatus: RequestStatus.PENDING });
  });

  it('puts every session and every student of one request in one series', async () => {
    await classService.tutorCreateClasses('tu1', base({
      recurrence: 'DAILY', recurrenceEndDate: iso(DAY + DAY + HOUR), startUTC: iso(DAY), endUTC: iso(DAY + HOUR),
    }));
    const series = create.mock.calls.map(([d]) => d.seriesPublicId);
    expect(series).toHaveLength(4); // 2 sessions x 2 students
    expect(series[0]).toBeTruthy();
    expect(new Set(series).size).toBe(1);
  });

  it('tells students it is a request with the price of one session, and does not announce a booking', async () => {
    await classService.tutorCreateClasses('tu1', base());
    expect(emit.mock.calls.some(([e]) => e === DomainEvent.CLASS_BOOKED)).toBe(false);
    const created = emit.mock.calls.find(([e]) => e === DomainEvent.CLASS_CREATED_BY_TUTOR);
    expect(created?.[1]).toMatchObject({ requiresAcceptance: true, studentChargeCents: 2100 });
  });

  it('keeps demo classes on the old model: no request, tutor-paid', async () => {
    getWallet.mockResolvedValue({ balanceCents: 1_000_000 });
    await classService.tutorCreateClasses('tu1', base({ classType: 'DEMO' }));
    expect(create.mock.calls[0][0]).toMatchObject({ billingMode: BillingMode.TUTOR_INVITED, costCents: 0 });
    expect(create.mock.calls[0][0].requestStatus).toBeUndefined();
  });
});

describe('answering a class request', () => {
  const pending = (over: Record<string, unknown> = {}) => ({
    publicId: 'c1', tutorPublicId: 'tp1', studentPublicId: 'sp1', title: 'Algebra',
    status: ClassStatus.SCHEDULED, billingMode: BillingMode.TUTOR_REQUESTED,
    requestStatus: RequestStatus.PENDING, seriesPublicId: 'series-1', costCents: 2000,
    startUTC: new Date(Date.now() + DAY), ...over,
  });
  const sessions = (n: number, cost = 2000) =>
    Array.from({ length: n }, (_, i) => ({ costCents: cost, startUTC: new Date(Date.now() + DAY + i * DAY) }));

  let updateMany: jest.SpyInstance;
  let emit: jest.SpyInstance;
  let lock: jest.SpyInstance;
  let reserved: { student: { totalCents: number; count: number } | null; tutor: { totalCents: number; count: number } | null };

  function arrange(balanceCents: number, series = sessions(3), cls = pending()) {
    jest.restoreAllMocks();
    reserved = { student: null, tutor: null };
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(cls) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp1' }) as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'tu1' }) as never);
    jest.spyOn(ScheduledClassModel, 'find').mockReturnValue({ sort: () => lean(series) } as never);
    updateMany = jest.spyOn(ScheduledClassModel, 'updateMany').mockResolvedValue({ modifiedCount: series.length } as never);
    jest.spyOn(ScheduledClassModel, 'aggregate').mockImplementation(((pipeline: Array<{ $match: { billingMode?: string } }>) => ({
      session: () => Promise.resolve(
        pipeline[0].$match.billingMode === BillingMode.TUTOR_REQUESTED
          ? (reserved.tutor ? [reserved.tutor] : [])
          : (reserved.student ? [reserved.student] : []),
      ),
    })) as never);
    jest.spyOn(studentService, 'getProfileIdsByUser').mockResolvedValue(['sp1']);
    jest.spyOn(walletService, 'getWallet').mockResolvedValue({ balanceCents } as never);
    lock = jest.spyOn(walletService, 'runWithBookingLock').mockImplementation(
      (async (_o: string, fn: (c: unknown) => unknown) => fn({ session: { id: 's' }, wallet: { balanceCents } })) as never,
    );
    emit = jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
    mockNoBundleHold();
  }

  it('is refused for a student whose profile does not own the class', async () => {
    arrange(10_000);
    (StudentProfileModel.findOne as jest.Mock).mockReturnValue(lean(null));
    await expect(classService.respondToRequest('c1', 'su-other', 'ACCEPT')).rejects.toThrow(/not found/i);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ['already answered', { requestStatus: RequestStatus.ACCEPTED }],
    ['not a request at all', { billingMode: BillingMode.STUDENT_REQUESTED, requestStatus: undefined }],
  ])('is refused when the class is %s', async (_n, over) => {
    arrange(10_000, sessions(3), pending(over));
    await expect(classService.respondToRequest('c1', 'su1', 'ACCEPT')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('is refused once the class has started (the request has expired)', async () => {
    arrange(10_000, sessions(3), pending({ startUTC: new Date(Date.now() - 1000) }));
    await expect(classService.respondToRequest('c1', 'su1', 'ACCEPT')).rejects.toThrow(/expired/);
  });

  describe('accept', () => {
    it('with enough balance for the sessions plus fees: accepts the whole series and funds the block', async () => {
      arrange(6300); // 3 sessions x (2000 + 100)
      const res = await classService.respondToRequest('c1', 'su1', 'ACCEPT');

      expect(res.accepted).toBe(3);
      expect(lock).toHaveBeenCalledTimes(1);
      const [filter, update, opts] = updateMany.mock.calls[0];
      expect(filter).toMatchObject({ seriesPublicId: 'series-1', studentPublicId: 'sp1', requestStatus: RequestStatus.PENDING });
      expect(update.$set).toMatchObject({ requestStatus: RequestStatus.ACCEPTED });
      expect(update.$set.fundedThrough).toBeInstanceOf(Date);
      expect(opts).toEqual({ session: { id: 's' } }); // written inside the booking lock
      expect(emit).toHaveBeenCalledWith(DomainEvent.CLASS_REQUEST_RESPONDED, expect.objectContaining({
        answer: 'ACCEPTED', sessions: 3, tutorUserPublicId: 'tu1', studentUserPublicId: 'su1',
      }));
    });

    it('with one credit too little: 402 that says what is needed, nothing accepted', async () => {
      arrange(6299);
      await expect(classService.respondToRequest('c1', 'su1', 'ACCEPT')).rejects.toMatchObject({
        statusCode: 402, message: expect.stringContaining('63 credits'),
      });
      expect(updateMany).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
    });

    it('counts money already promised to the student\'s own bookings and other accepted classes', async () => {
      arrange(8000);
      reserved.student = { totalCents: 2000, count: 1 }; // 2000 + 100 fee
      reserved.tutor = { totalCents: 2000, count: 1 };    // 2000 + 100 fee
      // 8000 available, 2100 + 2100 reserved, 6300 needed
      await expect(classService.respondToRequest('c1', 'su1', 'ACCEPT')).rejects.toMatchObject({ statusCode: 402 });
    });

    it('accepts when what is reserved plus what is needed exactly fits', async () => {
      arrange(10_500);
      reserved.student = { totalCents: 2000, count: 1 };
      reserved.tutor = { totalCents: 2000, count: 1 };
      await expect(classService.respondToRequest('c1', 'su1', 'ACCEPT')).resolves.toMatchObject({ accepted: 3 });
    });

    it('only asks for the first 30 days of a long series', async () => {
      // 40 daily sessions, but only the first 30 days (30 sessions) need to be covered.
      arrange(30 * 2100 - 1, sessions(40));
      await expect(classService.respondToRequest('c1', 'su1', 'ACCEPT')).rejects.toMatchObject({ statusCode: 402 });

      arrange(30 * 2100, sessions(40));
      await expect(classService.respondToRequest('c1', 'su1', 'ACCEPT')).resolves.toMatchObject({ accepted: 40 });
      const fundedThrough: Date = updateMany.mock.calls[0][1].$set.fundedThrough;
      const first = Date.now() + DAY;
      expect(Math.round((fundedThrough.getTime() - first) / DAY)).toBe(30);
    });

    it('a free class needs no balance and takes no lock', async () => {
      arrange(0, sessions(2, 0), pending({ costCents: 0 }));
      await expect(classService.respondToRequest('c1', 'su1', 'ACCEPT')).resolves.toMatchObject({ accepted: 2 });
      expect(lock).not.toHaveBeenCalled();
    });
  });

  describe('decline', () => {
    it('cancels only this student\'s open sessions and tells the tutor', async () => {
      arrange(0);
      const res = await classService.respondToRequest('c1', 'su1', 'DECLINE');

      expect(res.accepted).toBe(0);
      const [filter, update] = updateMany.mock.calls[0];
      expect(filter).toMatchObject({ studentPublicId: 'sp1', seriesPublicId: 'series-1', requestStatus: RequestStatus.PENDING });
      expect(update.$set).toMatchObject({
        status: ClassStatus.CANCELLED, requestStatus: RequestStatus.DECLINED, cancelledBy: 'su1',
      });
      expect(lock).not.toHaveBeenCalled(); // nothing is held for a decline
      expect(emit).toHaveBeenCalledWith(DomainEvent.CLASS_REQUEST_RESPONDED, expect.objectContaining({ answer: 'DECLINED' }));
    });
  });
});

describe('a request nobody accepted cannot run or be billed', () => {
  const cls = (over: Record<string, unknown> = {}) => ({
    publicId: 'c1', tutorPublicId: 'tp1', studentPublicId: 'sp1', title: 'Algebra', classType: ClassType.GROUP,
    status: ClassStatus.SCHEDULED, billingMode: BillingMode.TUTOR_REQUESTED, costCents: 2000,
    requestStatus: RequestStatus.PENDING,
    startUTC: new Date(Date.now() - 10 * 60_000), endUTC: new Date(Date.now() + 50 * 60_000), durationMinutes: 60,
    ...over,
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(classPresenceService, 'hasPresenceData').mockResolvedValue(false);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp1' }) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp1', userPublicId: 'su1' }) as never);
  });

  it('the student cannot join before accepting', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(cls()) as never);
    await expect(classService.joinClass('c1', 'su1', 'STUDENT')).rejects.toThrow(/not accepted/);
  });

  it('the tutor cannot start it before the student accepts', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(cls()) as never);
    const update = jest.spyOn(ScheduledClassModel, 'findOneAndUpdate');
    await expect(classService.startClass('c1', 'tu1')).rejects.toThrow(/not accepted/);
    expect(update).not.toHaveBeenCalled();
  });

  it('a session beyond the funded block cannot be joined until the next block is funded', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(cls({
      requestStatus: RequestStatus.ACCEPTED, fundedThrough: new Date(Date.now() - DAY),
    })) as never);
    await expect(classService.joinClass('c1', 'su1', 'STUDENT')).rejects.toThrow(/not funded/);
  });

  it('an accepted, funded session can be joined', async () => {
    const accepted = cls({ requestStatus: RequestStatus.ACCEPTED, fundedThrough: new Date(Date.now() + 20 * DAY) });
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(accepted) as never);
    jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(lean({ ...accepted, status: ClassStatus.LIVE }) as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
    await expect(classService.joinClass('c1', 'su1', 'STUDENT')).resolves.toBeDefined();
  });

  it('it cannot be completed (so it can never be billed)', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(cls()) as never);
    const update = jest.spyOn(ScheduledClassModel, 'findOneAndUpdate');
    await expect(classService.completeClass('c1', 'tu1')).rejects.toThrow(/not accepted/);
    expect(update).not.toHaveBeenCalled();
  });

  it('an accepted request is billed like a student booking: student pays price + fee, tutor earns price - fee', async () => {
    const accepted = cls({
      requestStatus: RequestStatus.ACCEPTED, fundedThrough: new Date(Date.now() + 20 * DAY),
      status: ClassStatus.LIVE, studentJoinedAt: new Date(), tutorJoinedAt: new Date(),
      endUTC: new Date(Date.now() - 1000), startUTC: new Date(Date.now() - 61 * 60_000),
    });
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(accepted) as never);
    jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(lean({ ...accepted, status: ClassStatus.COMPLETED }) as never);
    jest.spyOn(tutorService, 'getByPublicId').mockResolvedValue({ userPublicId: 'tu1' } as never);
    jest.spyOn(tutorService, 'recordClassCompleted').mockResolvedValue(undefined as never);
    jest.spyOn(attendanceService, 'markAttendance').mockResolvedValue({} as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
    const transfer = jest.spyOn(walletService, 'transferWallet').mockResolvedValue({} as never);

    await classService.completeClass('c1', 'tu1');

    expect(transfer.mock.calls[0][0]).toMatchObject({
      fromOwnerPublicId: 'su1', toOwnerPublicId: 'tu1', debitAmountCents: 2100, creditAmountCents: 1900,
    });
  });
});

describe('cancelling and reminders', () => {
  it('cancelling a request the student never accepted costs the tutor no cancellation fee', async () => {
    jest.restoreAllMocks();
    const soon = {
      publicId: 'c1', tutorPublicId: 'tp1', studentPublicId: 'sp1', title: 'Algebra', classType: ClassType.GROUP,
      status: ClassStatus.SCHEDULED, billingMode: BillingMode.TUTOR_REQUESTED, requestStatus: RequestStatus.PENDING,
      costCents: 2000, startUTC: new Date(Date.now() + 2 * HOUR), // late enough that a fee would normally apply
    };
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(soon) as never);
    jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(lean({ ...soon, status: ClassStatus.CANCELLED }) as never);
    jest.spyOn(tutorService, 'recordClassCancelled').mockResolvedValue(undefined as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'tu1' }) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'su1' }) as never);
    jest.spyOn(ScheduledClassModel, 'countDocuments').mockResolvedValue(0 as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
    const debit = jest.spyOn(walletService, 'debitWallet').mockResolvedValue({} as never);

    await classService.cancelClass('c1', 'tu1', { reason: 'Changed plans' } as never);

    expect(debit).not.toHaveBeenCalled();
  });
});
