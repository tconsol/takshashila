import { v4 as uuidv4 } from 'uuid';
import { ScheduledClassModel } from '../schedules/schedule.model';
import { ClassStatus, ClassType } from '../schedules/schedule.types';
import type { IScheduledClass } from '../schedules/schedule.types';
import { scheduleService } from '../schedules/schedule.service';
import { walletService } from '../wallets/wallet.service';
import { CreditType } from '../wallets/wallet.types';
import { studentService } from '../students/student.service';
import { tutorService } from '../tutors/tutor.service';
import { tutorRepository } from '../tutors/tutor.repository';
import { principalService } from '../principals/principal.service';
import { AppError, ConflictError, NotFoundError } from '../../utils/error';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { calculateCommission } from '../../utils/currency';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';
import type { BookClassDto, CancelClassDto, RescheduleClassDto, SetMeetingUrlDto, SaveRecordingDto } from './class.validators';

export class ClassService {
  async bookClass(
    studentUserPublicId: string,
    dto: BookClassDto,
  ): Promise<IScheduledClass> {
    const existingByKey = await ScheduledClassModel.findOne({
      idempotencyKey: dto.idempotencyKey,
    }).lean();
    if (existingByKey) return existingByKey;

    const slot = await scheduleService.getSlotByPublicId(dto.availabilitySlotPublicId);

    if (slot.tutorPublicId !== dto.tutorPublicId) {
      throw new AppError('Slot does not belong to the specified tutor', 400);
    }

    const tutorProfile = await tutorService.getByPublicId(dto.tutorPublicId);
    const studentProfile = await studentService.getByUserPublicId(studentUserPublicId);

    const costCents = dto.classType === ClassType.DEMO ? 0 : tutorProfile.hourlyRateCents;

    await scheduleService.blockSlot(slot.publicId);

    try {
      if (costCents > 0) {
        await walletService.debitWallet({
          ownerPublicId: studentUserPublicId,
          amountCents: costCents,
          description: `Booking: ${dto.title}`,
          idempotencyKey: `booking-debit-${dto.idempotencyKey}`,
          referenceId: dto.availabilitySlotPublicId,
          referenceType: 'BOOKING',
        });
      }

      if (dto.classType === ClassType.DEMO) {
        const canUse = await studentService.canUseDemoCredit(studentUserPublicId, dto.tutorPublicId);
        if (!canUse) {
          throw new AppError('Demo credit not available for this tutor', 400);
        }
        await studentService.recordDemoClassUsed(studentProfile.publicId, dto.tutorPublicId);
        domainEvents.emit(DomainEvent.DEMO_USED, {
          studentPublicId: studentProfile.publicId,
          tutorPublicId: dto.tutorPublicId,
        });
      }

      const scheduledClass = await ScheduledClassModel.create({
        publicId: uuidv4(),
        tutorPublicId: dto.tutorPublicId,
        studentPublicId: studentProfile.publicId,
        availabilitySlotPublicId: slot.publicId,
        classType: dto.classType,
        status: ClassStatus.SCHEDULED,
        startUTC: slot.startUTC,
        endUTC: slot.endUTC,
        ianaTimezone: slot.ianaTimezone,
        durationMinutes: slot.durationMinutes,
        title: dto.title,
        description: dto.description,
        costCents,
        idempotencyKey: dto.idempotencyKey,
        isDeleted: false,
      });

      domainEvents.emit(DomainEvent.CLASS_BOOKED, {
        classPublicId: scheduledClass.publicId,
        tutorPublicId: dto.tutorPublicId,
        studentPublicId: studentProfile.publicId,
        classType: dto.classType,
        costCents,
      });

      return scheduledClass.toObject();
    } catch (error) {
      await scheduleService.releaseSlot(slot.publicId);
      throw error;
    }
  }

