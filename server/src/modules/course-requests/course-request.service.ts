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
import { courseService } from '../courses/course.service';
import { TutorProfileModel } from '../tutors/tutor.model';
import { StudentProfileModel } from '../students/student.model';
import { CourseModel } from '../courses/course.model';
import { walletService } from '../wallets/wallet.service';
import { ResourceModel } from '../resources/resource.model';
import { AssignmentModel } from '../assignments/assignment.model';
import { WorksheetModel } from '../worksheets/worksheet.model';
import { computeTopicProgress } from './course-progress';
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

export type EnrichedCourseRequest = ICourseRequest & {
  studentName?: string;
  tutorName?: string;
  courseTitle?: string;
  topicTitles?: string[];
};

/**
 * Attaches student/tutor names, course title and selected-topic titles to a
 * page of CourseRequests. Rows only carry ids, so a Tutor/Student list would
 * otherwise show nothing but a status badge and raw uuids (see
 * demo-request.service.ts's `enrichWithSlot`/`listForAdmin` for the sibling
 * pattern this mirrors). Resolved in a small, fixed number of batched
 * queries per page, not per row.
 */
async function enrichCourseRequests(items: ICourseRequest[]): Promise<EnrichedCourseRequest[]> {
  if (items.length === 0) return [];

  const tutorIds = [...new Set(items.map((r) => r.tutorPublicId))];
  const studentIds = [...new Set(items.map((r) => r.studentPublicId))];
  const courseIds = [...new Set(items.map((r) => r.coursePublicId))];

  const [tutorProfiles, studentProfiles, courses] = await Promise.all([
    TutorProfileModel.find({ publicId: { $in: tutorIds } }, { publicId: 1, userPublicId: 1 }).lean(),
    StudentProfileModel.find({ publicId: { $in: studentIds } }, { publicId: 1, userPublicId: 1 }).lean(),
    CourseModel.find({ publicId: { $in: courseIds } }, { publicId: 1, title: 1, topics: 1 }).lean(),
  ]);

  const { UserModel } = await import('../users/user.model');
  const users = await UserModel.find(
    { publicId: { $in: [...tutorProfiles, ...studentProfiles].map((p) => p.userPublicId) } },
    { publicId: 1, firstName: 1, lastName: 1 },
  ).lean();

  const nameByUser = new Map(users.map((u) => [u.publicId, `${u.firstName} ${u.lastName}`.trim()]));
  const tutorNameByProfile = new Map(
    tutorProfiles.map((p) => [p.publicId, nameByUser.get(p.userPublicId) ?? 'Unknown tutor']),
  );
  const studentNameByProfile = new Map(
    studentProfiles.map((p) => [p.publicId, nameByUser.get(p.userPublicId) ?? 'Unknown student']),
  );
  const courseByPublicId = new Map(courses.map((c) => [c.publicId, c]));

  return items.map((r) => {
    const course = courseByPublicId.get(r.coursePublicId);
    const topicTitleByPublicId = new Map((course?.topics ?? []).map((t) => [t.publicId, t.title]));
    return {
      ...r,
      studentName: studentNameByProfile.get(r.studentPublicId) ?? 'Unknown student',
      tutorName: tutorNameByProfile.get(r.tutorPublicId) ?? 'Unknown tutor',
      courseTitle: course?.title ?? 'Unknown course',
      topicTitles: r.selectedTopicPublicIds.map((id) => topicTitleByPublicId.get(id) ?? 'Unknown topic'),
    };
  });
}

