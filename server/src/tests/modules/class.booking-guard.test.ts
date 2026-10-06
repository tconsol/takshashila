/* bookClass overbooking guard: the balance check + class insert must run inside
   walletService.runWithBookingLock (a transaction that writes the student's
   wallet first) so parallel bookings for one student serialize. */
import { classService } from '../../modules/classes/class.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { scheduleService } from '../../modules/schedules/schedule.service';
import { walletService } from '../../modules/wallets/wallet.service';
import { tutorService } from '../../modules/tutors/tutor.service';
import { studentService } from '../../modules/students/student.service';
import { settingsService } from '../../modules/settings/settings.service';
import { domainEvents } from '../../events/event-emitter';
import { ClassType, BillingMode } from '../../modules/schedules/schedule.types';
import { mockNoBundleHold } from '../helpers/no-bundle-hold';
import { CourseModel } from '../../modules/courses/course.model';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const dto = {
  idempotencyKey: 'k1', availabilitySlotPublicId: 'slot-1', tutorPublicId: 'tutor-1',
  classType: ClassType.ONE_ON_ONE, title: 'Physics',
} as never;

describe('ClassService.bookClass overbooking guard', () => {
  let lock: jest.SpyInstance;
  let create: jest.SpyInstance;
  let release: jest.SpyInstance;
  let aggregate: jest.SpyInstance;
  const session = { id: 'sess' };

  function setup(balanceCents: number, outstanding: { totalCents: number; count: number } | null, rate = 2000) {
    jest.restoreAllMocks();
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(null) as never);
    jest.spyOn(scheduleService, 'getSlotByPublicId').mockResolvedValue({
      publicId: 'slot-1', tutorPublicId: 'tutor-1', startUTC: new Date(), endUTC: new Date(), ianaTimezone: 'UTC', durationMinutes: 60,
    } as never);
    jest.spyOn(tutorService, 'getByPublicId').mockResolvedValue({ userPublicId: 'tutor-user-1', hourlyRateCents: rate, status: 'ACTIVE' } as never);
    jest.spyOn(settingsService, 'isFeatureEnabled').mockResolvedValue(true);
    jest.spyOn(settingsService, 'get').mockResolvedValue({ maxAdvanceBookingDays: 30, minClassDurationMinutes: 30, maxClassDurationMinutes: 180 } as never);
    jest.spyOn(studentService, 'getByUserPublicId').mockResolvedValue({ publicId: 'student-prof-1' } as never);
    jest.spyOn(studentService, 'getProfileIdsByUser').mockResolvedValue(['student-prof-1']);
    jest.spyOn(walletService, 'getWallet').mockResolvedValue({ balanceCents } as never);
    jest.spyOn(scheduleService, 'blockSlot').mockResolvedValue(undefined as never);
    release = jest.spyOn(scheduleService, 'releaseSlot').mockResolvedValue(undefined as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
    lock = jest.spyOn(walletService, 'runWithBookingLock').mockImplementation(
      (async (_owner: string, fn: (c: unknown) => unknown) => fn({ session, wallet: { balanceCents } })) as never,
    );
    // First query: the student's own bookings. Second: accepted tutor-created classes (none here).
    aggregate = jest.spyOn(ScheduledClassModel, 'aggregate').mockImplementation(((pipeline: Array<{ $match?: { billingMode?: string } }>) => ({
      session: () => Promise.resolve(
        pipeline[0].$match?.billingMode === BillingMode.TUTOR_REQUESTED ? [] : (outstanding ? [outstanding] : []),
      ),
    })) as never);
    const doc = { publicId: 'c1', toObject: () => ({ publicId: 'c1' }) };
    create = jest.spyOn(ScheduledClassModel, 'create').mockImplementation(
      (async (docs: unknown) => (Array.isArray(docs) ? [doc] : doc)) as never,
    );
    mockNoBundleHold();
  }

  it('books inside the lock, passing the session to aggregate and create', async () => {
    setup(5000, null); // needs 2000 + 100 fee
    const res = await classService.bookClass('student-user-1', dto);
    expect(res).toMatchObject({ publicId: 'c1' });
    expect(lock).toHaveBeenCalledWith('student-user-1', expect.any(Function));
    expect(create.mock.calls[0][1]).toEqual({ session });
    expect(create.mock.calls[0][0][0]).toMatchObject({ billingMode: BillingMode.STUDENT_REQUESTED, costCents: 2000 });
  });

  it('rejects with 402 when balance does not cover outstanding + new class, and releases the slot', async () => {
    // 1 outstanding 2000 class: owed = 2000 + 2*100 + 2000 = 4200 > 4000
    setup(4000, { totalCents: 2000, count: 1 });
    await expect(classService.bookClass('student-user-1', dto)).rejects.toMatchObject({ statusCode: 402 });
    expect(create).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledWith('slot-1');
    expect(aggregate.mock.calls[0][0][0].$match).toMatchObject({
      billingMode: BillingMode.STUDENT_REQUESTED,
      studentPublicId: { $in: ['student-prof-1'] },
    });
  });

  it('counts credits held for a course against the new booking (402)', async () => {
    setup(5000, null);
    jest.spyOn(CourseModel, 'aggregate').mockReturnValue({ session: () => Promise.resolve([{ totalCents: 5000 }]) } as never);
    await expect(classService.bookClass('student-user-1', dto)).rejects.toMatchObject({
      statusCode: 402, message: expect.stringMatching(/on hold for your other bookings, courses and programs/),
    });
    expect(create).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledWith('slot-1');
  });

  it("counts every student profile of the user, not only the booked tutor's", async () => {
    setup(9000, null);
    jest.spyOn(studentService, 'getProfileIdsByUser').mockResolvedValue(['student-prof-1', 'student-prof-2']);
    await classService.bookClass('student-user-1', dto);
    expect(aggregate.mock.calls[0][0][0].$match).toMatchObject({ studentPublicId: { $in: ['student-prof-1', 'student-prof-2'] } });
  });

  it('allows the booking when the balance exactly covers the running total', async () => {
    setup(4200, { totalCents: 2000, count: 1 });
    await expect(classService.bookClass('student-user-1', dto)).resolves.toMatchObject({ publicId: 'c1' });
  });

  it('second parallel booking sees the first (serialized lock) and is rejected', async () => {
    setup(2100, null);
    // Emulate serialization: each locked run sees rows committed by the previous.
    let committed = 0;
    aggregate.mockImplementation(((pipeline: Array<{ $match?: { billingMode?: string } }>) => ({
      session: () => Promise.resolve(
        pipeline[0].$match?.billingMode === BillingMode.TUTOR_REQUESTED
          ? []
          : (committed ? [{ totalCents: committed * 2000, count: committed }] : []),
      ),
    })) as never);
    create.mockImplementation((async () => {
      committed++;
      return [{ publicId: 'c', toObject: () => ({}) }];
    }) as never);
    let chain: Promise<unknown> = Promise.resolve();
    lock.mockImplementation(((_o: string, fn: (c: unknown) => Promise<unknown>) => {
      const run = chain.then(() => fn({ session, wallet: { balanceCents: 2100 } }));
      chain = run.catch(() => undefined);
      return run;
    }) as never);

    const results = await Promise.allSettled([
      classService.bookClass('student-user-1', { ...(dto as object), idempotencyKey: 'a' } as never),
      classService.bookClass('student-user-1', { ...(dto as object), idempotencyKey: 'b' } as never),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(committed).toBe(1);
  });

  it('free class (rate 0) skips the lock entirely', async () => {
    setup(0, null, 0);
    await classService.bookClass('student-user-1', dto);
    expect(lock).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('rejects a tutor whose profile is not ACTIVE', async () => {
    setup(5000, null);
    jest.spyOn(tutorService, 'getByPublicId').mockResolvedValue({ userPublicId: 't', hourlyRateCents: 2000, status: 'SUSPENDED' } as never);
    await expect(classService.bookClass('student-user-1', dto)).rejects.toMatchObject({ statusCode: 409 });
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 503 when classBookingEnabled is off', async () => {
    setup(5000, null);
    jest.spyOn(settingsService, 'isFeatureEnabled').mockResolvedValue(false);
    await expect(classService.bookClass('student-user-1', dto)).rejects.toMatchObject({ statusCode: 503 });
  });

  it('rejects slots beyond maxAdvanceBookingDays', async () => {
    setup(5000, null);
    jest.spyOn(scheduleService, 'getSlotByPublicId').mockResolvedValue({
      publicId: 'slot-1', tutorPublicId: 'tutor-1', startUTC: new Date(Date.now() + 31 * 86_400_000),
      endUTC: new Date(Date.now() + 31 * 86_400_000 + 3_600_000), ianaTimezone: 'UTC', durationMinutes: 60,
    } as never);
    await expect(classService.bookClass('student-user-1', dto)).rejects.toThrow(/30 days/);
  });

  it.each([15, 240])('rejects a %i minute slot outside min..max duration', async (mins) => {
    setup(5000, null);
    jest.spyOn(scheduleService, 'getSlotByPublicId').mockResolvedValue({
      publicId: 'slot-1', tutorPublicId: 'tutor-1', startUTC: new Date(), endUTC: new Date(), ianaTimezone: 'UTC', durationMinutes: mins,
    } as never);
    await expect(classService.bookClass('student-user-1', dto)).rejects.toThrow(/between 30 and 180/);
  });
});
