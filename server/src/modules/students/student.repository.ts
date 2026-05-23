import { StudentProfileModel } from './student.model';
import type { IStudentProfile } from './student.types';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';

export class StudentRepository {
  async create(data: Omit<IStudentProfile, '_id' | 'createdAt' | 'updatedAt'>): Promise<IStudentProfile> {
    const doc = await StudentProfileModel.create(data);
    return doc.toObject();
  }

  async findByPublicId(publicId: string): Promise<IStudentProfile | null> {
    return StudentProfileModel.findOne({ publicId, isDeleted: false }).lean();
  }

  async findByUserPublicId(userPublicId: string): Promise<IStudentProfile | null> {
    return StudentProfileModel.findOne({ userPublicId, isDeleted: false }).lean();
  }

  async findByUserAndTutor(userPublicId: string, tutorPublicId: string): Promise<IStudentProfile | null> {
    return StudentProfileModel.findOne({ userPublicId, tutorPublicId, isDeleted: false }).lean();
  }

  async update(publicId: string, updates: Partial<IStudentProfile>): Promise<IStudentProfile | null> {
    return StudentProfileModel.findOneAndUpdate(
      { publicId, isDeleted: false },
      { $set: updates },
      { new: true },
    ).lean();
  }

  async findByTutor(
    tutorPublicId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<IStudentProfile>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter = { tutorPublicId, isDeleted: false };

    const [items, total] = await Promise.all([
      StudentProfileModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      StudentProfileModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async incrementStats(
    publicId: string,
    inc: Partial<Pick<IStudentProfile, 'totalClassesAttended' | 'totalClassesMissed' | 'totalClassesBooked' | 'demoClassesUsed'>>,
  ): Promise<void> {
    await StudentProfileModel.updateOne({ publicId }, { $inc: inc });
  }

  async updateAttendanceRate(publicId: string): Promise<void> {
    const profile = await StudentProfileModel.findOne({ publicId });
    if (!profile) return;
    const total = profile.totalClassesAttended + profile.totalClassesMissed;
    if (total === 0) return;
    const rate = Math.round((profile.totalClassesAttended / total) * 100);
    await StudentProfileModel.updateOne({ publicId }, { $set: { attendanceRate: rate } });
  }

  async findAll(
    query: PaginationQuery & { status?: string },
  ): Promise<PaginatedResult<IStudentProfile>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { isDeleted: false };
    if (query.status) filter.status = query.status;

    const [items, total] = await Promise.all([
      StudentProfileModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      StudentProfileModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async findPending(query: PaginationQuery): Promise<PaginatedResult<IStudentProfile>> {
    return this.findAll({ ...query, status: 'PENDING_APPROVAL' });
  }

  async findByTutorIds(
    tutorPublicIds: string[],
    query: PaginationQuery & { status?: string },
  ): Promise<PaginatedResult<IStudentProfile>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { tutorPublicId: { $in: tutorPublicIds }, isDeleted: false };
    if (query.status) filter.status = query.status;

    const [items, total] = await Promise.all([
      StudentProfileModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      StudentProfileModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async softDelete(publicId: string, deletedBy: string): Promise<void> {
    await StudentProfileModel.updateOne(
      { publicId },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy } },
    );
  }
}

export const studentRepository = new StudentRepository();