export class CourseRequestService {
  async create(studentUserPublicId: string, dto: CreateCourseRequestDto): Promise<ICourseRequest> {
    const studentProfile = await studentService.getByUserPublicId(studentUserPublicId);

    // Validate the course exists (NotFoundError propagates → 404), is
    // actually published (a Student shouldn't be able to request an
    // unpublished course by guessing/leaking its id), and that every
    // selected topic really belongs to it.
    const course = await courseService.getByPublicId(dto.coursePublicId);
    if (!course.isPublished) {
      throw new AppError('Course is not available', 400);
    }
    const courseTopicIds = new Set(course.topics.map((t) => t.publicId));
    const hasUnknownTopic = dto.selectedTopicPublicIds.some((id) => !courseTopicIds.has(id));
    if (hasUnknownTopic) {
      throw new AppError('One or more selected topics do not belong to this course', 400);
    }

    // Verify the tutor exists BEFORE creating the row — otherwise a bad
    // tutor id would orphan a PENDING row and the duplicate-pending guard
    // below would then block a retry with the correct tutor id.
    const tutorProfile = await tutorService.getByPublicId(dto.tutorPublicId);

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

    domainEvents.emit(DomainEvent.COURSE_REQUEST_CREATED, {
      tutorUserPublicId: tutorProfile.userPublicId,
      studentUserPublicId,
      coursePublicId: dto.coursePublicId,
    });

    return created.toObject();
  }

  async getForStudent(studentUserPublicId: string, query: PaginationQuery & { status?: string }): Promise<PaginatedResult<EnrichedCourseRequest>> {
    const studentProfile = await studentService.getByUserPublicId(studentUserPublicId);
    return this._list({ studentPublicId: studentProfile.publicId }, query);
  }

  /** Nested progress for one of the caller's own requests: selected topics with status,
   *  classes and attached materials, plus classes the tutor didn't tag with a topic. */
  async getProgress(requestPublicId: string, studentUserPublicId: string) {
    const studentProfile = await studentService.getByUserPublicId(studentUserPublicId);
    const request = await CourseRequestModel.findOne({
      publicId: requestPublicId,
      studentPublicId: studentProfile.publicId,
      isDeleted: false,
    }).lean();
    if (!request) throw new NotFoundError('Course request');

    // Deleted courses included on purpose: the student's history still needs them.
    const [course, classes, [enriched]] = await Promise.all([
      CourseModel.findOne({ publicId: request.coursePublicId }).lean(),
      ScheduledClassModel.find(
        { courseRequestPublicId: request.publicId, isDeleted: false },
        { publicId: 1, status: 1, startUTC: 1, endUTC: 1, courseTopicPublicId: 1 },
      ).lean(),
      enrichCourseRequests([request]),
    ]);
    if (!course) throw new NotFoundError('Course');

    const selected = new Set(request.selectedTopicPublicIds);
    const topics = course.topics.filter((t) => selected.has(t.publicId));
    const ids = (key: 'resourceIds' | 'assignmentIds' | 'worksheetIds') => topics.flatMap((t) => t[key] ?? []);
    const titleProjection = { publicId: 1, title: 1 };
    const [resources, assignments, worksheets] = await Promise.all([
      ResourceModel.find({ publicId: { $in: ids('resourceIds') }, isDeleted: false }, titleProjection).lean(),
      AssignmentModel.find({ publicId: { $in: ids('assignmentIds') }, isDeleted: false }, titleProjection).lean(),
      WorksheetModel.find({ publicId: { $in: ids('worksheetIds') }, isDeleted: false }, titleProjection).lean(),
    ]);
    const titleMap = (docs: Array<{ publicId: string; title: string }>) => new Map(docs.map((d) => [d.publicId, d.title]));
    const byType = { resources: titleMap(resources), assignments: titleMap(assignments), worksheets: titleMap(worksheets) };
    const pick = (list: string[] | undefined, map: Map<string, string>) =>
      (list ?? []).flatMap((id) => (map.has(id) ? [{ publicId: id, title: map.get(id)! }] : []));

    const progress = computeTopicProgress(
      topics.map((t) => ({ publicId: t.publicId, title: t.title, order: t.order })),
      classes,
      new Date(),
    );
    const topicById = new Map(topics.map((t) => [t.publicId, t]));

    return {
      request: {
        publicId: request.publicId,
        status: request.status,
        classesRequired: request.classesRequired ?? 0,
        classesCompletedCount: request.classesCompletedCount,
        tutorName: enriched.tutorName,
      },
      course: {
        publicId: course.publicId,
        title: course.title,
        subject: course.subject,
        grade: course.grade,
        district: course.district,
        state: course.state,
      },
      topics: progress.topics.map((t) => {
        const source = topicById.get(t.publicId)!;
        return {
          ...t,
          materials: {
            resources: pick(source.resourceIds, byType.resources),
            assignments: pick(source.assignmentIds, byType.assignments),
            worksheets: pick(source.worksheetIds, byType.worksheets),
          },
        };
      }),
      otherClasses: progress.otherClasses,
    };
  }

