import { v4 as uuidv4 } from 'uuid';
import { WorksheetModel } from './worksheet.model';
import type { IWorksheet, CreateWorksheetDto, UpdateWorksheetDto } from './worksheet.types';
import { NotFoundError, AppError } from '../../utils/error';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';

export class WorksheetService {
  async create(tutorPublicId: string, dto: CreateWorksheetDto): Promise<IWorksheet> {
    const worksheet = await WorksheetModel.create({
      publicId: uuidv4(),
      tutorPublicId,
      title: dto.title,
      description: dto.description,
      content: dto.content ?? '',
      fileUrl: dto.fileUrl,
      subject: dto.subject,
      sharedWithStudentPublicIds: dto.sharedWithStudentPublicIds ?? [],
    });
    return worksheet.toObject();
  }

  async getByTutor(tutorPublicId: string, query: PaginationQuery): Promise<PaginatedResult<IWorksheet>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter = { tutorPublicId, isDeleted: false };

    const [items, total] = await Promise.all([
      WorksheetModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WorksheetModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async getForStudent(studentPublicId: string, query: PaginationQuery): Promise<PaginatedResult<IWorksheet>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter = {
      $or: [
        { sharedWithStudentPublicIds: studentPublicId },
        { sharedWithStudentPublicIds: { $size: 0 } },
      ],
      status: 'PUBLISHED',
      isDeleted: false,
    };

    const [items, total] = await Promise.all([
      WorksheetModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WorksheetModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async getByPublicId(publicId: string): Promise<IWorksheet> {
    const worksheet = await WorksheetModel.findOne({ publicId, isDeleted: false }).lean();
    if (!worksheet) throw new NotFoundError('Worksheet not found');
    return worksheet;
  }

  async update(publicId: string, tutorPublicId: string, dto: UpdateWorksheetDto): Promise<IWorksheet> {
    const worksheet = await WorksheetModel.findOneAndUpdate(
      { publicId, tutorPublicId, isDeleted: false },
      { $set: dto },
      { new: true },
    ).lean();
    if (!worksheet) throw new NotFoundError('Worksheet not found');
    return worksheet;
  }

  async publish(publicId: string, tutorPublicId: string): Promise<IWorksheet> {
    const worksheet = await WorksheetModel.findOneAndUpdate(
      { publicId, tutorPublicId, isDeleted: false },
      { $set: { status: 'PUBLISHED' } },
      { new: true },
    ).lean();
    if (!worksheet) throw new NotFoundError('Worksheet not found');
    return worksheet;
  }

  async unpublish(publicId: string, tutorPublicId: string): Promise<IWorksheet> {
    const worksheet = await WorksheetModel.findOneAndUpdate(
      { publicId, tutorPublicId, isDeleted: false },
      { $set: { status: 'DRAFT' } },
      { new: true },
    ).lean();
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

  async shareWithStudents(publicId: string, tutorPublicId: string, studentPublicIds: string[]): Promise<IWorksheet> {
    const worksheet = await WorksheetModel.findOne({ publicId, tutorPublicId, isDeleted: false }).lean();
    if (!worksheet) throw new NotFoundError('Worksheet not found');

    const updated = await WorksheetModel.findOneAndUpdate(
      { publicId, tutorPublicId },
      { $addToSet: { sharedWithStudentPublicIds: { $each: studentPublicIds } } },
      { new: true },
    ).lean();
    return updated!;
  }
}

export const worksheetService = new WorksheetService();
