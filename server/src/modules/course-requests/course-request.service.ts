import { v4 as uuidv4 } from 'uuid';
import { CourseRequestModel } from './course-request.model';
import { CourseRequestStatus } from './course-request.types';
import type { ICourseRequest } from './course-request.types';
import type {
  CreateCourseRequestDto,
  AcceptCourseRequestDto,
  RejectCourseRequestDto,
  ScheduleCourseClassDto,
} from './course-request.validators';
import { ScheduledClassModel } from '../schedules/schedule.model';
import { BillingMode, ClassStatus, ClassType } from '../schedules/schedule.types';
import type { IScheduledClass } from '../schedules/schedule.types';
import { studentService } from '../students/student.service';
import { tutorService } from '../tutors/tutor.service';
import { classService } from '../classes/class.service';
import { walletService } from '../wallets/wallet.service';
import { AppError, ConflictError, NotFoundError } from '../../utils/error';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';

/** Minutes since local midnight, for comparing against an availabilityWindow. */
function localMinutesOfDay(isoTime: Date, ianaTimezone: string): { minutes: number; dayOfWeek: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(isoTime);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const weekdayShort = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return { minutes: hour * 60 + minute, dayOfWeek: dayMap[weekdayShort] ?? 0 };
}

function timeStringToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export class CourseRequestService {
  async create(studentUserPublicId: string, dto: CreateCourseRequestDto): Promise<ICourseRequest> {
    const studentProfile = await studentService.getByUserPublicId(studentUserPublicId);

    const existing = await CourseRequestModel.findOne({
      studentPublicId: studentProfile.publicId,
      tutorPublicId: dto.tutorPublicId,
      coursePublicId: dto.coursePublicId,
      status: CourseRequestStatus.PENDING,
      isDeleted: false,
    }).lean();
    if (existing) throw new ConflictError('You already have a pending request for this course with this tutor');

    const created = await CourseRequestModel.create({
      publicId: uuidv4(),
      studentPublicId: studentProfile.publicId,
      tutorPublicId: dto.tutorPublicId,
      coursePublicId: dto.coursePublicId,
      selectedTopicPublicIds: dto.selectedTopicPublicIds,
      availabilityWindow: dto.availabilityWindow,
      status: CourseRequestStatus.PENDING,
      classesScheduledCount: 0,
      classesCompletedCount: 0,
      isDeleted: false,
    });

    const tutorProfile = await tutorService.getByPublicId(dto.tutorPublicId);
    domainEvents.emit(DomainEvent.COURSE_REQUEST_CREATED, {
      tutorUserPublicId: tutorProfile.userPublicId,
      studentUserPublicId,
      coursePublicId: dto.coursePublicId,
    });

    return created.toObject();
  }

  async getForStudent(studentUserPublicId: string, query: PaginationQuery & { status?: string }): Promise<PaginatedResult<ICourseRequest>> {
    const studentProfile = await studentService.getByUserPublicId(studentUserPublicId);
    return this._list({ studentPublicId: studentProfile.publicId }, query);
  }

  async getForTutor(tutorUserPublicId: string, query: PaginationQuery & { status?: string }): Promise<PaginatedResult<ICourseRequest>> {
    const tutorProfile = await tutorService.getByUserPublicId(tutorUserPublicId);
    return this._list({ tutorPublicId: tutorProfile.publicId }, query);
  }

  private async _list(
    scope: Record<string, string>,
    query: PaginationQuery & { status?: string },
  ): Promise<PaginatedResult<ICourseRequest>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { ...scope, isDeleted: false };
    if (query.status) filter.status = query.status;

    const [items, total] = await Promise.all([
      CourseRequestModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CourseRequestModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  private async _loadOwnedByTutor(requestPublicId: string, tutorUserPublicId: string) {
    const tutorProfile = await tutorService.getByUserPublicId(tutorUserPublicId);
    const request = await CourseRequestModel.findOne({ publicId: requestPublicId, isDeleted: false }).lean();
    if (!request) throw new NotFoundError('Course request');
    if (request.tutorPublicId !== tutorProfile.publicId) throw new AppError('Not authorized', 403);
    return { tutorProfile, request };
  }

  async accept(requestPublicId: string, tutorUserPublicId: string, dto: AcceptCourseRequestDto): Promise<ICourseRequest> {
    const { tutorProfile, request } = await this._loadOwnedByTutor(requestPublicId, tutorUserPublicId);
    if (request.status !== CourseRequestStatus.PENDING) {
      throw new ConflictError(`Request already ${request.status.toLowerCase()}`);
    }

    const studentProfile = await studentService.getByPublicId(request.studentPublicId);
    const costCentsPerClass = tutorProfile.hourlyRateCents;
    const totalCostCentsCharged = costCentsPerClass * dto.classesRequired;

    if (totalCostCentsCharged > 0) {
      await walletService.debitWallet({
        ownerPublicId: studentProfile.userPublicId,
        amountCents: totalCostCentsCharged,
        description: `Course series (${dto.classesRequired} classes)`,
        idempotencyKey: `course-request-accept-${requestPublicId}`,
        referenceId: requestPublicId,
        referenceType: 'COURSE_REQUEST_ACCEPT',
      });
    }

    const updated = await CourseRequestModel.findOneAndUpdate(
      { publicId: requestPublicId, status: CourseRequestStatus.PENDING },
      {
        $set: {
          status: CourseRequestStatus.ACCEPTED,
          classesRequired: dto.classesRequired,
          costCentsPerClass,
          totalCostCentsCharged,
        },
      },
      { new: true },
    ).lean();
    if (!updated) throw new ConflictError('Request already processed');

    domainEvents.emit(DomainEvent.COURSE_REQUEST_ACCEPTED, {
      tutorUserPublicId,
      studentUserPublicId: studentProfile.userPublicId,
      coursePublicId: request.coursePublicId,
      classesRequired: dto.classesRequired,
    });

    return updated;
  }

  async reject(requestPublicId: string, tutorUserPublicId: string, dto: RejectCourseRequestDto): Promise<ICourseRequest> {
    const { request } = await this._loadOwnedByTutor(requestPublicId, tutorUserPublicId);
    if (request.status !== CourseRequestStatus.PENDING) {
      throw new ConflictError(`Request already ${request.status.toLowerCase()}`);
    }

    const updated = await CourseRequestModel.findOneAndUpdate(
      { publicId: requestPublicId },
      { $set: { status: CourseRequestStatus.REJECTED, rejectionReason: dto.reason } },
      { new: true },
    ).lean();

    const studentProfile = await studentService.getByPublicId(request.studentPublicId);
    domainEvents.emit(DomainEvent.COURSE_REQUEST_REJECTED, {
      tutorUserPublicId,
      studentUserPublicId: studentProfile.userPublicId,
      coursePublicId: request.coursePublicId,
    });

    return updated!;
  }

  async scheduleClass(
    requestPublicId: string,
    tutorUserPublicId: string,
    dto: ScheduleCourseClassDto,
  ): Promise<IScheduledClass> {
    const { tutorProfile, request } = await this._loadOwnedByTutor(requestPublicId, tutorUserPublicId);
    if (request.status !== CourseRequestStatus.ACCEPTED) {
      throw new ConflictError('Request must be accepted before scheduling classes');
    }
    if (request.classesScheduledCount >= (request.classesRequired ?? 0)) {
      throw new ConflictError('All classes for this course request are already scheduled');
    }
    if (dto.courseTopicPublicId && !request.selectedTopicPublicIds.includes(dto.courseTopicPublicId)) {
      throw new AppError('Topic is not part of this course request', 400);
    }

    const start = new Date(dto.startUTC);
    const end = new Date(dto.endUTC);
    if (end <= start) throw new AppError('endUTC must be after startUTC', 400);

    const { minutes, dayOfWeek } = localMinutesOfDay(start, request.availabilityWindow.ianaTimezone);
    const windowStart = timeStringToMinutes(request.availabilityWindow.startLocalTime);
    const windowEnd = timeStringToMinutes(request.availabilityWindow.endLocalTime);
    const inWindow =
      request.availabilityWindow.daysOfWeek.includes(dayOfWeek) &&
      minutes >= windowStart &&
      minutes <= windowEnd;
    if (!inWindow) {
      throw new AppError('Requested time is outside the student\'s stated availability window', 400);
    }

    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60_000);

    const created = await ScheduledClassModel.create({
      publicId: uuidv4(),
      tutorPublicId: tutorProfile.publicId,
      studentPublicId: request.studentPublicId,
      classType: ClassType.RECURRING,
      status: ClassStatus.SCHEDULED,
      startUTC: start,
      endUTC: end,
      ianaTimezone: request.availabilityWindow.ianaTimezone,
      durationMinutes,
      title: dto.title,
      description: dto.description,
      costCents: request.costCentsPerClass ?? 0,
      billingMode: BillingMode.COURSE_PREPAID,
      idempotencyKey: `course-class-${requestPublicId}-${uuidv4()}`,
      courseRequestPublicId: request.publicId,
      coursePublicId: request.coursePublicId,
      courseTopicPublicId: dto.courseTopicPublicId,
      isDeleted: false,
    });

    const incremented = await CourseRequestModel.findOneAndUpdate(
      { publicId: requestPublicId, classesScheduledCount: { $lt: request.classesRequired! } },
      { $inc: { classesScheduledCount: 1 } },
      { new: true },
    ).lean();
    if (!incremented) {
      // Lost the race to another concurrent schedule call — undo the class we just created.
      await ScheduledClassModel.deleteOne({ publicId: created.publicId });
      throw new ConflictError('All classes for this course request are already scheduled');
    }

    domainEvents.emit(DomainEvent.COURSE_CLASS_SCHEDULED, {
      tutorUserPublicId,
      classPublicId: created.publicId,
      courseRequestPublicId: request.publicId,
    });

    return created.toObject();
  }

  async cancel(requestPublicId: string, actorUserPublicId: string): Promise<ICourseRequest> {
    const request = await CourseRequestModel.findOne({ publicId: requestPublicId, isDeleted: false }).lean();
    if (!request) throw new NotFoundError('Course request');
    if (request.status !== CourseRequestStatus.ACCEPTED && request.status !== CourseRequestStatus.PENDING) {
      throw new ConflictError(`Request already ${request.status.toLowerCase()}`);
    }

    if (request.status === CourseRequestStatus.ACCEPTED) {
      const scheduledNotCompleted = await ScheduledClassModel.find(
        { courseRequestPublicId: requestPublicId, status: { $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] }, isDeleted: false },
        { publicId: 1 },
      ).lean();

      for (const cls of scheduledNotCompleted) {
        await classService.cancelClass(cls.publicId, actorUserPublicId, { reason: 'Course request cancelled' });
      }

      // classService.cancelClass already refunds any class it just cancelled
      // (COURSE_PREPAID branch) — refunding those again here would double-pay
      // the student. Only classes that were never scheduled at all (i.e. never
      // debited individually, only bulk-charged at accept()) are refunded here.
      const neverScheduled = (request.classesRequired ?? 0) - request.classesScheduledCount - request.classesCompletedCount;
      if (neverScheduled > 0 && request.costCentsPerClass) {
        const studentProfile = await studentService.getByPublicId(request.studentPublicId);
        await walletService.refundWallet({
          ownerPublicId: studentProfile.userPublicId,
          amountCents: neverScheduled * request.costCentsPerClass,
          description: 'Course request cancelled — unscheduled classes refunded',
          idempotencyKey: `course-request-cancel-${requestPublicId}`,
          referenceId: requestPublicId,
          referenceType: 'COURSE_REQUEST_CANCEL',
        });
      }
    }

    const updated = await CourseRequestModel.findOneAndUpdate(
      { publicId: requestPublicId },
      { $set: { status: CourseRequestStatus.CANCELLED } },
      { new: true },
    ).lean();

    domainEvents.emit(DomainEvent.COURSE_REQUEST_CANCELLED, { requestPublicId, actorUserPublicId });

    return updated!;
  }
}

export const courseRequestService = new CourseRequestService();
