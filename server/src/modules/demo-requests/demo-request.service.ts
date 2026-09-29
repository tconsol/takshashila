import { v4 as uuidv4 } from 'uuid';
import { DemoRequestModel } from './demo-request.model';
import { DemoRequestStatus } from './demo-request.types';
import type { IDemoRequest } from './demo-request.types';
import type { CreateDemoRequestDto, RejectDemoRequestDto } from './demo-request.validators';
import { scheduleService } from '../schedules/schedule.service';
import { studentService } from '../students/student.service';
import { tutorService } from '../tutors/tutor.service';
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
import { adjustCountersForStatusChange } from '../students/student.service';

async function getOrCreateStudentProfile(userPublicId: string) {
  try {
    return await studentService.getByUserPublicId(userPublicId);
  } catch {
    // Profile missing create it for legacy accounts
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
  studentName?: string;
  studentGrade?: string;
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
    const { StudentProfileModel } = await import('../students/student.model');
    const { UserModel } = await import('../users/user.model');
    const profiles = await StudentProfileModel.find(
      { publicId: { $in: [...new Set(items.map((i) => i.studentPublicId))] } },
      { publicId: 1, userPublicId: 1, grade: 1 },
    ).lean();
    const users = await UserModel.find(
      { publicId: { $in: profiles.map((p) => p.userPublicId) } },
      { publicId: 1, firstName: 1, lastName: 1 },
    ).lean();
    const nameByUser = new Map(users.map((u) => [u.publicId, `${u.firstName} ${u.lastName}`.trim()]));
    const byProfile = new Map(profiles.map((p) => [p.publicId, { name: nameByUser.get(p.userPublicId), grade: p.grade }]));
    const withNames = enriched.map((r) => ({
      ...r,
      studentName: byProfile.get(r.studentPublicId)?.name ?? 'Student',
      studentGrade: byProfile.get(r.studentPublicId)?.grade,
    }));
    return buildPaginatedResult(withNames, total, page, limit);
  }

  /**
   * Platform-wide demo requests for admin oversight. Names are resolved here
   * because the rows only carry profile ids, and a queue nobody can read is
   * not oversight.
   */
  async listForAdmin(query: PaginationQuery & { status?: string }) {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { isDeleted: false };
    if (query.status) filter.status = query.status;

    const [items, total] = await Promise.all([
      DemoRequestModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      DemoRequestModel.countDocuments(filter),
    ]);

    const { TutorProfileModel } = await import('../tutors/tutor.model');
    const { StudentProfileModel } = await import('../students/student.model');
    const { UserModel } = await import('../users/user.model');

    const [tutorProfiles, studentProfiles] = await Promise.all([
      TutorProfileModel.find(
        { publicId: { $in: [...new Set(items.map((i) => i.tutorPublicId))] } },
        { publicId: 1, userPublicId: 1 },
      ).lean(),
      StudentProfileModel.find(
        { publicId: { $in: [...new Set(items.map((i) => i.studentPublicId))] } },
        { publicId: 1, userPublicId: 1 },
      ).lean(),
    ]);

    const users = await UserModel.find(
      { publicId: { $in: [...tutorProfiles, ...studentProfiles].map((p) => p.userPublicId) } },
      { publicId: 1, firstName: 1, lastName: 1 },
    ).lean();
    const nameByUser = new Map(users.map((u) => [u.publicId, `${u.firstName} ${u.lastName}`.trim()]));
    const tutorName = new Map(tutorProfiles.map((p) => [p.publicId, nameByUser.get(p.userPublicId) ?? 'Unknown tutor']));
    const studentName = new Map(studentProfiles.map((p) => [p.publicId, nameByUser.get(p.userPublicId) ?? 'Unknown student']));

    const hydrated = items.map((i) => ({
      ...i,
      tutorName: tutorName.get(i.tutorPublicId) ?? 'Unknown tutor',
      studentName: studentName.get(i.studentPublicId) ?? 'Unknown student',
    }));

    return buildPaginatedResult(hydrated, total, page, limit);
  }

  /** Counts per status, so the admin view can show the funnel at a glance. */
  async statusCounts() {
    const rows = await DemoRequestModel.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return rows.map((r: { _id: string; count: number }) => ({ status: r._id, count: r.count }));
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

    // Claim the request atomically BEFORE touching the slot or creating a class.
    // The loser of a concurrent accept gets a ConflictError here and never reaches
    // blockSlot/releaseSlot, so it cannot free the winner's slot.
    const claimed = await DemoRequestModel.findOneAndUpdate(
      { publicId: requestPublicId, isDeleted: false, status: DemoRequestStatus.PENDING },
      { $set: { status: DemoRequestStatus.ACCEPTED } },
      { new: true },
    ).lean();
    if (!claimed) throw new ConflictError('Request already handled');

    let slotBlocked = false;
    let createdClassPublicId: string | undefined;
    const slot = await scheduleService.getSlotByPublicId(request.availabilitySlotPublicId).catch(async (e) => {
      await this.revertClaim(requestPublicId);
      throw e;
    });

    try {
      if (slot.status !== 'AVAILABLE') throw new ConflictError('Slot is no longer available');

      await scheduleService.blockSlot(slot.publicId);
      slotBlocked = true;

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

      createdClassPublicId = scheduledClass.publicId;

      const updated = await DemoRequestModel.findOneAndUpdate(
        { publicId: requestPublicId },
        { $set: { classPublicId: scheduledClass.publicId } },
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
        { new: false },   // we need the status BEFORE this update to keep counters right
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

        // Move the tutor's/principal's student count only if this student was not already counted.
        await adjustCountersForStatusChange(
          studentProfile.status,
          StudentStatus.ACTIVE,
          tutorProfile.publicId,
          tutorProfile.principalPublicId,
        );

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
      // Roll back only what THIS call did: the slot only if we blocked it, the
      // claim always, and the class if it was created.
      if (slotBlocked) await scheduleService.releaseSlot(slot.publicId);
      if (createdClassPublicId) {
        await ScheduledClassModel.updateOne({ publicId: createdClassPublicId }, { $set: { isDeleted: true } });
      }
      await this.revertClaim(requestPublicId);
      throw error;
    }
  }

  private async revertClaim(requestPublicId: string): Promise<void> {
    await DemoRequestModel.updateOne(
      { publicId: requestPublicId, status: DemoRequestStatus.ACCEPTED },
      { $set: { status: DemoRequestStatus.PENDING }, $unset: { classPublicId: '' } },
    );
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
