import { reserveService, reservedTotalCents } from '../../modules/wallets/reserve.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { CourseModel } from '../../modules/courses/course.model';
import { ProgramEnrollmentModel } from '../../modules/programs/program.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { BillingMode } from '../../modules/schedules/schedule.types';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const session = { id: 's' } as never;
/** An aggregate result that works both with and without `.session(...)`. */
const agg = (rows: unknown[]) => ({
  session: () => Promise.resolve(rows),
  then: (res: (v: unknown[]) => unknown) => Promise.resolve(rows).then(res),
});

describe('ReserveService.getBreakdown', () => {
  afterEach(() => jest.restoreAllMocks());

  function mockAll(student: unknown[], tutor: unknown[], course: unknown[], program: unknown[]) {
    const cls = jest.spyOn(ScheduledClassModel, 'aggregate')
      .mockReturnValueOnce(agg(student) as never)
      .mockReturnValueOnce(agg(tutor) as never);
    const crs = jest.spyOn(CourseModel, 'aggregate').mockReturnValue(agg(course) as never);
    const prg = jest.spyOn(ProgramEnrollmentModel, 'aggregate').mockReturnValue(agg(program) as never);
    return { cls, crs, prg };
  }

  it('adds the student bookings, tutor-created classes and held bundles, with a fee per class', async () => {
    mockAll([{ totalCents: 2000, count: 1 }], [{ totalCents: 3000, count: 2 }], [{ totalCents: 4500 }], [{ totalCents: 666 }]);
    const b = await reserveService.getBreakdown(['sp-1'], session);
    expect(b).toEqual({ studentCents: 2000, studentCount: 1, tutorCents: 3000, tutorCount: 2, bundleCents: 5166 });
    // 2000 + 3000 + 3 classes * 100 fee + 5166 held bundles
    expect(reservedTotalCents(b)).toBe(10466);
  });

  it('is all zeros, and runs no query, when the user has no student profile', async () => {
    const { cls, crs, prg } = mockAll([], [], [], []);
    await expect(reserveService.getBreakdown([], session)).resolves.toEqual({
      studentCents: 0, studentCount: 0, tutorCents: 0, tutorCount: 0, bundleCents: 0,
    });
    expect(cls).not.toHaveBeenCalled();
    expect(crs).not.toHaveBeenCalled();
    expect(prg).not.toHaveBeenCalled();
  });

  it('matches every one of the user\'s profiles, not just one', async () => {
    const { cls } = mockAll([], [], [], []);
    await reserveService.getBreakdown(['sp-1', 'sp-2'], session);
    expect((cls.mock.calls[0][0] as Array<{ $match: unknown }>)[0].$match).toMatchObject({
      studentPublicId: { $in: ['sp-1', 'sp-2'] }, billingMode: BillingMode.STUDENT_REQUESTED,
    });
    expect((cls.mock.calls[1][0] as Array<{ $match: unknown }>)[0].$match).toMatchObject({
      studentPublicId: { $in: ['sp-1', 'sp-2'] }, billingMode: BillingMode.TUTOR_REQUESTED, requestStatus: 'ACCEPTED',
    });
  });

  it('only holds ACCEPTED held courses and ACTIVE held enrollments', async () => {
    const { crs, prg } = mockAll([], [], [], []);
    await reserveService.getBreakdown(['sp-1'], session);
    expect((crs.mock.calls[0][0] as Array<{ $match: unknown }>)[0].$match).toMatchObject({ billing: 'HELD', status: 'ACCEPTED', isDeleted: false });
    expect((prg.mock.calls[0][0] as Array<{ $match: unknown }>)[0].$match).toMatchObject({ billing: 'HELD', status: 'ACTIVE', isDeleted: false });
  });

  it('never lets a course with more completed than required produce a negative hold', async () => {
    const { crs } = mockAll([], [], [], []);
    await reserveService.getBreakdown(['sp-1'], session);
    expect(JSON.stringify(crs.mock.calls[0][0])).toContain('"$max"');
  });
});

describe('ReserveService.getHoldForUser', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reports spendable (demo credits excluded), reserved and available', async () => {
    jest.spyOn(StudentProfileModel, 'find').mockReturnValue(lean([{ publicId: 'sp-1' }]) as never);
    jest.spyOn(ScheduledClassModel, 'aggregate')
      .mockReturnValueOnce(agg([{ totalCents: 2900, count: 1 }]) as never) // 2900 + 100 fee = 3000
      .mockReturnValueOnce(agg([]) as never);
    jest.spyOn(CourseModel, 'aggregate').mockReturnValue(agg([]) as never);
    jest.spyOn(ProgramEnrollmentModel, 'aggregate').mockReturnValue(agg([]) as never);

    await expect(
      reserveService.getHoldForUser('su-1', { balanceCents: 10000, demoCreditsCents: 2000 }),
    ).resolves.toEqual({ spendableCents: 8000, reservedCents: 3000, availableCents: 5000 });
  });

  it('available is never negative', async () => {
    jest.spyOn(StudentProfileModel, 'find').mockReturnValue(lean([{ publicId: 'sp-1' }]) as never);
    jest.spyOn(ScheduledClassModel, 'aggregate').mockReturnValue(agg([]) as never);
    jest.spyOn(CourseModel, 'aggregate').mockReturnValue(agg([{ totalCents: 9000 }]) as never);
    jest.spyOn(ProgramEnrollmentModel, 'aggregate').mockReturnValue(agg([]) as never);

    await expect(reserveService.getHoldForUser('su-1', { balanceCents: 1000 })).resolves.toMatchObject({
      spendableCents: 1000, reservedCents: 9000, availableCents: 0,
    });
  });

  it('is zero for a user with no student profile (tutor, principal)', async () => {
    jest.spyOn(StudentProfileModel, 'find').mockReturnValue(lean([]) as never);
    await expect(reserveService.getHoldForUser('tu-1', { balanceCents: 500 })).resolves.toEqual({
      spendableCents: 500, reservedCents: 0, availableCents: 500,
    });
  });
});
