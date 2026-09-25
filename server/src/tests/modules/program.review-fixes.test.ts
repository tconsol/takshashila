// Regression tests for the Skill Programs review (Important #1–#10).
import request from 'supertest';
import app from '../../app';
import { classService } from '../../modules/classes/class.service';
import { programEnrollmentService, sessionCost } from '../../modules/programs/program-enrollment.service';
import { programService } from '../../modules/programs/program.service';
import { createProgramSchema, enrollSchema } from '../../modules/programs/program.validators';
import { ProgramModel, ProgramEnrollmentModel } from '../../modules/programs/program.model';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { studentService } from '../../modules/students/student.service';
import { tutorService } from '../../modules/tutors/tutor.service';
import { walletService } from '../../modules/wallets/wallet.service';
import { settingsService } from '../../modules/settings/settings.service';
import { domainEvents } from '../../events/event-emitter';
import { logger } from '../../lib/logger';

jest.mock('../../middlewares/auth.middleware', () => {
  const stub = (req: never, _res: never, next: () => void) => {
    (req as { user: unknown }).user = { publicId: 'stranger-u', role: 'TUTOR' };
    next();
  };
  return { authMiddleware: stub, requireAuth: stub, optionalAuth: stub };
});

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const window = { daysOfWeek: [1, 2, 3, 4, 5], startLocalTime: '16:00', endLocalTime: '19:00', ianaTimezone: 'UTC' };
const program = {
  publicId: 'p-1', tutorPublicId: 'tp-1', status: 'PUBLISHED', sessionCount: 3, sessionMinutes: 60, priceCents: 1000,
  activeEnrollmentCount: 1, modules: [{ publicId: 'm-1', title: 'Openings', order: 0 }], isDeleted: false,
};
const enrollment = {
  publicId: 'e-1', programPublicId: 'p-1', tutorPublicId: 'tp-1', studentPublicId: 'sp-1', availabilityWindow: window,
  sessionCount: 3, priceCentsPaid: 1000, sessionsScheduledCount: 1, sessionsCompletedCount: 0, status: 'ACTIVE',
};
const future = (h: number) => {
  // Next Monday 16:00 UTC + h hours, always in the future.
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  d.setUTCHours(16 + h, 0, 0, 0);
  return d.toISOString();
};