  async startClass(classPublicId: string, tutorUserPublicId: string): Promise<IScheduledClass> {
    const scheduled = await ScheduledClassModel.findOneAndUpdate(
      {
        publicId: classPublicId,
        status: ClassStatus.SCHEDULED,
        isDeleted: false,
      },
      { $set: { status: ClassStatus.LIVE } },
      { new: true },
    ).lean();

    if (!scheduled) throw new NotFoundError('Scheduled class');

    domainEvents.emit(DomainEvent.CLASS_STARTED, {
      classPublicId,
      tutorUserPublicId,
    });

    return scheduled;
  }

  async completeClass(classPublicId: string, tutorUserPublicId: string): Promise<IScheduledClass> {
    const scheduled = await ScheduledClassModel.findOne({
      publicId: classPublicId,
      isDeleted: false,
    }).lean();

    if (!scheduled) throw new NotFoundError('Scheduled class');
    if (scheduled.status !== ClassStatus.LIVE && scheduled.status !== ClassStatus.SCHEDULED) {
      throw new ConflictError(`Cannot complete class in status: ${scheduled.status}`);
    }

    const updated = await ScheduledClassModel.findOneAndUpdate(
      { publicId: classPublicId },
      { $set: { status: ClassStatus.COMPLETED } },
      { new: true },
    ).lean();

    if (scheduled.costCents > 0) {
      const tutorProfile = await tutorService.getByPublicId(scheduled.tutorPublicId);
      const commissionCents = calculateCommission(
        scheduled.costCents,
        tutorProfile.commissionRatePercent,
      );
      const tutorEarningsCents = scheduled.costCents - commissionCents;

      await walletService.creditWallet({
        ownerPublicId: scheduled.tutorPublicId,
        amountCents: tutorEarningsCents,
        creditType: CreditType.EARNED_CREDITS,
        description: `Earnings: ${scheduled.title}`,
        idempotencyKey: `tutor-earning-${classPublicId}`,
        referenceId: classPublicId,
        referenceType: 'CLASS_COMPLETION',
      });

      await tutorService.recordClassCompleted(scheduled.tutorPublicId, tutorEarningsCents);
    }

    domainEvents.emit(DomainEvent.CLASS_COMPLETED, {
      classPublicId,
      tutorPublicId: scheduled.tutorPublicId,
      studentPublicId: scheduled.studentPublicId,
      costCents: scheduled.costCents,
    });

    return updated!;
  }

  async cancelClass(
    classPublicId: string,
    actorPublicId: string,
    dto: CancelClassDto,
  ): Promise<IScheduledClass> {
    const scheduled = await ScheduledClassModel.findOne({
      publicId: classPublicId,
      isDeleted: false,
    }).lean();

    if (!scheduled) throw new NotFoundError('Scheduled class');

    if (![ClassStatus.SCHEDULED, ClassStatus.LIVE].includes(scheduled.status as any)) {
      throw new ConflictError(`Cannot cancel class in status: ${scheduled.status}`);
    }

    const updated = await ScheduledClassModel.findOneAndUpdate(
      { publicId: classPublicId },
      {
        $set: {
          status: ClassStatus.CANCELLED,
          cancellationReason: dto.reason,
          cancelledBy: actorPublicId,
        },
      },
      { new: true },
    ).lean();

    if (scheduled.availabilitySlotPublicId) {
      await scheduleService.releaseSlot(scheduled.availabilitySlotPublicId);
    }

    if (scheduled.costCents > 0) {
      await walletService.creditWallet({
        ownerPublicId: scheduled.studentPublicId,
        amountCents: scheduled.costCents,
        creditType: CreditType.PURCHASED_CREDITS,
        description: `Refund: ${scheduled.title}`,
        idempotencyKey: `refund-${classPublicId}`,
        referenceId: classPublicId,
        referenceType: 'CLASS_CANCELLATION',
      });
    }

    await tutorService.recordClassCancelled(scheduled.tutorPublicId);

    domainEvents.emit(DomainEvent.CLASS_CANCELLED, {
      classPublicId,
      cancelledBy: actorPublicId,
      reason: dto.reason,
    });

    return updated!;
  }