  async getForTutor(tutorUserPublicId: string, query: PaginationQuery & { status?: string }): Promise<PaginatedResult<EnrichedCourseRequest>> {
    const tutorProfile = await tutorService.getByUserPublicId(tutorUserPublicId);
    return this._list({ tutorPublicId: tutorProfile.publicId }, query);
  }

  private async _list(
    scope: Record<string, string>,
    query: PaginationQuery & { status?: string },
  ): Promise<PaginatedResult<EnrichedCourseRequest>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { ...scope, isDeleted: false };
    if (query.status) {
      const statuses = query.status.split(',').map((s) => s.trim()).filter(Boolean);
      filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }

    const [items, total] = await Promise.all([
      CourseRequestModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CourseRequestModel.countDocuments(filter),
    ]);
    const enriched = await enrichCourseRequests(items);
    return buildPaginatedResult(enriched, total, page, limit);
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

    // Atomic status transition FIRST, debit only after it succeeds. If a
    // concurrent call already moved this request out of PENDING (lost a
    // race), we must not have charged the student with no compensating
    // refund — so no money moves until we know the transition landed.
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

    const { minutes: startMinutes, dayOfWeek } = localMinutesOfDay(start, request.availabilityWindow.ianaTimezone);
    const { minutes: endMinutes } = localMinutesOfDay(end, request.availabilityWindow.ianaTimezone);
    const windowStart = timeStringToMinutes(request.availabilityWindow.startLocalTime);
    const windowEnd = timeStringToMinutes(request.availabilityWindow.endLocalTime);
    const inWindow =
      request.availabilityWindow.daysOfWeek.includes(dayOfWeek) &&
      startMinutes >= windowStart &&
      startMinutes <= windowEnd &&
      endMinutes <= windowEnd;
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

  /**
   * Does this user own the request, as either its student or its tutor?
   * `cancel()` is callable by either role, so we try both profile lookups —
   * a user with no profile of a given kind (NotFoundError) simply doesn't
   * match that side, rather than blowing up as an uncaught 500.
   */
  private async _actorOwnsRequest(
    actorUserPublicId: string,
    request: Pick<ICourseRequest, 'studentPublicId' | 'tutorPublicId'>,
  ): Promise<boolean> {
    const [studentResult, tutorResult] = await Promise.allSettled([
      studentService.getByUserPublicId(actorUserPublicId),
      tutorService.getByUserPublicId(actorUserPublicId),
    ]);

    const isStudent =
      studentResult.status === 'fulfilled' && studentResult.value.publicId === request.studentPublicId;
    const isTutor =
      tutorResult.status === 'fulfilled' && tutorResult.value.publicId === request.tutorPublicId;

    return isStudent || isTutor;
  }

  async cancel(requestPublicId: string, actorUserPublicId: string): Promise<ICourseRequest> {
    const request = await CourseRequestModel.findOne({ publicId: requestPublicId, isDeleted: false }).lean();
    if (!request) throw new NotFoundError('Course request');
    if (!(await this._actorOwnsRequest(actorUserPublicId, request))) {
      throw new AppError('Not authorized', 403);
    }
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
      //
      // classesScheduledCount is monotonic — scheduleClass() only ever
      // increments it, nothing ever decrements it — so it already includes
      // classes that later completed. Subtracting classesCompletedCount too
      // would double-count those and under-refund the student.
      const neverScheduled = (request.classesRequired ?? 0) - request.classesScheduledCount;
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
