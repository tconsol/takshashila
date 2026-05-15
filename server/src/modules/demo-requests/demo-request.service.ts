import { v4 as uuidv4 } from 'uuid';
import { DemoRequestModel } from './demo-request.model';
import { DemoRequestStatus } from './demo-request.types';
import type { IDemoRequest } from './demo-request.types';
import type { CreateDemoRequestDto, RejectDemoRequestDto } from './demo-request.validators';
import { scheduleService } from '../schedules/schedule.service';
import { studentService } from '../students/student.service';
import { tutorService } from '../tutors/tutor.service';
import { tutorRepository } from '../tutors/tutor.repository';
import { AvailabilitySlotModel, ScheduledClassModel } from '../schedules/schedule.model';
import { StudentProfileModel } from '../students/student.model';
import { TutorProfileModel } from '../tutors/tutor.model';
import { StudentStatus } from '../students/student.types';
import { ClassType, ClassStatus } from '../schedules/schedule.types';
import { walletService } from '../wallets/wallet.service';
import { AppError, ConflictError, NotFoundError } from '../../utils/error';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';

async function getOrCreateStudentProfile(userPublicId: string) {
  try {
    return await studentService.getByUserPublicId(userPublicId);
  } catch {
    // Profile missing — create it for legacy accounts
    const created = await StudentProfileModel.create({
      publicId: uuidv4(),
      userPublicId,
      previousTutorPublicIds: [],
      status: StudentStatus.PENDING_APPROVAL,
      demoClassesUsed: 0,
      demoClassTakenWith: [],
      totalClassesAttended: 0,
      totalClassesCancelled: 0,
      totalClassesMissed: 0,
      totalClassesBooked: 0,
      attendanceRate: 0,
      invitedBy: userPublicId,
      isDeleted: false,
    });
    return created.toObject();
  }
}

type EnrichedDemoRequest = IDemoRequest & {
  slotStartUTC?: Date;
  slotEndUTC?: Date;
  slotTimezone?: string;
};

async function enrichWithSlot(items: IDemoRequest[]): Promise<EnrichedDemoRequest[]> {
  if (items.length === 0) return [];
  const slotIds = items.map((r) => r.availabilitySlotPublicId);
  const slots = await AvailabilitySlotModel.find(
    { publicId: { $in: slotIds } },
    { publicId: 1, startUTC: 1, endUTC: 1, ianaTimezone: 1 },
  ).lean();
  const slotMap = new Map(slots.map((s) => [s.publicId, s]));
  return items.map((r) => ({
    ...r,
    slotStartUTC: slotMap.get(r.availabilitySlotPublicId)?.startUTC,
    slotEndUTC: slotMap.get(r.availabilitySlotPublicId)?.endUTC,
    slotTimezone: slotMap.get(r.availabilitySlotPublicId)?.ianaTimezone,
  }));
}

export class DemoRequestService {
  async create(studentUserPublicId: string, dto: CreateDemoRequestDto): Promise<IDemoRequest> {
    const studentProfile = await getOrCreateStudentProfile(studentUserPublicId);
    const slot = await scheduleService.getSlotByPublicId(dto.availabilitySlotPublicId);

    if (slot.tutorPublicId !== dto.tutorPublicId) {
      throw new AppError('Slot does not belong to the specified tutor', 400);
    }
    if (slot.status !== 'AVAILABLE') {
      throw new ConflictError('This slot is no longer available');
    }

    const existing = await DemoRequestModel.findOne({
      studentPublicId: studentProfile.publicId,
      tutorPublicId: dto.tutorPublicId,
      status: DemoRequestStatus.PENDING,
      isDeleted: false,
    }).lean();
    if (existing) throw new ConflictError('You already have a pending demo request with this tutor');

    const tutorProfile = await TutorProfileModel.findOne(
      { publicId: dto.tutorPublicId, isDeleted: false },
      { userPublicId: 1 },
    ).lean();

    const request = await DemoRequestModel.create({
      publicId: uuidv4(),
      studentPublicId: studentProfile.publicId,
      tutorPublicId: dto.tutorPublicId,
      availabilitySlotPublicId: dto.availabilitySlotPublicId,
      preferredSubject: dto.preferredSubject,
      message: dto.message,
      status: DemoRequestStatus.PENDING,
      isDeleted: false,
    });

    if (tutorProfile?.userPublicId) {
      domainEvents.emit(DomainEvent.DEMO_REQUEST_CREATED, {
        tutorUserPublicId: tutorProfile.userPublicId,
        studentUserPublicId: studentUserPublicId,
        subject: dto.preferredSubject,
      });
    }

    return request.toObject();
  }

  async getForTutor(
    tutorUserPublicId: string,
    query: PaginationQuery & { status?: string },
  ): Promise<PaginatedResult<EnrichedDemoRequest>> {
    const tutorProfile = await tutorService.getByUserPublicId(tutorUserPublicId);
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { tutorPublicId: tutorProfile.publicId, isDeleted: false };
    if (query.status) filter.status = query.status;

    const [items, total] = await Promise.all([
      DemoRequestModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      DemoRequestModel.countDocuments(filter),
    ]);
    const enriched = await enrichWithSlot(items);
    return buildPaginatedResult(enriched, total, page, limit);
  }

