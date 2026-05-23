import { v4 as uuidv4 } from 'uuid';
import { RatingModel } from './rating.model';
import type { IRating, SubmitRatingDto } from './rating.types';
import { ScheduledClassModel } from '../schedules/schedule.model';
import { TutorProfileModel } from '../tutors/tutor.model';
import { ClassStatus } from '../schedules/schedule.types';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';

export class RatingService {
  async submitRating(raterPublicId: string, dto: SubmitRatingDto): Promise<IRating> {
    if (dto.score < 1 || dto.score > 5) {
      throw Object.assign(new Error('Score must be between 1 and 5'), { statusCode: 400 });
    }

    const cls = await ScheduledClassModel.findOne({ publicId: dto.classPublicId, isDeleted: false });
    if (!cls) throw Object.assign(new Error('Class not found'), { statusCode: 404 });

    if (cls.status !== ClassStatus.COMPLETED) {
      throw Object.assign(new Error('Class must be completed before rating'), { statusCode: 400 });
    }

    if (cls.studentPublicId !== raterPublicId) {
      throw Object.assign(new Error('Only the student of this class can submit a rating'), { statusCode: 403 });
    }

    const existing = await RatingModel.findOne({ classPublicId: dto.classPublicId, raterPublicId });
    if (existing) throw Object.assign(new Error('You have already rated this class'), { statusCode: 409 });

    const rating = await RatingModel.create({
      publicId: uuidv4(),
      classPublicId: dto.classPublicId,
      raterPublicId,
      tutorPublicId: cls.tutorPublicId,
      score: dto.score,
      comment: dto.comment,
    });

    await this.recomputeTutorRating(cls.tutorPublicId);

    domainEvents.emit(DomainEvent.TUTOR_RATED, {
      tutorPublicId: cls.tutorPublicId,
      raterPublicId,
      classPublicId: dto.classPublicId,
      score: dto.score,
    });

    return rating.toObject();
  }

  async getRatingsForTutor(
    tutorPublicId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<IRating>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const [items, total] = await Promise.all([
      RatingModel.find({ tutorPublicId, isDeleted: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RatingModel.countDocuments({ tutorPublicId, isDeleted: false }),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async getMyRatingForClass(classPublicId: string, raterPublicId: string): Promise<IRating | null> {
    return RatingModel.findOne({ classPublicId, raterPublicId, isDeleted: false }).lean();
  }

  async getMyRatedClassIds(raterPublicId: string): Promise<string[]> {
    const docs = await RatingModel.find({ raterPublicId, isDeleted: false }).select('classPublicId').lean();
    return docs.map((d) => d.classPublicId);
  }

  private async recomputeTutorRating(tutorPublicId: string): Promise<void> {
    const result = await RatingModel.aggregate([
      { $match: { tutorPublicId, isDeleted: false } },
      { $group: { _id: null, avg: { $avg: '$score' }, count: { $sum: 1 } } },
    ]);
    const { avg = 0, count = 0 } = result[0] ?? {};
    await TutorProfileModel.updateOne(
      { publicId: tutorPublicId },
      { $set: { rating: Math.round(avg * 10) / 10, ratingCount: count } },
    );
  }
}

export const ratingService = new RatingService();
