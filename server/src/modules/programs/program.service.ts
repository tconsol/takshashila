// server/src/modules/programs/program.service.ts
import { v4 as uuidv4 } from 'uuid';
import { ProgramModel, ProgramEnrollmentModel } from './program.model';
import { ProgramStatus } from './program.types';
import type { IProgram, IProgramModule } from './program.types';
import type { CreateProgramDto, UpdateProgramDto, ProgramCatalogQuery } from './program.validators';
import { TutorProfileModel } from '../tutors/tutor.model';
import { UserModel } from '../users/user.model';
import { ConflictError, NotFoundError } from '../../utils/error';
import type { PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';

export type ProgramView = IProgram & { tutorName: string; isFull: boolean };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toModules = (input: Array<{ publicId?: string; title: string; description?: string }>): IProgramModule[] =>
  input.map((m, i) => ({ publicId: m.publicId ?? uuidv4(), title: m.title, description: m.description, order: i }));

async function withTutorNames(programs: IProgram[]): Promise<ProgramView[]> {
  const tutorIds = [...new Set(programs.map((p) => p.tutorPublicId))];
  const tutors = tutorIds.length ? await TutorProfileModel.find({ publicId: { $in: tutorIds } }, { publicId: 1, userPublicId: 1 }).lean() : [];
  const users = tutors.length
    ? await UserModel.find({ publicId: { $in: tutors.map((t) => t.userPublicId) } }, { publicId: 1, firstName: 1, lastName: 1 }).lean()
    : [];
  const nameByUser = new Map(users.map((u) => [u.publicId, `${u.firstName} ${u.lastName}`.trim()]));
  const nameByTutor = new Map(tutors.map((t) => [t.publicId, nameByUser.get(t.userPublicId) ?? 'Tutor']));
  return programs.map((p) => ({
    ...p,
    tutorName: nameByTutor.get(p.tutorPublicId) ?? 'Tutor',
    isFull: p.maxEnrollees !== undefined && p.activeEnrollmentCount >= p.maxEnrollees,
  }));
}

export class ProgramService {
  async create(tutorPublicId: string, dto: CreateProgramDto): Promise<IProgram> {
    const created = await ProgramModel.create({
      publicId: uuidv4(),
      tutorPublicId,
      title: dto.title,
      category: dto.category,
      description: dto.description,
      level: dto.level,
      ageMin: dto.ageMin,
      ageMax: dto.ageMax,
      sessionCount: dto.sessionCount,
      sessionMinutes: dto.sessionMinutes,
      priceCents: dto.priceCents,
      maxEnrollees: dto.maxEnrollees,
      activeEnrollmentCount: 0,
      modules: toModules(dto.modules),
      status: ProgramStatus.DRAFT,
      isDeleted: false,
    });
    return created.toObject();
  }

  private async _owned(tutorPublicId: string, programPublicId: string): Promise<IProgram> {
    const program = await ProgramModel.findOne({ publicId: programPublicId, tutorPublicId, isDeleted: false }).lean();
    if (!program) throw new NotFoundError('Program');
    return program;
  }

  async update(tutorPublicId: string, programPublicId: string, dto: UpdateProgramDto): Promise<IProgram> {
    const program = await this._owned(tutorPublicId, programPublicId);
    const hasEnrollments = !!(await ProgramEnrollmentModel.exists({ programPublicId }));

    if (hasEnrollments) {
      // Students have paid for these terms.
      if (dto.priceCents !== undefined && dto.priceCents !== program.priceCents) throw new ConflictError('Price is locked once students have enrolled');
      if (dto.sessionCount !== undefined && dto.sessionCount !== program.sessionCount) throw new ConflictError('Session count is locked once students have enrolled');
      if (dto.modules) {
        const kept = new Set(dto.modules.flatMap((m) => (m.publicId ? [m.publicId] : [])));
        if (program.modules.some((m) => !kept.has(m.publicId))) throw new ConflictError('Modules can only be added once students have enrolled');
      }
    }
    if (dto.maxEnrollees !== undefined && dto.maxEnrollees < program.activeEnrollmentCount) {
      throw new ConflictError(`Max enrollees cannot be below the ${program.activeEnrollmentCount} active students`);
    }

    const { modules, ...rest } = dto;
    const $set: Record<string, unknown> = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
    if (modules) $set.modules = toModules(modules);
    const updated = await ProgramModel.findOneAndUpdate({ publicId: programPublicId, tutorPublicId, isDeleted: false }, { $set }, { new: true }).lean();
    if (!updated) throw new NotFoundError('Program');
    return updated;
  }

  async setStatus(tutorPublicId: string, programPublicId: string, status: 'PUBLISHED' | 'ARCHIVED'): Promise<IProgram> {
    await this._owned(tutorPublicId, programPublicId);
    const updated = await ProgramModel.findOneAndUpdate({ publicId: programPublicId, tutorPublicId }, { $set: { status } }, { new: true }).lean();
    return updated!;
  }

  async remove(tutorPublicId: string, programPublicId: string): Promise<void> {
    await this._owned(tutorPublicId, programPublicId);
    if (await ProgramEnrollmentModel.exists({ programPublicId })) {
      throw new ConflictError('A program with enrollments cannot be deleted — archive it instead');
    }
    await ProgramModel.updateOne({ publicId: programPublicId, tutorPublicId }, { $set: { isDeleted: true } });
  }

  async listMine(tutorPublicId: string): Promise<ProgramView[]> {
    const programs = await ProgramModel.find({ tutorPublicId, isDeleted: false }).sort({ createdAt: -1 }).lean();
    return withTutorNames(programs);
  }

  /** Drafts are visible to their tutor and admins only. */
  async getForViewer(programPublicId: string, viewer: { role: string; tutorPublicId?: string }): Promise<ProgramView> {
    const program = await ProgramModel.findOne({ publicId: programPublicId, isDeleted: false }).lean();
    const isAdmin = viewer.role === 'ADMIN' || viewer.role === 'SUPER_ADMIN';
    if (!program || (program.status === ProgramStatus.DRAFT && !isAdmin && program.tutorPublicId !== viewer.tutorPublicId)) {
      throw new NotFoundError('Program');
    }
    const [view] = await withTutorNames([program]);
    return view;
  }

  private _filter(query: ProgramCatalogQuery, base: Record<string, unknown>): Record<string, unknown> {
    const filter: Record<string, unknown> = { ...base, isDeleted: false };
    if (query.category) filter.category = query.category;
    if (query.level) filter.level = query.level;
    if (query.age !== undefined) {
      filter.$and = [
        { $or: [{ ageMin: { $exists: false } }, { ageMin: { $lte: query.age } }] },
        { $or: [{ ageMax: { $exists: false } }, { ageMax: { $gte: query.age } }] },
      ];
    }
    if (query.q?.trim()) filter.title = new RegExp(escape(query.q.trim()), 'i');
    return filter;
  }

  async catalog(query: ProgramCatalogQuery): Promise<PaginatedResult<ProgramView>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter = this._filter(query, { status: ProgramStatus.PUBLISHED });
    const [items, total] = await Promise.all([
      ProgramModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ProgramModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(await withTutorNames(items), total, page, limit);
  }

  async adminList(query: ProgramCatalogQuery & { status?: string }): Promise<PaginatedResult<ProgramView>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter = this._filter(query, query.status ? { status: query.status } : {});
    const [items, total] = await Promise.all([
      ProgramModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ProgramModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(await withTutorNames(items), total, page, limit);
  }

  async unpublish(programPublicId: string): Promise<IProgram> {
    const updated = await ProgramModel.findOneAndUpdate(
      { publicId: programPublicId, isDeleted: false },
      { $set: { status: ProgramStatus.ARCHIVED } },
      { new: true },
    ).lean();
    if (!updated) throw new NotFoundError('Program');
    return updated;
  }
}

export const programService = new ProgramService();
