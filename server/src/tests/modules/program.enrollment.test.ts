// server/src/tests/modules/program.enrollment.test.ts
import { programEnrollmentService, sessionCost } from '../../modules/programs/program-enrollment.service';
import { ProgramModel, ProgramEnrollmentModel } from '../../modules/programs/program.model';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { studentService } from '../../modules/students/student.service';
import { tutorService } from '../../modules/tutors/tutor.service';
import { walletService } from '../../modules/wallets/wallet.service';
import { reserveService } from '../../modules/wallets/reserve.service';
import { scheduleService } from '../../modules/schedules/schedule.service';
import { classService } from '../../modules/classes/class.service';
import { domainEvents } from '../../events/event-emitter';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const window = { daysOfWeek: [1, 2, 3, 4, 5], startLocalTime: '16:00', endLocalTime: '19:00', ianaTimezone: 'UTC' };
const program = {
  publicId: 'p-1', tutorPublicId: 'tp-1', status: 'PUBLISHED', sessionCount: 3, sessionMinutes: 60, priceCents: 1000,
  maxEnrollees: 5, activeEnrollmentCount: 1, modules: [{ publicId: 'm-1', title: 'Openings', order: 0 }], isDeleted: false,
};
const enrollment = {
  publicId: 'e-1', programPublicId: 'p-1', tutorPublicId: 'tp-1', studentPublicId: 'sp-1', availabilityWindow: window,
  sessionCount: 3, priceCentsPaid: 1000, sessionsScheduledCount: 0, sessionsCompletedCount: 0, status: 'ACTIVE',
};

describe('sessionCost', () => {
  it('charges every session the same flat share', () => {
    const costs = [1, 2, 3].map((n) => sessionCost(1000, 3, n));
    expect(costs).toEqual([333, 333, 333]); // flat share; remainder refunded at the end
  });
});

