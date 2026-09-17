import { v4 as uuidv4 } from 'uuid';
import { AvailabilitySlotModel, ScheduledClassModel } from './schedule.model';
import { AvailabilityStatus } from './schedule.types';
import type { IAvailabilitySlot } from './schedule.types';
import { AppError, ConflictError, NotFoundError } from '../../utils/error';
import { doSlotsOverlap, isSlotInPast } from '../../utils/timezone';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';
import type { CreateAvailabilitySlotDto, RescheduleSlotDto } from './schedule.validators';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { logger } from '../../lib/logger';
import type { RecurrenceDto } from './schedule.validators';

const DAY_MS = 24 * 60 * 60 * 1000;

const STEP_DAYS: Record<RecurrenceDto['frequency'], number> = {
  DAILY: 1,
  WEEKLY: 7,
  BIWEEKLY: 14,
};

/**
 * Turns one slot plus a rule into the list of concrete occurrences.
 *
 * Steps in whole days of fixed length, which keeps every occurrence at the same
 * UTC instant-of-day. Slots are stored in UTC with the tutor's IANA zone
 * alongside, so a series that crosses a DST boundary shifts by an hour in local
 * time — acceptable here, and far less surprising than the alternative of the
 * UTC time drifting for everyone else in the class.
 */
function expandRecurrence(
  start: Date,
  end: Date,
  recurrence?: RecurrenceDto,
): { start: Date; end: Date }[] {
  if (!recurrence) return [{ start, end }];

  const step = STEP_DAYS[recurrence.frequency] * DAY_MS;
  return Array.from({ length: recurrence.count }, (_, i) => ({
    start: new Date(start.getTime() + i * step),
    end: new Date(end.getTime() + i * step),
  }));
}

export class ScheduleService {
  async createSlot(
    tutorPublicId: string,
    dto: CreateAvailabilitySlotDto,
  ): Promise<IAvailabilitySlot> {
    const [first] = await this.createSlots(tutorPublicId, dto);
    return first;
  }

  /**
   * Creates a slot, expanding a recurrence rule into one row per occurrence.
   *
   * Materialising each occurrence (rather than storing a rule and computing
   * dates on read) means booking, conflict-checking and cancellation all keep
   * working unchanged — one occurrence can be cancelled without disturbing the
   * rest of the series. They share a `recurringRuleId` so the series is still
   * identifiable.
   *
   * Occurrences that collide with an existing slot are skipped rather than
   * failing the whole request: a tutor adding a weekly slot for a term should
   * not be blocked by one week they are already booked.
   */
  async createSlots(
    tutorPublicId: string,
    dto: CreateAvailabilitySlotDto,
  ): Promise<IAvailabilitySlot[]> {
    const start = new Date(dto.startUTC);
    const end = new Date(dto.endUTC);

    if (isSlotInPast(start)) {
      throw new AppError('Cannot create a slot in the past', 400);
    }

    const durationMinutes = Math.round((end.getTime() - start.getTime()) / (60 * 1000));
    const occurrences = expandRecurrence(start, end, dto.isRecurring ? dto.recurrence : undefined);
    const recurringRuleId = occurrences.length > 1 ? uuidv4() : undefined;

    const created: IAvailabilitySlot[] = [];
    const skipped: Date[] = [];

    for (const occurrence of occurrences) {
      try {
        await this.assertNoConflict(tutorPublicId, occurrence.start, occurrence.end);
      } catch (error) {
        // The very first occurrence is the one the tutor explicitly picked, so a
        // clash there is a real error; later ones are generated, so skip them.
        if (created.length === 0 && skipped.length === 0) throw error;
        skipped.push(occurrence.start);
        continue;
      }

      const slot = await AvailabilitySlotModel.create({
        publicId: uuidv4(),
        tutorPublicId,
        startUTC: occurrence.start,
        endUTC: occurrence.end,
        ianaTimezone: dto.ianaTimezone,
        durationMinutes,
        status: AvailabilityStatus.AVAILABLE,
        isRecurring: occurrences.length > 1,
        recurringRuleId,
        isDeleted: false,
      });
      created.push(slot.toObject());
    }

    if (created.length === 0) {
      throw new AppError('Every occurrence clashed with an existing slot', 409);
    }

    if (skipped.length > 0) {
      logger.info('Skipped clashing occurrences while creating a recurring slot', {
        tutorPublicId,
        created: created.length,
        skipped: skipped.length,
      });
    }

    domainEvents.emit(DomainEvent.SLOT_CREATED, {
      tutorPublicId,
      slotPublicId: created[0].publicId,
      occurrences: created.length,
    });

    return created;
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

  async cancelSlot(publicId: string, tutorPublicId: string): Promise<IAvailabilitySlot> {
    const slot = await AvailabilitySlotModel.findOne({ publicId, tutorPublicId, isDeleted: false });
    if (!slot) throw new NotFoundError('Availability slot');

    if (slot.status === AvailabilityStatus.BOOKED) {
      throw new ConflictError('Cannot cancel a booked slot cancel the class first');
    }

    const updated = await AvailabilitySlotModel.findOneAndUpdate(
      { publicId },
      { $set: { status: AvailabilityStatus.CANCELLED } },
      { new: true },
    ).lean();

    domainEvents.emit(DomainEvent.SLOT_CANCELLED, {
      tutorPublicId,
      slotPublicId: publicId,
    });

    return updated!;
  }

  async rescheduleSlot(publicId: string, tutorPublicId: string, dto: RescheduleSlotDto): Promise<IAvailabilitySlot> {
    const slot = await AvailabilitySlotModel.findOne({ publicId, tutorPublicId, isDeleted: false });
    if (!slot) throw new NotFoundError('Availability slot');

    if (slot.status === AvailabilityStatus.BOOKED) {
      throw new ConflictError('Cannot reschedule a booked slot reschedule the class instead');
    }

    const start = new Date(dto.startUTC);
    const end = new Date(dto.endUTC);

    if (isSlotInPast(start)) throw new AppError('Cannot reschedule to a time in the past', 400);

    await this.assertNoConflict(tutorPublicId, start, end, publicId);

    const durationMinutes = Math.round((end.getTime() - start.getTime()) / (60 * 1000));

    const updated = await AvailabilitySlotModel.findOneAndUpdate(
      { publicId },
      { $set: { startUTC: start, endUTC: end, durationMinutes, status: AvailabilityStatus.AVAILABLE } },
      { new: true },
    ).lean();

    domainEvents.emit(DomainEvent.SLOT_RESCHEDULED, {
      tutorPublicId,
      slotPublicId: publicId,
    });

    return updated!;
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
      status: { $ne: AvailabilityStatus.CANCELLED },
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
    excludeSlotId?: string,
  ): Promise<void> {
    const hasConflict = await this.checkConflicts(tutorPublicId, start, end, excludeSlotId);
    if (hasConflict) {
      throw new ConflictError('Slot overlaps with an existing availability slot');
    }
  }
}

export const scheduleService = new ScheduleService();