  async getForStudent(
    studentUserPublicId: string,
    query: PaginationQuery & { status?: string },
  ): Promise<PaginatedResult<EnrichedDemoRequest>> {
    const studentProfile = await getOrCreateStudentProfile(studentUserPublicId);
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { studentPublicId: studentProfile.publicId, isDeleted: false };
    if (query.status) filter.status = query.status;

    const [items, total] = await Promise.all([
      DemoRequestModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      DemoRequestModel.countDocuments(filter),
    ]);
    const enriched = await enrichWithSlot(items);
    return buildPaginatedResult(enriched, total, page, limit);
  }

  async accept(requestPublicId: string, tutorUserPublicId: string): Promise<IDemoRequest> {
    const tutorProfile = await tutorService.getByUserPublicId(tutorUserPublicId);
    const request = await DemoRequestModel.findOne({ publicId: requestPublicId, isDeleted: false }).lean();
    if (!request) throw new NotFoundError('Demo request');
    if (request.tutorPublicId !== tutorProfile.publicId) throw new AppError('Not authorized', 403);
    if (request.status !== DemoRequestStatus.PENDING) {
      throw new ConflictError(`Request already ${request.status.toLowerCase()}`);
    }

    const slot = await scheduleService.getSlotByPublicId(request.availabilitySlotPublicId);
    if (slot.status !== 'AVAILABLE') throw new ConflictError('Slot is no longer available');

    await scheduleService.blockSlot(slot.publicId);

    try {
      const scheduledClass = await ScheduledClassModel.create({
        publicId: uuidv4(),
        tutorPublicId: request.tutorPublicId,
        studentPublicId: request.studentPublicId,
        availabilitySlotPublicId: slot.publicId,
        classType: ClassType.DEMO,
        status: ClassStatus.SCHEDULED,
        startUTC: slot.startUTC,
        endUTC: slot.endUTC,
        ianaTimezone: slot.ianaTimezone,
        durationMinutes: slot.durationMinutes,
        title: `Demo Class – ${request.preferredSubject}`,
        description: request.message,
        costCents: 0,
        idempotencyKey: `demo-accept-${requestPublicId}`,
        isDeleted: false,
      });

      const updated = await DemoRequestModel.findOneAndUpdate(
        { publicId: requestPublicId },
        { $set: { status: DemoRequestStatus.ACCEPTED, classPublicId: scheduledClass.publicId } },
        { new: true },
      ).lean();

      // Connect student to this tutor: set tutorPublicId and activate them
      const studentProfile = await StudentProfileModel.findOneAndUpdate(
        { publicId: request.studentPublicId, isDeleted: false },
        {
          $set: {
            tutorPublicId: tutorProfile.publicId,
            status: StudentStatus.ACTIVE,
            approvedBy: tutorUserPublicId,
            approvedAt: new Date(),
          },
        },
        { new: true },
      ).lean();

      // Initialize demo credits for the student if not already done
      if (studentProfile?.userPublicId) {
        await walletService.initializeDemoCredits(studentProfile.userPublicId).catch(() => {});

        domainEvents.emit(DomainEvent.DEMO_REQUEST_ACCEPTED, {
          tutorUserPublicId: tutorUserPublicId,
          studentUserPublicId: studentProfile.userPublicId,
          classPublicId: scheduledClass.publicId,
          subject: request.preferredSubject,
        });

        await tutorRepository.incrementStats(tutorProfile.publicId, { totalStudents: 1 });

        // Invalidate student list for the tutor
        domainEvents.emit(DomainEvent.STUDENT_APPROVED, {
          studentPublicId: request.studentPublicId,
          studentUserPublicId: studentProfile.userPublicId,
          tutorUserPublicId,
          approvedBy: tutorUserPublicId,
        });
      }

      return updated!;
    } catch (error) {
      await scheduleService.releaseSlot(slot.publicId);
      throw error;
    }
  }

  async reject(
    requestPublicId: string,
    tutorUserPublicId: string,
    dto: RejectDemoRequestDto,
  ): Promise<IDemoRequest> {
    const tutorProfile = await tutorService.getByUserPublicId(tutorUserPublicId);
    const request = await DemoRequestModel.findOne({ publicId: requestPublicId, isDeleted: false }).lean();
    if (!request) throw new NotFoundError('Demo request');
    if (request.tutorPublicId !== tutorProfile.publicId) throw new AppError('Not authorized', 403);
    if (request.status !== DemoRequestStatus.PENDING) {
      throw new ConflictError(`Request already ${request.status.toLowerCase()}`);
    }

    const updated = await DemoRequestModel.findOneAndUpdate(
      { publicId: requestPublicId },
      { $set: { status: DemoRequestStatus.REJECTED, rejectionReason: dto.reason } },
      { new: true },
    ).lean();

    const studentProfile = await StudentProfileModel.findOne(
      { publicId: request.studentPublicId, isDeleted: false },
      { userPublicId: 1 },
    ).lean();

    if (studentProfile?.userPublicId) {
      domainEvents.emit(DomainEvent.DEMO_REQUEST_REJECTED, {
        tutorUserPublicId: tutorUserPublicId,
        studentUserPublicId: studentProfile.userPublicId,
        subject: request.preferredSubject,
      });
    }

    return updated!;
  }
}

export const demoRequestService = new DemoRequestService();
