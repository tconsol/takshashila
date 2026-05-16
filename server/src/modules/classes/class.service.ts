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
import { TutorProfileModel } from '../tutors/tutor.model';
import { StudentProfileModel } from '../students/student.model';
import { AppError, ConflictError, NotFoundError } from '../../utils/error';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { calculateCommission } from '../../utils/currency';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';
import type { BookClassDto, CancelClassDto, RescheduleClassDto, SetMeetingUrlDto, SaveRecordingDto, TutorCreateClassDto, TutorRescheduleDto } from './class.validators';

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

    const costCents = tutorProfile.hourlyRateCents;

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
        tutorUserPublicId: tutorProfile.userPublicId,
        studentPublicId: studentProfile.publicId,
        studentUserPublicId: studentUserPublicId,
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

  async joinClass(classPublicId: string, userPublicId: string, role: string): Promise<IScheduledClass> {
    const cls = await ScheduledClassModel.findOne({ publicId: classPublicId, isDeleted: false }).lean();
    if (!cls) throw new NotFoundError('Class');

    // Verify user belongs to this class
    let authorized = false;
    if (role === 'TUTOR') {
      const tutorProfile = await TutorProfileModel.findOne({ userPublicId, isDeleted: false }, { publicId: 1 }).lean();
      authorized = tutorProfile?.publicId === cls.tutorPublicId;
    } else if (role === 'STUDENT') {
      const studentProfile = await StudentProfileModel.findOne({ userPublicId, isDeleted: false }, { publicId: 1 }).lean();
      authorized = studentProfile?.publicId === cls.studentPublicId;
    } else {
      authorized = true;
    }
    if (!authorized) throw new AppError('Not authorized to join this class', 403);

    // If already LIVE (or other terminal state), return as-is
    if (cls.status !== ClassStatus.SCHEDULED) return cls;

    // Transition SCHEDULED → LIVE
    const updated = await ScheduledClassModel.findOneAndUpdate(
      { publicId: classPublicId, status: ClassStatus.SCHEDULED, isDeleted: false },
      { $set: { status: ClassStatus.LIVE } },
      { new: true },
    ).lean();

    // Race condition — another participant won the race, fetch current state
    if (!updated) {
      return (await ScheduledClassModel.findOne({ publicId: classPublicId, isDeleted: false }).lean()) ?? cls;
    }

    // Emit with full payload so socket can invalidate both parties
    const [tutorProfile, studentProfile] = await Promise.all([
      TutorProfileModel.findOne({ publicId: cls.tutorPublicId, isDeleted: false }, { userPublicId: 1 }).lean(),
      StudentProfileModel.findOne({ publicId: cls.studentPublicId, isDeleted: false }, { userPublicId: 1 }).lean(),
    ]);

    domainEvents.emit(DomainEvent.CLASS_STARTED, {
      classPublicId,
      tutorUserPublicId: tutorProfile?.userPublicId ?? '',
      studentUserPublicId: studentProfile?.userPublicId ?? '',
    });

    return updated;
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

    const studentProfileForEvent = await StudentProfileModel.findOne(
      { publicId: scheduled.studentPublicId, isDeleted: false },
      { userPublicId: 1 },
    ).lean();

    domainEvents.emit(DomainEvent.CLASS_COMPLETED, {
      classPublicId,
      tutorPublicId: scheduled.tutorPublicId,
      tutorUserPublicId,
      studentPublicId: scheduled.studentPublicId,
      studentUserPublicId: studentProfileForEvent?.userPublicId ?? '',
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

    const [cancelledTutorProfile, cancelledStudentProfile] = await Promise.all([
      TutorProfileModel.findOne({ publicId: scheduled.tutorPublicId, isDeleted: false }, { userPublicId: 1 }).lean(),
      StudentProfileModel.findOne({ publicId: scheduled.studentPublicId, isDeleted: false }, { userPublicId: 1 }).lean(),
    ]);

    domainEvents.emit(DomainEvent.CLASS_CANCELLED, {
      classPublicId,
      cancelledBy: actorPublicId,
      reason: dto.reason,
      tutorUserPublicId: cancelledTutorProfile?.userPublicId ?? '',
      studentUserPublicId: cancelledStudentProfile?.userPublicId ?? '',
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
    const statusFilter = (query as Record<string, unknown>).status as string | undefined;
    const filter: Record<string, unknown> = {
      tutorPublicId: { $in: tutorPublicIds },
      isDeleted: false,
    };
    if (statusFilter) filter.status = statusFilter;
    const [items, total] = await Promise.all([
      ScheduledClassModel.find(filter).sort({ startUTC: -1 }).skip(skip).limit(limit).lean(),
      ScheduledClassModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async tutorCreateClasses(
    tutorUserPublicId: string,
    dto: TutorCreateClassDto,
  ): Promise<IScheduledClass[]> {
    const tutorProfile = await tutorService.getByUserPublicId(tutorUserPublicId);

    // Determine student public IDs to assign
    let studentPublicIds: string[] = dto.studentPublicIds;
    if (studentPublicIds.length === 0) {
      const allStudents = await StudentProfileModel.find(
        { tutorPublicId: tutorProfile.publicId, isDeleted: false, status: { $in: ['ACTIVE', 'APPROVED'] } },
        { publicId: 1 },
      ).lean();
      studentPublicIds = allStudents.map((s) => s.publicId);
    }

    // Build list of occurrences
    const occurrences: Array<{ start: Date; end: Date }> = [];
    const startMs = new Date(dto.startUTC).getTime();
    const endMs = new Date(dto.endUTC).getTime();
    const durationMs = endMs - startMs;

    if (dto.recurrence === 'NONE' || !dto.recurrenceEndDate) {
      occurrences.push({ start: new Date(dto.startUTC), end: new Date(dto.endUTC) });
    } else {
      const recEnd = new Date(dto.recurrenceEndDate).getTime();
      const stepMs = dto.recurrence === 'DAILY' ? 86_400_000 : 7 * 86_400_000;
      let cur = startMs;
      while (cur <= recEnd) {
        occurrences.push({ start: new Date(cur), end: new Date(cur + durationMs) });
        cur += stepMs;
        if (occurrences.length > 365) break; // safety cap
      }
    }

    // Create one ScheduledClass per occurrence × student (or just for the tutor if no students)
    const created: IScheduledClass[] = [];
    const ianaTimezone = 'UTC';
    const durationMinutes = Math.round(durationMs / 60_000);

    for (const occ of occurrences) {
      // For GROUP/RECURRING with multiple students, create one class per student so each has their own record
      const targets = studentPublicIds.length > 0 ? studentPublicIds : [''];
      for (const studentPublicId of targets) {
        const cls = await ScheduledClassModel.create({
          publicId: uuidv4(),
          tutorPublicId: tutorProfile.publicId,
          studentPublicId: studentPublicId || '',
          classType: dto.classType,
          status: ClassStatus.SCHEDULED,
          startUTC: occ.start,
          endUTC: occ.end,
          ianaTimezone,
          durationMinutes,
          title: dto.title,
          description: dto.description,
          costCents: 0,
          idempotencyKey: uuidv4(),
          isDeleted: false,
        });
        created.push(cls.toObject());
      }
    }

    // Notify assigned students via domain event
    if (studentPublicIds.length > 0) {
      const studentProfiles = await StudentProfileModel.find(
        { publicId: { $in: studentPublicIds }, isDeleted: false },
        { userPublicId: 1, publicId: 1 },
      ).lean();
      for (const sp of studentProfiles) {
        domainEvents.emit(DomainEvent.CLASS_BOOKED, {
          classPublicId: created[0]?.publicId ?? '',
          tutorPublicId: tutorProfile.publicId,
          tutorUserPublicId,
          studentPublicId: sp.publicId ?? '',
          studentUserPublicId: sp.userPublicId,
          classType: dto.classType,
          costCents: 0,
        });
      }
      // Emit specific class:created event so students get a toast notification
      domainEvents.emit(DomainEvent.CLASS_CREATED_BY_TUTOR, {
        tutorPublicId: tutorProfile.publicId,
        tutorUserPublicId,
        studentUserPublicIds: studentProfiles.map((sp) => sp.userPublicId),
        title: dto.title,
        classType: dto.classType,
        count: created.length,
      });
    }

    return created;
  }

  async tutorReschedule(
    classPublicId: string,
    tutorUserPublicId: string,
    dto: TutorRescheduleDto,
  ): Promise<IScheduledClass> {
    const tutorProfile = await tutorService.getByUserPublicId(tutorUserPublicId);
    const cls = await ScheduledClassModel.findOne({ publicId: classPublicId, isDeleted: false }).lean();
    if (!cls) throw new NotFoundError('Class');
    if (cls.tutorPublicId !== tutorProfile.publicId) throw new AppError('Not your class', 403);
    if (cls.status === ClassStatus.COMPLETED || cls.status === ClassStatus.CANCELLED) {
      throw new AppError('Cannot reschedule a completed or cancelled class', 400);
    }

    const durationMinutes = Math.round(
      (new Date(dto.endUTC).getTime() - new Date(dto.startUTC).getTime()) / 60_000,
    );

    const updated = await ScheduledClassModel.findOneAndUpdate(
      { publicId: classPublicId },
      { $set: { startUTC: new Date(dto.startUTC), endUTC: new Date(dto.endUTC), durationMinutes } },
      { new: true },
    ).lean();

    const studentProfile = await StudentProfileModel.findOne(
      { publicId: cls.studentPublicId, isDeleted: false },
      { userPublicId: 1 },
    ).lean();

    domainEvents.emit(DomainEvent.CLASS_RESCHEDULED, {
      classPublicId,
      tutorPublicId: tutorProfile.publicId,
      tutorUserPublicId,
      studentUserPublicId: studentProfile?.userPublicId ?? '',
      newStartUTC: dto.startUTC,
    });

    return updated!;
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
