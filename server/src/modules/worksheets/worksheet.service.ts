import { v4 as uuidv4 } from 'uuid';
import { WorksheetModel, WorksheetSubmissionModel } from './worksheet.model';
import type { IWorksheet, IWorksheetSubmission, CreateWorksheetDto, SubmitWorksheetDto } from './worksheet.types';
import { WorksheetStatus } from './worksheet.types';
import { NotFoundError, AppError, ConflictError } from '../../utils/error';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';

export class WorksheetService {
  async create(tutorPublicId: string, dto: CreateWorksheetDto): Promise<IWorksheet> {
    if (!dto.questions || dto.questions.length === 0) {
      throw new AppError('Worksheet must have at least one question', 400);
    }
    const worksheet = await WorksheetModel.create({
      publicId: uuidv4(),
      tutorPublicId,
      classPublicId: dto.classPublicId,
      title: dto.title,
      subject: dto.subject,
      type: dto.type,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      questions: dto.questions,
      assignedToStudentPublicIds: dto.assignedToStudentPublicIds ?? [],
      status: WorksheetStatus.PUBLISHED,
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

  async getForStudent(
    studentPublicId: string,
    query: PaginationQuery & { type?: string },
  ): Promise<PaginatedResult<IWorksheet & { mySubmission?: IWorksheetSubmission }>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = {
      $or: [
        { assignedToStudentPublicIds: studentPublicId },
        { assignedToStudentPublicIds: { $size: 0 } },
      ],
      status: WorksheetStatus.PUBLISHED,
      isDeleted: false,
    };
    if (query.type) filter.type = query.type;

    const [items, total] = await Promise.all([
      WorksheetModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WorksheetModel.countDocuments(filter),
    ]);

    // Attach own submission if exists
    const worksheetPublicIds = items.map((w) => w.publicId);
    const submissions = await WorksheetSubmissionModel.find({
      worksheetPublicId: { $in: worksheetPublicIds },
      studentPublicId,
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

  async submitAnswers(
    worksheetPublicId: string,
    studentPublicId: string,
    dto: SubmitWorksheetDto,
  ): Promise<IWorksheetSubmission> {
    const worksheet = await WorksheetModel.findOne({
      publicId: worksheetPublicId,
      status: WorksheetStatus.PUBLISHED,
      isDeleted: false,
    }).lean();
    if (!worksheet) throw new NotFoundError('Worksheet not found');

    const existing = await WorksheetSubmissionModel.findOne({
      worksheetPublicId,
      studentPublicId,
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
    });

    return submission.toObject();
  }

  async getSubmissionsForWorksheet(
    worksheetPublicId: string,
    tutorPublicId: string,
  ): Promise<IWorksheetSubmission[]> {
    const worksheet = await WorksheetModel.findOne({ publicId: worksheetPublicId, tutorPublicId, isDeleted: false }).lean();
    if (!worksheet) throw new NotFoundError('Worksheet not found');

    return WorksheetSubmissionModel.find({ worksheetPublicId, isDeleted: false })
      .sort({ submittedAt: -1 })
      .lean();
  }

  async getMySubmission(
    worksheetPublicId: string,
    studentPublicId: string,
  ): Promise<IWorksheetSubmission | null> {
    return WorksheetSubmissionModel.findOne({
      worksheetPublicId,
      studentPublicId,
      isDeleted: false,
    }).lean();
  }

  async countUnsubmittedForStudent(studentPublicId: string): Promise<number> {
    const filter = {
      $or: [
        { assignedToStudentPublicIds: studentPublicId },
        { assignedToStudentPublicIds: { $size: 0 } },
      ],
      status: WorksheetStatus.PUBLISHED,
      isDeleted: false,
    };
    const total = await WorksheetModel.countDocuments(filter);
    const submitted = await WorksheetSubmissionModel.countDocuments({ studentPublicId, isDeleted: false });
    return Math.max(0, total - submitted);
  }
}

export const worksheetService = new WorksheetService();