  async setMeetingUrl(
    classPublicId: string,
    dto: SetMeetingUrlDto,
  ): Promise<IScheduledClass> {
    const updated = await ScheduledClassModel.findOneAndUpdate(
      { publicId: classPublicId, isDeleted: false },
      { $set: { meetingUrl: dto.meetingUrl, meetingProvider: dto.meetingProvider, meetingId: dto.meetingId } },
      { new: true },
    ).lean();
    if (!updated) throw new NotFoundError('Scheduled class');
    return updated;
  }

  async getClassesByTutor(
    tutorPublicId: string,
    filters: { status?: string; from?: Date; to?: Date },
    query: PaginationQuery,
  ): Promise<PaginatedResult<IScheduledClass>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { tutorPublicId, isDeleted: false };
    if (filters.status) filter.status = filters.status;
    if (filters.from || filters.to) {
      filter.startUTC = {};
      if (filters.from) (filter.startUTC as Record<string, unknown>).$gte = filters.from;
      if (filters.to) (filter.startUTC as Record<string, unknown>).$lte = filters.to;
    }

    const [items, total] = await Promise.all([
      ScheduledClassModel.find(filter).sort({ startUTC: -1 }).skip(skip).limit(limit).lean(),
      ScheduledClassModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async getClassesByStudent(
    studentPublicId: string,
    filters: { status?: string; from?: Date; to?: Date },
    query: PaginationQuery,
  ): Promise<PaginatedResult<IScheduledClass>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { studentPublicId, isDeleted: false };
    if (filters.status) filter.status = filters.status;
    if (filters.from || filters.to) {
      filter.startUTC = {};
      if (filters.from) (filter.startUTC as Record<string, unknown>).$gte = filters.from;
      if (filters.to) (filter.startUTC as Record<string, unknown>).$lte = filters.to;
    }

    const [items, total] = await Promise.all([
      ScheduledClassModel.find(filter).sort({ startUTC: -1 }).skip(skip).limit(limit).lean(),
      ScheduledClassModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async getByPublicId(publicId: string): Promise<IScheduledClass> {
    const c = await ScheduledClassModel.findOne({ publicId, isDeleted: false }).lean();
    if (!c) throw new NotFoundError('Class');
    return c;
  }

  async getLiveClassesForPrincipal(
    principalUserPublicId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<IScheduledClass>> {
    const principalProfile = await principalService.getByUserPublicId(principalUserPublicId);
    // Find all tutors under this principal
    const tutorResult = await tutorRepository.findByPrincipal(principalProfile.publicId, { limit: '500' } as PaginationQuery);
    const tutorPublicIds = tutorResult.items.map((t) => t.publicId);
    if (tutorPublicIds.length === 0) {
      return buildPaginatedResult([], 0, 1, 20);
    }
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = {
      tutorPublicId: { $in: tutorPublicIds },
      status: ClassStatus.LIVE,
      isDeleted: false,
    };
    const [items, total] = await Promise.all([
      ScheduledClassModel.find(filter).sort({ startUTC: -1 }).skip(skip).limit(limit).lean(),
      ScheduledClassModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async saveRecording(
    classPublicId: string,
    actorPublicId: string,
    dto: SaveRecordingDto,
  ): Promise<IScheduledClass> {
    const cls = await ScheduledClassModel.findOne({ publicId: classPublicId, isDeleted: false }).lean();
    if (!cls) throw new NotFoundError('Class');
    if (cls.tutorPublicId !== actorPublicId) {
      const tutorProfile = await tutorService.getByPublicId(cls.tutorPublicId);
      if (tutorProfile.userPublicId !== actorPublicId) {
        throw new AppError('Only the class tutor can save a recording', 403);
      }
    }
    const updated = await ScheduledClassModel.findOneAndUpdate(
      { publicId: classPublicId },
      { $set: { recordingUrl: dto.recordingUrl, recordingGcsKey: dto.gcsObjectKey } },
      { new: true },
    ).lean();
    return updated!;
  }
}

export const classService = new ClassService();
