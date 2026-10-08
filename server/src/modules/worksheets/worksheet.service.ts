import { v4 as uuidv4 } from 'uuid';
import { WorksheetModel, WorksheetSubmissionModel } from './worksheet.model';
import type { IWorksheet, IWorksheetSubmission, CreateWorksheetDto, SubmitWorksheetDto } from './worksheet.types';
import { WorksheetStatus } from './worksheet.types';
import { NotFoundError, AppError, ConflictError } from '../../utils/error';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';
import { resolveTutorAttachment } from '../curricula/curriculum-attachment';
import { resolveAdminAttachment } from '../curricula/curriculum-attachment';
import * as access from '../courses/material-access';
import type { TutorAuthor } from '../../shared/material.types';

export class WorksheetService {
  async create(tutor: TutorAuthor, dto: CreateWorksheetDto): Promise<IWorksheet> {
    if (!dto.isFileAttachment && (!dto.questions || dto.questions.length === 0)) {
      throw new AppError('Worksheet must have at least one question', 400);
    }
    if (dto.isFileAttachment && !dto.filePublicId) {
      throw new AppError('File attachment requires a filePublicId', 400);
    }
    const attachment = await resolveTutorAttachment(tutor, dto);
    const worksheet = await WorksheetModel.create({
      publicId: uuidv4(),
      tutorPublicId: tutor.publicId,
      classPublicId: dto.classPublicId,
      title: dto.title,
      subject: dto.subject,
      type: dto.type,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      questions: dto.isFileAttachment ? [] : (dto.questions ?? []),
      isFileAttachment: dto.isFileAttachment ?? false,
      filePublicId: dto.filePublicId,
      fileMimeType: dto.fileMimeType,
      fileOriginalName: dto.fileOriginalName,
      assignedToStudentPublicIds: dto.assignedToStudentPublicIds ?? [],
      status: WorksheetStatus.PUBLISHED,
      ...attachment,
      authorRole: 'TUTOR',
      authorUserPublicId: tutor.userPublicId,
    });
    return worksheet.toObject();
  }

  async createForCurriculum(adminUserPublicId: string, curriculumPublicId: string, dto: CreateWorksheetDto): Promise<IWorksheet> {
    if (!dto.isFileAttachment && (!dto.questions || dto.questions.length === 0)) {
      throw new AppError('Worksheet must have at least one question', 400);
    }
    const attachment = await resolveAdminAttachment(curriculumPublicId, dto.topicPublicIds);
    const worksheet = await WorksheetModel.create({
      publicId: uuidv4(),
      title: dto.title,
      subject: dto.subject,
      type: dto.type,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      questions: dto.isFileAttachment ? [] : (dto.questions ?? []),
      isFileAttachment: dto.isFileAttachment ?? false,
      filePublicId: dto.filePublicId,
      fileMimeType: dto.fileMimeType,
      fileOriginalName: dto.fileOriginalName,
      assignedToStudentPublicIds: [],
      status: WorksheetStatus.PUBLISHED,
      ...attachment,
      authorRole: 'ADMIN',
      authorUserPublicId: adminUserPublicId,
    });
    return worksheet.toObject();
  }

  async getByTutor(
    tutorPublicId: string,
    query: PaginationQuery & { type?: string; classPublicId?: string },
  ): Promise<PaginatedResult<IWorksheet>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { tutorPublicId, isDeleted: false };
    if (query.type) filter.type = query.type;
    if (query.classPublicId) filter.classPublicId = query.classPublicId;

