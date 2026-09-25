// server/src/tests/modules/program.enrollment.test.ts
import { programEnrollmentService, sessionCost } from '../../modules/programs/program-enrollment.service';
import { ProgramModel, ProgramEnrollmentModel } from '../../modules/programs/program.model';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { studentService } from '../../modules/students/student.service';
import { tutorService } from '../../modules/tutors/tutor.service';
import { walletService } from '../../modules/wallets/wallet.service';
import { classService } from '../../modules/classes/class.service';
import { domainEvents } from '../../events/event-emitter';
import { AppError } from '../../utils/error';

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
  it('splits the price so the sessions sum exactly to it', () => {
    const costs = [1, 2, 3].map((n) => sessionCost(1000, 3, n));
    expect(costs).toEqual([333, 333, 334]);
    expect(costs.reduce((a, b) => a + b, 0)).toBe(1000);
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

  it('reserves a seat atomically, charges the price and creates the enrollment', async () => {
    const seat = jest.spyOn(ProgramModel, 'findOneAndUpdate').mockReturnValue(lean(program) as never);
    const debit = jest.spyOn(walletService, 'debitWallet').mockResolvedValue({} as never);
    const create = jest.spyOn(ProgramEnrollmentModel, 'create').mockResolvedValue({ toObject: () => enrollment } as never);

    await programEnrollmentService.enroll('su-1', 'p-1', { availabilityWindow: window });

    expect(seat).toHaveBeenCalledWith(
      expect.objectContaining({ publicId: 'p-1', status: 'PUBLISHED', isDeleted: false }),
      { $inc: { activeEnrollmentCount: 1 } },
      { new: true },
    );
    expect(debit).toHaveBeenCalledWith(expect.objectContaining({
      ownerPublicId: 'su-1', amountCents: 1000, referenceType: 'PROGRAM_ENROLL', idempotencyKey: expect.stringMatching(/^program-enroll-/),
    }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ sessionCount: 3, priceCentsPaid: 1000, status: 'ACTIVE' }));
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

  it('releases the seat when the wallet has too little credit', async () => {
    jest.spyOn(ProgramModel, 'findOneAndUpdate').mockReturnValue(lean(program) as never);
    jest.spyOn(walletService, 'debitWallet').mockRejectedValue(new AppError('Insufficient credits', 402));
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
  const dto = { startUTC: '2026-09-28T16:00:00.000Z', endUTC: '2026-09-28T17:00:00.000Z', title: 'Session', programModulePublicId: 'm-1' };
  beforeEach(() => {
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tp-1' } as never);
    jest.spyOn(ProgramEnrollmentModel, 'findOne').mockReturnValue(lean(enrollment) as never);
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean(program) as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
  });
  afterEach(() => jest.restoreAllMocks());

  it('books a PROGRAM_PREPAID class priced from the post-increment session number', async () => {
    jest.spyOn(ProgramEnrollmentModel, 'findOneAndUpdate').mockReturnValue(lean({ ...enrollment, sessionsScheduledCount: 3 }) as never);
    const create = jest.spyOn(ScheduledClassModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await programEnrollmentService.scheduleSession('e-1', 'tu-1', dto);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      billingMode: 'PROGRAM_PREPAID', costCents: 334, programEnrollmentPublicId: 'e-1', programModulePublicId: 'm-1', studentPublicId: 'sp-1',
    }));
  });

  it('rejects another tutor, a foreign module, a slot outside availability, and an over-long session', async () => {
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tp-9' } as never);
    await expect(programEnrollmentService.scheduleSession('e-1', 'tu-9', dto)).rejects.toMatchObject({ statusCode: 404 });
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tp-1' } as never);
    await expect(programEnrollmentService.scheduleSession('e-1', 'tu-1', { ...dto, programModulePublicId: 'm-9' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(programEnrollmentService.scheduleSession('e-1', 'tu-1', { ...dto, startUTC: '2026-09-27T16:00:00.000Z', endUTC: '2026-09-27T17:00:00.000Z' }))
      .rejects.toMatchObject({ statusCode: 400 }); // Sunday
    await expect(programEnrollmentService.scheduleSession('e-1', 'tu-1', { ...dto, endUTC: '2026-09-28T18:30:00.000Z' }))
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
