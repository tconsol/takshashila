// server/src/tests/modules/program.service.test.ts
import { programService } from '../../modules/programs/program.service';
import { ProgramModel, ProgramEnrollmentModel } from '../../modules/programs/program.model';
import { createProgramSchema, programCatalogQuerySchema } from '../../modules/programs/program.validators';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { UserModel } from '../../modules/users/user.model';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const base = {
  title: 'Chess for Beginners', category: 'GAMES', level: 'BEGINNER', sessionCount: 8, priceCents: 12000,
  modules: [{ title: 'Openings' }, { title: 'Tactics' }],
};
const existing = {
  publicId: 'p-1', tutorPublicId: 'tp-1', status: 'PUBLISHED', sessionCount: 8, priceCents: 12000, activeEnrollmentCount: 2,
  modules: [{ publicId: 'm-1', title: 'Openings', order: 0 }, { publicId: 'm-2', title: 'Tactics', order: 1 }], isDeleted: false,
};

describe('program validators', () => {
  it('require at least one module and a sane age range', () => {
    expect(createProgramSchema.safeParse(base).success).toBe(true);
    expect(createProgramSchema.safeParse({ ...base, modules: [] }).success).toBe(false);
    expect(createProgramSchema.safeParse({ ...base, ageMin: 12, ageMax: 8 }).success).toBe(false);
    expect(createProgramSchema.safeParse({ ...base, category: 'MATHS' }).success).toBe(false);
  });

  it('catalog query coerces age and page', () => {
    expect(programCatalogQuerySchema.parse({ age: '10', page: '2' })).toEqual(expect.objectContaining({ age: 10, page: 2 }));
  });
});

describe('programService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('create stores a draft with ordered modules and no enrollments', async () => {
    const create = jest.spyOn(ProgramModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await programService.create('tp-1', createProgramSchema.parse(base));
    const arg = (create.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(arg).toEqual(expect.objectContaining({ tutorPublicId: 'tp-1', status: 'DRAFT', activeEnrollmentCount: 0, sessionMinutes: 60 }));
    expect((arg.modules as Array<{ order: number; publicId: string }>).map((m) => m.order)).toEqual([0, 1]);
    expect((arg.modules as Array<{ publicId: string }>)[0].publicId).toEqual(expect.any(String));
  });

  it('locks price, session count and module removal once anyone has enrolled', async () => {
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean(existing) as never);
    jest.spyOn(ProgramEnrollmentModel, 'exists').mockResolvedValue({ _id: 'x' } as never);
    await expect(programService.update('tp-1', 'p-1', { priceCents: 9000 })).rejects.toMatchObject({ statusCode: 409 });
    await expect(programService.update('tp-1', 'p-1', { sessionCount: 10 })).rejects.toMatchObject({ statusCode: 409 });
    await expect(programService.update('tp-1', 'p-1', { modules: [{ publicId: 'm-1', title: 'Openings' }] })).rejects.toMatchObject({ statusCode: 409 });
    await expect(programService.update('tp-1', 'p-1', { maxEnrollees: 1 })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('allows title edits and adding modules after enrollments, keeping module ids', async () => {
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean(existing) as never);
    jest.spyOn(ProgramEnrollmentModel, 'exists').mockResolvedValue({ _id: 'x' } as never);
    const upd = jest.spyOn(ProgramModel, 'findOneAndUpdate').mockReturnValue(lean(existing) as never);
    await programService.update('tp-1', 'p-1', {
      title: 'Chess 101',
      modules: [{ publicId: 'm-1', title: 'Openings' }, { publicId: 'm-2', title: 'Tactics' }, { title: 'Endgames' }],
    });
    const set = ((upd.mock.calls[0] as unknown as [unknown, { $set: Record<string, unknown> }])[1]).$set;
    expect(set.title).toBe('Chess 101');
    expect((set.modules as Array<{ publicId: string; order: number }>).map((m) => [m.publicId === 'm-1' || m.publicId === 'm-2' ? m.publicId : 'new', m.order]))
      .toEqual([['m-1', 0], ['m-2', 1], ['new', 2]]);
  });

  it('another tutor cannot edit (404)', async () => {
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean(null) as never);
    await expect(programService.update('tp-9', 'p-1', { title: 'x' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('delete is refused once anyone has enrolled', async () => {
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean(existing) as never);
    jest.spyOn(ProgramEnrollmentModel, 'exists').mockResolvedValue({ _id: 'x' } as never);
    await expect(programService.remove('tp-1', 'p-1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('catalog lists only published programs and applies filters', async () => {
    const find = jest.spyOn(ProgramModel, 'find').mockReturnValue({ sort: () => ({ skip: () => ({ limit: () => lean([]) }) }) } as never);
    jest.spyOn(ProgramModel, 'countDocuments').mockResolvedValue(0 as never);
    jest.spyOn(TutorProfileModel, 'find').mockReturnValue(lean([]) as never);
    jest.spyOn(UserModel, 'find').mockReturnValue(lean([]) as never);
    await programService.catalog({ category: 'GAMES', level: 'BEGINNER', age: 10, q: 'che(ss' });
    const filter = (find.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(filter).toEqual(expect.objectContaining({ status: 'PUBLISHED', isDeleted: false, category: 'GAMES', level: 'BEGINNER' }));
    expect(filter.$and).toEqual([
      { $or: [{ ageMin: { $exists: false } }, { ageMin: { $lte: 10 } }] },
      { $or: [{ ageMax: { $exists: false } }, { ageMax: { $gte: 10 } }] },
    ]);
    expect((filter.title as RegExp).test('Chess (Beginners) che(ss')).toBe(true);
  });

  it('drafts are visible only to their tutor and admins', async () => {
    jest.spyOn(ProgramModel, 'findOne').mockReturnValue(lean({ ...existing, status: 'DRAFT' }) as never);
    jest.spyOn(TutorProfileModel, 'find').mockReturnValue(lean([]) as never);
    jest.spyOn(UserModel, 'find').mockReturnValue(lean([]) as never);
    await expect(programService.getForViewer('p-1', { role: 'STUDENT' })).rejects.toMatchObject({ statusCode: 404 });
    await expect(programService.getForViewer('p-1', { role: 'TUTOR', tutorPublicId: 'tp-1' })).resolves.toMatchObject({ publicId: 'p-1' });
    await expect(programService.getForViewer('p-1', { role: 'ADMIN' })).resolves.toMatchObject({ publicId: 'p-1' });
  });
});