    const [items, total] = await Promise.all([
      WorksheetModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WorksheetModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async getByPrincipal(
    principalUserPublicId: string,
    query: PaginationQuery & { type?: string; tutorPublicId?: string },
  ): Promise<PaginatedResult<IWorksheet & { tutorName: string; submissionCount: number }>> {
    const { tutorRepository } = await import('../tutors/tutor.repository');
    const { UserModel } = await import('../users/user.model');

    const tutorsResult = await tutorRepository.findByPrincipal(principalUserPublicId, { page: 1, limit: 500 } as PaginationQuery);
    const tutorPublicIds = tutorsResult.items.map((t) => t.publicId);
    if (tutorPublicIds.length === 0) {
      return { items: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    }

    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = {
      tutorPublicId: query.tutorPublicId ? query.tutorPublicId : { $in: tutorPublicIds },
      isDeleted: false,
    };
    if (query.type) filter.type = query.type;

    const [items, total] = await Promise.all([
      WorksheetModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WorksheetModel.countDocuments(filter),
    ]);

    // Enrich with tutor names + submission counts
    const tutorUserMap = new Map(tutorsResult.items.map((t) => [t.publicId, t.userPublicId]));
    const userPublicIds = [...new Set(tutorsResult.items.map((t) => t.userPublicId))];
    const users = await UserModel.find({ publicId: { $in: userPublicIds } }, { publicId: 1, firstName: 1, lastName: 1 }).lean();
    const userNameMap = new Map(users.map((u) => [u.publicId, `${u.firstName} ${u.lastName}`.trim()]));

    const worksheetIds = items.map((w) => w.publicId);
    const subAgg = await WorksheetSubmissionModel.aggregate([
      { $match: { worksheetPublicId: { $in: worksheetIds }, isDeleted: false } },
      { $group: { _id: '$worksheetPublicId', count: { $sum: 1 } } },
    ]);
    const subMap = new Map(subAgg.map((s) => [s._id as string, s.count as number]));

    const enriched = items.map((w) => ({
      ...w,
      tutorName: userNameMap.get(tutorUserMap.get(w.tutorPublicId ?? '') ?? '') ?? 'Unknown Tutor',
      submissionCount: subMap.get(w.publicId) ?? 0,
    }));

    return buildPaginatedResult(enriched, total, page, limit);
  }

  /** `studentPublicIds`: every profile of the student (one per tutor link). */
  async getForStudent(
    studentPublicIds: string | string[],
    query: PaginationQuery & { type?: string },
  ): Promise<PaginatedResult<IWorksheet & { mySubmission?: IWorksheetSubmission }>> {
    const ids = toIds(studentPublicIds);
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = {
      $or: [
        { assignedToStudentPublicIds: anyOf(ids) },
        { assignedToStudentPublicIds: { $size: 0 } },
      ],
      status: WorksheetStatus.PUBLISHED,
      isDeleted: false,
      // Curriculum (admin) worksheets are reached through the course structure only.
      authorRole: { $ne: 'ADMIN' },
    };
    if (query.type) filter.type = query.type;
    filter.$and = [await access.studentMaterialScope(ids, 'worksheet')];

    const [items, total] = await Promise.all([
      WorksheetModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WorksheetModel.countDocuments(filter),
    ]);

    // Attach own submission if exists
    const worksheetPublicIds = items.map((w) => w.publicId);
    const submissions = await WorksheetSubmissionModel.find({
      worksheetPublicId: { $in: worksheetPublicIds },
      studentPublicId: anyOf(ids),
      isDeleted: false,
    }).lean();

    const submissionMap = new Map(submissions.map((s) => [s.worksheetPublicId, s]));
    const enriched = items.map((w) => ({
      ...w,
      mySubmission: submissionMap.get(w.publicId),
    }));

    return buildPaginatedResult(enriched, total, page, limit);
  }

  async getByPublicId(publicId: string): Promise<IWorksheet> {
    const worksheet = await WorksheetModel.findOne({ publicId, isDeleted: false }).lean();
    if (!worksheet) throw new NotFoundError('Worksheet not found');
    return worksheet;
  }

  async softDelete(publicId: string, tutorPublicId: string): Promise<void> {
    const result = await WorksheetModel.findOneAndUpdate(
      { publicId, tutorPublicId, isDeleted: false },
      { $set: { isDeleted: true } },
    ).lean();
    if (!result) throw new NotFoundError('Worksheet not found');
  }

  /**
   * `allStudentPublicIds`: every profile of the student, so a worksheet can't be
   * submitted twice through two tutor links. Defaults to `studentPublicId` alone.
   */
  async submitAnswers(
    worksheetPublicId: string,
    studentPublicId: string,
    dto: SubmitWorksheetDto,
    allStudentPublicIds: string[] = [studentPublicId],
  ): Promise<IWorksheetSubmission> {
    const worksheet = await WorksheetModel.findOne({
      publicId: worksheetPublicId,
      status: WorksheetStatus.PUBLISHED,
      isDeleted: false,
    }).lean();
    if (!worksheet) throw new NotFoundError('Worksheet not found');

    const existing = await WorksheetSubmissionModel.findOne({
      worksheetPublicId,
      studentPublicId: anyOf(allStudentPublicIds),
      isDeleted: false,
    }).lean();
    if (existing) throw new ConflictError('You have already submitted this worksheet');

    const answers = dto.answers;
    if (answers.length !== worksheet.questions.length) {
      throw new AppError('Answer count does not match question count', 400);
    }

    let correctCount = 0;
    worksheet.questions.forEach((q, i) => {
      if (answers[i] === q.correctIndex) correctCount++;
    });

    const score = worksheet.questions.length > 0
      ? Math.round((correctCount / worksheet.questions.length) * 100)
      : 0;

    const graderTutorPublicId = worksheet.authorRole === 'ADMIN'
      ? await access.findGraderTutor(studentPublicId, worksheet)
      : undefined;

    const submission = await WorksheetSubmissionModel.create({
      publicId: uuidv4(),
      worksheetPublicId,
      studentPublicId,
      answers,
      score,
      correctCount,
      totalQuestions: worksheet.questions.length,
      timeTakenSeconds: dto.timeTakenSeconds,
      submittedAt: new Date(),
      ...(graderTutorPublicId ? { graderTutorPublicId } : {}),
    });

    return submission.toObject();
  }

  async getSubmissionsForWorksheet(
    worksheetPublicId: string,
    tutorPublicId: string,
  ): Promise<IWorksheetSubmission[]> {
    const worksheet = await WorksheetModel.findOne({ publicId: worksheetPublicId, isDeleted: false }).lean();
    const isAdminItem = worksheet?.authorRole === 'ADMIN';
    if (!worksheet || (!isAdminItem && worksheet.tutorPublicId !== tutorPublicId)) throw new NotFoundError('Worksheet not found');

    // Admin (curriculum) worksheets: each tutor sees only the students they grade.
    return WorksheetSubmissionModel.find({ worksheetPublicId, isDeleted: false, ...(isAdminItem ? { graderTutorPublicId: tutorPublicId } : {}) })
      .sort({ submittedAt: -1 })
      .lean();
  }

  async getMySubmission(
    worksheetPublicId: string,
    studentPublicIds: string | string[],
  ): Promise<IWorksheetSubmission | null> {
    return WorksheetSubmissionModel.findOne({
      worksheetPublicId,
      studentPublicId: anyOf(toIds(studentPublicIds)),
      isDeleted: false,
    }).lean();
  }

  /**
   * Which of the student's profiles a submission belongs to: the one the worksheet
   * was addressed to, else the one linked to its tutor (or, for curriculum items,
   * the one with the grading course), else the first.
   */
  async pickStudentProfileFor(
    worksheet: IWorksheet,
    profiles: { publicId: string; tutorPublicId?: string }[],
  ): Promise<string | undefined> {
    const assigned = profiles.find((p) => worksheet.assignedToStudentPublicIds?.includes(p.publicId));
    if (assigned) return assigned.publicId;
    if (worksheet.authorRole === 'ADMIN') {
      for (const p of profiles) {
        if (await access.findGraderTutor(p.publicId, worksheet)) return p.publicId;
      }
    }
    return (profiles.find((p) => p.tutorPublicId && p.tutorPublicId === worksheet.tutorPublicId) ?? profiles[0])?.publicId;
  }

  async countUnsubmittedForStudent(studentPublicIds: string | string[]): Promise<number> {
    const ids = toIds(studentPublicIds);
    // Same scope as getForStudent, so the badge matches the Homework list.
    const filter = {
      $or: [
        { assignedToStudentPublicIds: anyOf(ids) },
        { assignedToStudentPublicIds: { $size: 0 } },
      ],
      status: WorksheetStatus.PUBLISHED,
      isDeleted: false,
      authorRole: { $ne: 'ADMIN' },
      $and: [await access.studentMaterialScope(ids, 'worksheet')],
    };
    const total = await WorksheetModel.countDocuments(filter);
    const submitted = await WorksheetSubmissionModel.countDocuments({ studentPublicId: anyOf(ids), isDeleted: false });
    return Math.max(0, total - submitted);
  }
}

const toIds = (v: string | string[]) => (Array.isArray(v) ? v : [v]);
// A query value matching any of `ids` (a plain value when there is just one).
const anyOf = (ids: string[]) => (ids.length === 1 ? ids[0] : { $in: ids });

export const worksheetService = new WorksheetService();
