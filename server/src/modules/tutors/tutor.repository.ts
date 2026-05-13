import { TutorProfileModel } from './tutor.model';
import type { ITutorProfile, TutorSearchFilters } from './tutor.types';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';

export class TutorRepository {
  async create(data: Omit<ITutorProfile, '_id' | 'createdAt' | 'updatedAt'>): Promise<ITutorProfile> {
    const doc = await TutorProfileModel.create(data);
    return doc.toObject();
  }

  async findByUserPublicId(userPublicId: string): Promise<ITutorProfile | null> {
    return TutorProfileModel.findOne({ userPublicId, isDeleted: false }).lean();
  }

  async findByPublicId(publicId: string): Promise<ITutorProfile | null> {
    return TutorProfileModel.findOne({ publicId, isDeleted: false }).lean();
  }

  async update(publicId: string, updates: Partial<ITutorProfile>): Promise<ITutorProfile | null> {
    return TutorProfileModel.findOneAndUpdate(
      { publicId, isDeleted: false },
      { $set: updates },
      { new: true },
    ).lean();
  }

  async search(
    filters: TutorSearchFilters,
    query: PaginationQuery,
  ): Promise<PaginatedResult<ITutorProfile>> {
    const { page, limit, skip, sortBy, sortOrder } = parsePaginationQuery(query);

    const filter: Record<string, unknown> = { isDeleted: false, status: 'ACTIVE' };
    if (filters.subject) filter.subjects = { $in: [filters.subject] };
    if (filters.language) filter.languages = { $in: [filters.language] };
    if (filters.timezone) filter.timezone = filters.timezone;
    if (filters.minRating) filter.rating = { $gte: filters.minRating };
    if (filters.maxHourlyRateCents) filter.hourlyRateCents = { $lte: filters.maxHourlyRateCents };
    if (filters.isVerified !== undefined) filter.isVerified = filters.isVerified;
    if (filters.principalPublicId) filter.principalPublicId = filters.principalPublicId;

    const [items, total] = await Promise.all([
      TutorProfileModel.find(filter)
        .sort({ [sortBy]: sortOrder } as Record<string, 1 | -1>)
        .skip(skip)
        .limit(limit)
        .lean(),
      TutorProfileModel.countDocuments(filter),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  async findByPrincipal(
    principalPublicId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<ITutorProfile>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter = { principalPublicId, isDeleted: false };

    const [items, total] = await Promise.all([
      TutorProfileModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      TutorProfileModel.countDocuments(filter),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  async findPending(
    query: PaginationQuery,
    principalPublicId?: string,
  ): Promise<PaginatedResult<ITutorProfile>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = {
      isDeleted: false,
      status: { $in: ['UNDER_VERIFICATION', 'REGISTERED'] },
    };
    if (principalPublicId) filter.principalPublicId = principalPublicId;

    const [items, total] = await Promise.all([
      TutorProfileModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      TutorProfileModel.countDocuments(filter),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  async incrementStats(
    publicId: string,
    inc: Partial<Pick<ITutorProfile, 'totalStudents' | 'totalClassesCompleted' | 'totalClassesCancelled' | 'totalEarningsCents'>>,
  ): Promise<void> {
    await TutorProfileModel.updateOne({ publicId }, { $inc: inc });
  }

  async softDelete(publicId: string, deletedBy: string): Promise<void> {
    await TutorProfileModel.updateOne(
      { publicId },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy } },
    );
  }
}

export const tutorRepository = new TutorRepository();
