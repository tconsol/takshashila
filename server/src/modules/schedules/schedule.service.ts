import { v4 as uuidv4 } from 'uuid';
import { AvailabilitySlotModel, ScheduledClassModel } from './schedule.model';
import { AvailabilityStatus } from './schedule.types';
import type { IAvailabilitySlot } from './schedule.types';
import { AppError, ConflictError, NotFoundError } from '../../utils/error';
import { doSlotsOverlap, isSlotInPast } from '../../utils/timezone';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';
import type { CreateAvailabilitySlotDto } from './schedule.validators';

export class ScheduleService {
  async createSlot(
    tutorPublicId: string,
    dto: CreateAvailabilitySlotDto,
  ): Promise<IAvailabilitySlot> {
    const start = new Date(dto.startUTC);
    const end = new Date(dto.endUTC);

    if (isSlotInPast(start)) {
      throw new AppError('Cannot create a slot in the past', 400);
    }

    await this.assertNoConflict(tutorPublicId, start, end);

    const durationMinutes = Math.round((end.getTime() - start.getTime()) / (60 * 1000));

    const slot = await AvailabilitySlotModel.create({
      publicId: uuidv4(),
      tutorPublicId,
      startUTC: start,
      endUTC: end,
      ianaTimezone: dto.ianaTimezone,
      durationMinutes,
      status: AvailabilityStatus.AVAILABLE,
      isRecurring: dto.isRecurring || false,
      isDeleted: false,
    });

    return slot.toObject();
  }

  async getAvailableSlots(
    tutorPublicId: string,
    from?: Date,
    to?: Date,
    query?: PaginationQuery,
  ): Promise<PaginatedResult<IAvailabilitySlot>> {
    const { page, limit, skip } = parsePaginationQuery(query || {});

    const filter: Record<string, unknown> = {
      tutorPublicId,
      status: AvailabilityStatus.AVAILABLE,
      isDeleted: false,
      startUTC: { $gte: from || new Date() },
    };
    if (to) filter.endUTC = { $lte: to };

    const [items, total] = await Promise.all([
      AvailabilitySlotModel.find(filter).sort({ startUTC: 1 }).skip(skip).limit(limit).lean(),
      AvailabilitySlotModel.countDocuments(filter),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  async getSlotByPublicId(publicId: string): Promise<IAvailabilitySlot> {
    const slot = await AvailabilitySlotModel.findOne({ publicId, isDeleted: false }).lean();
    if (!slot) throw new NotFoundError('Availability slot');
    return slot;
  }

  async getMyCalendar(tutorPublicId: string, from: Date, to: Date): Promise<IAvailabilitySlot[]> {
    return AvailabilitySlotModel.find({
      tutorPublicId,
      isDeleted: false,
      startUTC: { $gte: from, $lte: to },
    })
      .sort({ startUTC: 1 })
      .lean();
  }

  async blockSlot(publicId: string): Promise<IAvailabilitySlot> {
    const slot = await AvailabilitySlotModel.findOneAndUpdate(
      { publicId, status: AvailabilityStatus.AVAILABLE, isDeleted: false },
      { $set: { status: AvailabilityStatus.BOOKED } },
      { new: true },
    ).lean();

    if (!slot) throw new ConflictError('Slot is no longer available');
    return slot;
  }

  async releaseSlot(publicId: string): Promise<void> {
    await AvailabilitySlotModel.updateOne(
      { publicId },
      { $set: { status: AvailabilityStatus.AVAILABLE } },
    );
  }

  async deleteSlot(publicId: string, tutorPublicId: string): Promise<void> {
    const slot = await AvailabilitySlotModel.findOne({ publicId, tutorPublicId, isDeleted: false });
    if (!slot) throw new NotFoundError('Availability slot');

    if (slot.status === AvailabilityStatus.BOOKED) {
      throw new ConflictError('Cannot delete a booked slot');
    }

    await AvailabilitySlotModel.updateOne({ publicId }, { $set: { isDeleted: true } });
  }

  async checkConflicts(
    tutorPublicId: string,
    start: Date,
    end: Date,
    excludeSlotId?: string,
  ): Promise<boolean> {
    const filter: Record<string, unknown> = {
      tutorPublicId,
      isDeleted: false,
      $or: [
        { startUTC: { $lt: end }, endUTC: { $gt: start } },
      ],
    };
    if (excludeSlotId) filter.publicId = { $ne: excludeSlotId };

    const count = await AvailabilitySlotModel.countDocuments(filter);
    return count > 0;
  }

  private async assertNoConflict(
    tutorPublicId: string,
    start: Date,
    end: Date,
  ): Promise<void> {
    const hasConflict = await this.checkConflicts(tutorPublicId, start, end);
    if (hasConflict) {
      throw new ConflictError('Slot overlaps with an existing availability slot');
    }
  }
}

export const scheduleService = new ScheduleService();