describe('program review fixes', () => {
  afterEach(() => jest.restoreAllMocks());

  it('I1: cancelling one program session refunds nothing and frees its slot for rebooking', async () => {
    const cls = {
      publicId: 'k-1', tutorPublicId: 'tp-1', studentPublicId: 'sp-1', status: 'SCHEDULED', title: 'Chess 1',
      costCents: 333, billingMode: 'PROGRAM_PREPAID', programEnrollmentPublicId: 'e-1', startUTC: new Date(Date.now() + 86400000),
    };
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(cls) as never);
    jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(lean({ ...cls, status: 'CANCELLED' }) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-1', userPublicId: 'su-1' }) as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-1', userPublicId: 'tu-1' }) as never);
    jest.spyOn(tutorService, 'recordClassCancelled').mockResolvedValue(undefined as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
    const refund = jest.spyOn(walletService, 'refundWallet').mockResolvedValue({} as never);
    const free = jest.spyOn(ProgramEnrollmentModel, 'updateOne').mockResolvedValue({} as never);

    await classService.cancelClass('k-1', 'tu-1', { reason: 'x' }).catch(() => undefined);

    expect(refund).not.toHaveBeenCalled();
    expect(free).toHaveBeenCalledWith(
      { publicId: 'e-1', status: 'ACTIVE', sessionsScheduledCount: { $gt: 0 } },
      { $inc: { sessionsScheduledCount: -1 } },
    );
  });

  it('I1: every session costs the same flat share (no order-dependent pricing)', () => {
    expect([1, 2, 3].map((n) => sessionCost(1000, 3, n))).toEqual([333, 333, 333]);
  });

  it('I1/I3: completion is counted from COMPLETED classes; the last one refunds the rounding remainder and frees the seat', async () => {
    jest.spyOn(ScheduledClassModel, 'find').mockReturnValue(lean([{ costCents: 333 }, { costCents: 333 }, { costCents: 333 }]) as never);
    const set = jest.spyOn(ProgramEnrollmentModel, 'findOneAndUpdate')
      .mockReturnValueOnce(lean({ ...enrollment, sessionsCompletedCount: 3 }) as never)
      .mockReturnValueOnce(lean({ ...enrollment, status: 'COMPLETED' }) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-1', userPublicId: 'su-1' }) as never);
    const refund = jest.spyOn(walletService, 'refundWallet').mockResolvedValue({} as never);
    const seat = jest.spyOn(ProgramModel, 'updateOne').mockResolvedValue({} as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);

    await classService.recordProgramSessionCompleted('e-1');

    expect(set).toHaveBeenNthCalledWith(1, { publicId: 'e-1' }, { $set: { sessionsCompletedCount: 3 } }, { new: true });
    expect(refund).toHaveBeenCalledWith(expect.objectContaining({ ownerPublicId: 'su-1', amountCents: 1, idempotencyKey: 'program-complete-remainder-e-1' }));
    expect(seat).toHaveBeenCalledWith({ publicId: 'p-1' }, { $inc: { activeEnrollmentCount: -1 } });
  });

  it('I3: completing a class that is no longer SCHEDULED/LIVE (lost race) does nothing', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean({ publicId: 'k-1', status: 'LIVE', tutorPublicId: 'tp-1' }) as never);
    const upd = jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(lean(null) as never);
    const credit = jest.spyOn(walletService, 'creditWallet');
    await expect(classService.completeClass('k-1', 'tu-1')).rejects.toMatchObject({ statusCode: 409 });
    expect(upd).toHaveBeenCalledWith(
      { publicId: 'k-1', status: { $in: ['SCHEDULED', 'LIVE'] } },
      expect.anything(),
      { new: true },
    );
    expect(credit).not.toHaveBeenCalled();
  });

  it('I2: enrollment cancel claims the enrollment first, then refunds price minus completed sessions', async () => {
    jest.spyOn(ProgramEnrollmentModel, 'findOne').mockReturnValue(lean(enrollment) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-1', userPublicId: 'su-1' }) as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean(null) as never);
    const order: string[] = [];
    jest.spyOn(ProgramEnrollmentModel, 'findOneAndUpdate').mockImplementation((() => {
      order.push('claim');
      return lean({ ...enrollment, status: 'CANCELLED' });
    }) as never);
    jest.spyOn(ScheduledClassModel, 'find')
      .mockReturnValueOnce(lean([{ publicId: 'k-2' }]) as never) // upcoming
      .mockReturnValueOnce(lean([{ costCents: 333 }]) as never); // completed
    jest.spyOn(classService, 'cancelClass').mockImplementation((async () => { order.push('cancelClass'); return {}; }) as never);
    const refund = jest.spyOn(walletService, 'refundWallet').mockResolvedValue({} as never);
    jest.spyOn(ProgramModel, 'updateOne').mockResolvedValue({} as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);

    await programEnrollmentService.cancel('e-1', 'su-1');

    expect(order).toEqual(['claim', 'cancelClass']);
    expect(refund).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 667, idempotencyKey: 'program-cancel-e-1' }));
  });

  it('I2: a session inserted after the enrollment was cancelled is removed', async () => {
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tp-1' } as never);
    jest.spyOn(ProgramEnrollmentModel, 'findOne')
      .mockReturnValueOnce(lean(enrollment) as never) // initial load
      .mockReturnValueOnce(lean({ ...enrollment, status: 'CANCELLED' }) as never); // post-insert re-check
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean(program) as never);
    jest.spyOn(ProgramEnrollmentModel, 'findOneAndUpdate').mockReturnValue(lean({ ...enrollment, sessionsScheduledCount: 2 }) as never);
    jest.spyOn(ScheduledClassModel, 'create').mockResolvedValue({ publicId: 'k-new', toObject: () => ({ publicId: 'k-new' }) } as never);
    const del = jest.spyOn(ScheduledClassModel, 'deleteOne').mockResolvedValue({} as never);
    jest.spyOn(ProgramEnrollmentModel, 'updateOne').mockResolvedValue({} as never); // claim rollback
    await expect(programEnrollmentService.scheduleSession('e-1', 'tu-1', {
      startUTC: future(0), endUTC: future(1), title: 's', programModulePublicId: 'm-1',
    })).rejects.toMatchObject({ statusCode: 409 });
    expect(del).toHaveBeenCalledWith({ publicId: 'k-new' });
  });

  it('I5: sessions cannot be booked in the past', async () => {
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tp-1' } as never);
    jest.spyOn(ProgramEnrollmentModel, 'findOne').mockReturnValue(lean(enrollment) as never);
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean(program) as never);
    await expect(programEnrollmentService.scheduleSession('e-1', 'tu-1', {
      startUTC: '2020-01-06T16:00:00.000Z', endUTC: '2020-01-06T17:00:00.000Z', title: 's', programModulePublicId: 'm-1',
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('I6: a failed undo-refund after a failed enrollment insert is logged', async () => {
    jest.spyOn(studentService, 'getByUserPublicId').mockResolvedValue({ publicId: 'sp-1' } as never);
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean(program) as never);
    jest.spyOn(ProgramEnrollmentModel, 'exists').mockResolvedValue(null as never);
    jest.spyOn(ProgramModel, 'findOneAndUpdate').mockReturnValue(lean(program) as never);
    jest.spyOn(ProgramModel, 'updateOne').mockResolvedValue({} as never);
    jest.spyOn(walletService, 'debitWallet').mockResolvedValue({} as never);
    jest.spyOn(ProgramEnrollmentModel, 'create').mockRejectedValue(new Error('dup'));
    jest.spyOn(walletService, 'refundWallet').mockRejectedValue(new Error('wallet down'));
    const err = jest.spyOn(logger, 'error').mockImplementation(() => logger);
    await expect(programEnrollmentService.enroll('su-1', 'p-1', { availabilityWindow: window })).rejects.toThrow('dup');
    expect(err).toHaveBeenCalledWith(expect.stringContaining('refund'), expect.objectContaining({ amountCents: 1000 }));
  });

  it('I7: session length is locked once students have enrolled', async () => {
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean({ ...program, activeEnrollmentCount: 1 }) as never);
    jest.spyOn(ProgramEnrollmentModel, 'exists').mockResolvedValue({ _id: 'x' } as never);
    await expect(programService.update('tp-1', 'p-1', { sessionMinutes: 15 })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('I8: price must be free or at least the platform fee per session', async () => {
    const base = { title: 'x', category: 'GAMES', level: 'BEGINNER', modules: [{ title: 'm' }] };
    expect(createProgramSchema.safeParse({ ...base, sessionCount: 10, priceCents: 500 }).success).toBe(false);
    expect(createProgramSchema.safeParse({ ...base, sessionCount: 10, priceCents: 0 }).success).toBe(true);
    expect(createProgramSchema.safeParse({ ...base, sessionCount: 10, priceCents: 1000 }).success).toBe(true);

    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean({ ...program, activeEnrollmentCount: 0 }) as never);
    jest.spyOn(ProgramEnrollmentModel, 'exists').mockResolvedValue(null as never);
    await expect(programService.update('tp-1', 'p-1', { priceCents: 100 })).rejects.toMatchObject({ statusCode: 422 }); // 3 sessions
  });

  it('I10: enroll rejects an invalid timezone, bad times and an empty window', () => {
    const ok = { availabilityWindow: window };
    expect(enrollSchema.safeParse(ok).success).toBe(true);
    expect(enrollSchema.safeParse({ availabilityWindow: { ...window, ianaTimezone: 'Mars/Olympus' } }).success).toBe(false);
    expect(enrollSchema.safeParse({ availabilityWindow: { ...window, startLocalTime: '25:99' } }).success).toBe(false);
    expect(enrollSchema.safeParse({ availabilityWindow: { ...window, startLocalTime: '19:00', endLocalTime: '16:00' } }).success).toBe(false);
  });

  it('I4: class complete/cancel routes require being a party to the class', async () => {
    jest.spyOn(settingsService, 'get').mockResolvedValue({ maintenanceMode: false } as never);
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean({ publicId: 'k-1', tutorPublicId: 'tp-1', studentPublicId: 'sp-1', status: 'SCHEDULED' }) as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-OTHER' }) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean(null) as never);
    const complete = jest.spyOn(classService, 'completeClass');
    const cancel = jest.spyOn(classService, 'cancelClass');
    expect((await request(app).post('/api/v1/classes/k-1/complete')).status).toBe(404);
    expect((await request(app).post('/api/v1/classes/k-1/cancel').send({ reason: 'x' })).status).toBe(404);
    expect(complete).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });
});