describe('enroll', () => {
  beforeEach(() => {
    jest.spyOn(studentService, 'getByUserPublicId').mockResolvedValue({ publicId: 'sp-1', userPublicId: 'su-1' } as never);
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean(program) as never);
    jest.spyOn(ProgramEnrollmentModel, 'exists').mockResolvedValue(null as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
  });
  afterEach(() => jest.restoreAllMocks());

  function arrangeLock(balanceCents: number, heldCents: number) {
    jest.spyOn(walletService, 'getWallet').mockResolvedValue({ balanceCents } as never);
    jest.spyOn(studentService, 'getProfileIdsByUser').mockResolvedValue(['sp-1']);
    jest.spyOn(reserveService, 'getBreakdown').mockResolvedValue({
      studentCents: 0, studentCount: 0, tutorCents: 0, tutorCount: 0, bundleCents: heldCents,
    });
    return jest.spyOn(walletService, 'runWithBookingLock').mockImplementation(
      (async (_o: string, fn: (c: unknown) => unknown) => fn({ session: { id: 's' }, wallet: { balanceCents } })) as never,
    );
  }

  it('reserves a seat atomically, holds the price (no debit) and creates the enrollment inside the lock', async () => {
    const seat = jest.spyOn(ProgramModel, 'findOneAndUpdate').mockReturnValue(lean(program) as never);
    const debit = jest.spyOn(walletService, 'debitWallet').mockResolvedValue({} as never);
    const lock = arrangeLock(1000, 1000);
    const create = jest.spyOn(ProgramEnrollmentModel, 'create').mockResolvedValue([{ toObject: () => enrollment }] as never);

    await programEnrollmentService.enroll('su-1', 'p-1', { availabilityWindow: window });

    expect(seat).toHaveBeenCalledWith(
      expect.objectContaining({ publicId: 'p-1', status: 'PUBLISHED', isDeleted: false }),
      { $inc: { activeEnrollmentCount: 1 } },
      { new: true },
    );
    expect(debit).not.toHaveBeenCalled();
    expect(lock).toHaveBeenCalledWith('su-1', expect.any(Function));
    expect((create.mock.calls[0] as unknown as [unknown[], unknown])[0][0]).toMatchObject({ sessionCount: 3, priceCentsPaid: 1000, billing: 'HELD', status: 'ACTIVE' });
    expect(create.mock.calls[0][1]).toEqual({ session: { id: 's' } });
  });

  it('409s when full, without charging', async () => {
    jest.spyOn(ProgramModel, 'findOneAndUpdate').mockReturnValue(lean(null) as never);
    const debit = jest.spyOn(walletService, 'debitWallet');
    await expect(programEnrollmentService.enroll('su-1', 'p-1', { availabilityWindow: window })).rejects.toMatchObject({ statusCode: 409 });
    expect(debit).not.toHaveBeenCalled();
  });

  it('409s a second active enrollment', async () => {
    jest.spyOn(ProgramEnrollmentModel, 'exists').mockResolvedValue({ _id: 'x' } as never);
    await expect(programEnrollmentService.enroll('su-1', 'p-1', { availabilityWindow: window })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('releases the seat and refuses with 402 when the wallet cannot cover everything held', async () => {
    jest.spyOn(ProgramModel, 'findOneAndUpdate').mockReturnValue(lean(program) as never);
    arrangeLock(999, 1000);
    jest.spyOn(ProgramEnrollmentModel, 'create').mockResolvedValue([{ toObject: () => enrollment }] as never);
    const release = jest.spyOn(ProgramModel, 'updateOne').mockResolvedValue({} as never);
    await expect(programEnrollmentService.enroll('su-1', 'p-1', { availabilityWindow: window })).rejects.toMatchObject({ statusCode: 402 });
    expect(release).toHaveBeenCalledWith({ publicId: 'p-1' }, { $inc: { activeEnrollmentCount: -1 } });
  });

  it('404s a draft program', async () => {
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean(null) as never);
    await expect(programEnrollmentService.enroll('su-1', 'p-1', { availabilityWindow: window })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('scheduleSession', () => {
  // Next Monday, always in the future.
  const monday = (h: number, m = 0, addDays = 0) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7) + addDays);
    d.setUTCHours(h, m, 0, 0);
    return d.toISOString();
  };
  const dto = { startUTC: monday(16), endUTC: monday(17), title: 'Session', programModulePublicId: 'm-1' };
  beforeEach(() => {
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tp-1' } as never);
    jest.spyOn(ProgramEnrollmentModel, 'findOne').mockReturnValue(lean(enrollment) as never);
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean(program) as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
    jest.spyOn(scheduleService, 'findClassOverlap').mockResolvedValue(null);
  });
  afterEach(() => jest.restoreAllMocks());

  it('409s when the tutor already has a class at that time', async () => {
    (scheduleService.findClassOverlap as jest.Mock).mockResolvedValueOnce({ startUTC: new Date(), endUTC: new Date() });
    const claim = jest.spyOn(ProgramEnrollmentModel, 'findOneAndUpdate');
    await expect(programEnrollmentService.scheduleSession('e-1', 'tu-1', dto)).rejects.toMatchObject({ statusCode: 409 });
    expect(claim).not.toHaveBeenCalled();
  });

  it('409s when the student already has a class at that time', async () => {
    (scheduleService.findClassOverlap as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce({ startUTC: new Date(), endUTC: new Date() });
    const claim = jest.spyOn(ProgramEnrollmentModel, 'findOneAndUpdate');
    await expect(programEnrollmentService.scheduleSession('e-1', 'tu-1', dto)).rejects.toMatchObject({ statusCode: 409 });
    expect(claim).not.toHaveBeenCalled();
  });

  it('books a PROGRAM_PREPAID class at the flat per-session price', async () => {
    jest.spyOn(ProgramEnrollmentModel, 'findOneAndUpdate').mockReturnValue(lean({ ...enrollment, sessionsScheduledCount: 3 }) as never);
    const create = jest.spyOn(ScheduledClassModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await programEnrollmentService.scheduleSession('e-1', 'tu-1', dto);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      billingMode: 'PROGRAM_PREPAID', costCents: 333, programEnrollmentPublicId: 'e-1', programModulePublicId: 'm-1', studentPublicId: 'sp-1',
    }));
  });

  it('books a PROGRAM_HELD class for an enrollment that holds its price', async () => {
    jest.spyOn(ProgramEnrollmentModel, 'findOne').mockReturnValue(lean({ ...enrollment, billing: 'HELD' }) as never);
    jest.spyOn(ProgramEnrollmentModel, 'findOneAndUpdate').mockReturnValue(lean({ ...enrollment, billing: 'HELD', sessionsScheduledCount: 3 }) as never);
    const create = jest.spyOn(ScheduledClassModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await programEnrollmentService.scheduleSession('e-1', 'tu-1', dto);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ billingMode: 'PROGRAM_HELD', costCents: 333 }));
  });

  it('rejects another tutor, a foreign module, a slot outside availability, and an over-long session', async () => {
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tp-9' } as never);
    await expect(programEnrollmentService.scheduleSession('e-1', 'tu-9', dto)).rejects.toMatchObject({ statusCode: 404 });
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tp-1' } as never);
    await expect(programEnrollmentService.scheduleSession('e-1', 'tu-1', { ...dto, programModulePublicId: 'm-9' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(programEnrollmentService.scheduleSession('e-1', 'tu-1', { ...dto, startUTC: monday(16, 0, -1), endUTC: monday(17, 0, -1) }))
      .rejects.toMatchObject({ statusCode: 400 }); // Sunday
    await expect(programEnrollmentService.scheduleSession('e-1', 'tu-1', { ...dto, endUTC: monday(18, 30) }))
      .rejects.toMatchObject({ statusCode: 400 }); // 150 min > 60 + 15
  });

  it('409s once every session is booked (guarded increment)', async () => {
    jest.spyOn(ProgramEnrollmentModel, 'findOneAndUpdate').mockReturnValue(lean(null) as never);
    const create = jest.spyOn(ScheduledClassModel, 'create');
    await expect(programEnrollmentService.scheduleSession('e-1', 'tu-1', dto)).rejects.toMatchObject({ statusCode: 409 });
    expect(create).not.toHaveBeenCalled();
  });
});

describe('cancel', () => {
  afterEach(() => jest.restoreAllMocks());

  it('cancels future sessions, refunds the never-booked remainder and frees the seat', async () => {
    jest.spyOn(ProgramEnrollmentModel, 'findOne').mockReturnValue(lean({ ...enrollment, sessionsScheduledCount: 2 }) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-1', userPublicId: 'su-1' }) as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean(null) as never);
    jest.spyOn(ScheduledClassModel, 'find')
      .mockReturnValueOnce(lean([{ publicId: 'k-2' }]) as never) // still scheduled
      .mockReturnValueOnce(lean([{ costCents: 333 }, { costCents: 333 }]) as never); // ever booked
    const cancelClass = jest.spyOn(classService, 'cancelClass').mockResolvedValue({} as never);
    const refund = jest.spyOn(walletService, 'refundWallet').mockResolvedValue({} as never);
    jest.spyOn(ProgramEnrollmentModel, 'findOneAndUpdate').mockReturnValue(lean({ ...enrollment, status: 'CANCELLED' }) as never);
    const seat = jest.spyOn(ProgramModel, 'updateOne').mockResolvedValue({} as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);

    await programEnrollmentService.cancel('e-1', 'su-1');

    expect(cancelClass).toHaveBeenCalledWith('k-2', 'su-1', { reason: 'Program enrollment cancelled' });
    expect(refund).toHaveBeenCalledWith(expect.objectContaining({
      ownerPublicId: 'su-1', amountCents: 334, referenceType: 'PROGRAM_CANCEL', idempotencyKey: 'program-cancel-e-1',
    }));
    expect(seat).toHaveBeenCalledWith({ publicId: 'p-1' }, { $inc: { activeEnrollmentCount: -1 } });
  });

  it('404s someone who is neither the student nor the tutor', async () => {
    jest.spyOn(ProgramEnrollmentModel, 'findOne').mockReturnValue(lean(enrollment) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-9' }) as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean(null) as never);
    await expect(programEnrollmentService.cancel('e-1', 'x')).rejects.toMatchObject({ statusCode: 404 });
  });
});
