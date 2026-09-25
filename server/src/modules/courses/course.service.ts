import { v4 as uuidv4 } from 'uuid';
import { CourseModel } from './course.model';
import { CourseStatus } from './course.types';
import type { ICourse } from './course.types';
import type {
  CreateCourseDto,
  AcceptCourseDto,
  RejectCourseDto,
  ScheduleCourseClassDto,
} from './course.validators';
import { ScheduledClassModel } from '../schedules/schedule.model';
import { BillingMode, ClassStatus, ClassType } from '../schedules/schedule.types';
import type { IScheduledClass } from '../schedules/schedule.types';
import { studentService } from '../students/student.service';
import { tutorService } from '../tutors/tutor.service';
import { classService } from '../classes/class.service';
import { curriculumService } from '../curricula/curriculum.service';
import { TutorProfileModel } from '../tutors/tutor.model';
import { StudentProfileModel } from '../students/student.model';
import { CurriculumModel } from '../curricula/curriculum.model';
import { walletService } from '../wallets/wallet.service';
import { computeTopicProgress } from './course-progress';
import { ParentProfileModel } from '../parents/parent.model';
import { materialFilterForCourse, ACTIVE_COURSE_STATUSES, type Viewer } from './material-access';
import { loadMaterialsByTopic, curriculumSummary } from './course-structure';
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

export type EnrichedCourse = ICourse & {
  studentName?: string;
  tutorName?: string;
  curriculumTitle?: string;
  topicTitles?: string[];
};

/**
 * Attaches student/tutor names, curriculum title and selected-topic titles to a
 * page of Courses. Rows only carry ids, so a Tutor/Student list would
 * otherwise show nothing but a status badge and raw uuids (see
 * demo-request.service.ts's `enrichWithSlot`/`listForAdmin` for the sibling
 * pattern this mirrors). Resolved in a small, fixed number of batched
 * queries per page, not per row.
 */
async function enrichCourses(items: ICourse[]): Promise<EnrichedCourse[]> {
  if (items.length === 0) return [];

  const tutorIds = [...new Set(items.map((r) => r.tutorPublicId))];
  const studentIds = [...new Set(items.map((r) => r.studentPublicId))];
  const curriculumIds = [...new Set(items.map((r) => r.curriculumPublicId))];

  const [tutorProfiles, studentProfiles, curricula] = await Promise.all([
    TutorProfileModel.find({ publicId: { $in: tutorIds } }, { publicId: 1, userPublicId: 1 }).lean(),
    StudentProfileModel.find({ publicId: { $in: studentIds } }, { publicId: 1, userPublicId: 1 }).lean(),
    CurriculumModel.find({ publicId: { $in: curriculumIds } }, { publicId: 1, title: 1, topics: 1 }).lean(),
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
  const curriculumByPublicId = new Map(curricula.map((c) => [c.publicId, c]));

  return items.map((r) => {
    const curriculum = curriculumByPublicId.get(r.curriculumPublicId);
    const topicTitleByPublicId = new Map((curriculum?.topics ?? []).map((t) => [t.publicId, t.title]));
    return {
      ...r,
      studentName: studentNameByProfile.get(r.studentPublicId) ?? 'Unknown student',
      tutorName: tutorNameByProfile.get(r.tutorPublicId) ?? 'Unknown tutor',
      curriculumTitle: curriculum?.title ?? 'Unknown curriculum',
      topicTitles: r.topicPublicIds.map((id) => topicTitleByPublicId.get(id) ?? 'Unknown topic'),
    };
  });
}

export class CourseService {
  async create(studentUserPublicId: string, dto: CreateCourseDto): Promise<ICourse> {
    const studentProfile = await studentService.getByUserPublicId(studentUserPublicId);

    // Validate the curriculum exists (NotFoundError propagates → 404), is
    // actually published (a Student shouldn't be able to request an
    // unpublished curriculum by guessing/leaking its id), and that every
    // selected topic really belongs to it.
    const curriculum = await curriculumService.getByPublicId(dto.curriculumPublicId);
    if (!curriculum.isPublished) {
      throw new AppError('Curriculum is not available', 400);
    }
    const curriculumTopicIds = new Set(curriculum.topics.map((t) => t.publicId));
    const hasUnknownTopic = dto.topicPublicIds.some((id) => !curriculumTopicIds.has(id));
    if (hasUnknownTopic) {
      throw new AppError('One or more selected topics do not belong to this curriculum', 400);
    }

    // Verify the tutor exists BEFORE creating the row — otherwise a bad
    // tutor id would orphan a PENDING row and the duplicate-pending guard
    // below would then block a retry with the correct tutor id.
    const tutorProfile = await tutorService.getByPublicId(dto.tutorPublicId);

    const existing = await CourseModel.findOne({
      studentPublicId: studentProfile.publicId,
      tutorPublicId: dto.tutorPublicId,
      curriculumPublicId: dto.curriculumPublicId,
      status: CourseStatus.PENDING,
      isDeleted: false,
    }).lean();
    if (existing) throw new ConflictError('You already have a pending course for this curriculum with this tutor');

    const created = await CourseModel.create({
      publicId: uuidv4(),
      studentPublicId: studentProfile.publicId,
      tutorPublicId: dto.tutorPublicId,
      curriculumPublicId: dto.curriculumPublicId,
      topicPublicIds: dto.topicPublicIds,
      availabilityWindow: dto.availabilityWindow,
      status: CourseStatus.PENDING,
      classesScheduledCount: 0,
      classesCompletedCount: 0,
      isDeleted: false,
    });

    domainEvents.emit(DomainEvent.COURSE_CREATED, {
      tutorUserPublicId: tutorProfile.userPublicId,
      studentUserPublicId,
      curriculumPublicId: dto.curriculumPublicId,
    });

    return created.toObject();
  }

  async getForStudent(studentUserPublicId: string, query: PaginationQuery & { status?: string }): Promise<PaginatedResult<EnrichedCourse>> {
    const studentProfile = await studentService.getByUserPublicId(studentUserPublicId);
    return this._list({ studentPublicId: studentProfile.publicId }, query);
  }

  /** Nested structure of one course (curriculum-materials spec §6.1). Status only for student/parent. */
  async getStructure(coursePublicId: string, viewer: Viewer) {
    const course = await CourseModel.findOne({ publicId: coursePublicId, isDeleted: false }).lean();
    if (!course) throw new NotFoundError('Course');
    const viewerRole = await this._structureRole(course, viewer);

    // Deleted curricula included on purpose: the student's history still needs them.
    const [curriculum, classes, [enriched], byTopic] = await Promise.all([
      CurriculumModel.findOne({ publicId: course.curriculumPublicId }).lean(),
      ScheduledClassModel.find(
        { coursePublicId: course.publicId, isDeleted: false },
        { publicId: 1, status: 1, startUTC: 1, endUTC: 1, topicPublicId: 1 },
      ).lean(),
      enrichCourses([course]),
      loadMaterialsByTopic(materialFilterForCourse(course)),
    ]);
    if (!curriculum) throw new NotFoundError('Curriculum');

    const selected = new Set(course.topicPublicIds);
    const topics = curriculum.topics.filter((t) => selected.has(t.publicId));
    const progress = computeTopicProgress(
      topics.map((t) => ({ publicId: t.publicId, title: t.title, order: t.order })),
      classes,
      new Date(),
    );
    const showStatus = viewerRole === 'STUDENT' || viewerRole === 'PARENT';

    return {
      viewerRole,
      course: {
        publicId: course.publicId,
        status: course.status,
        classesRequired: course.classesRequired ?? 0,
        classesCompletedCount: course.classesCompletedCount,
        tutorName: enriched.tutorName,
        studentName: enriched.studentName,
      },
      curriculum: curriculumSummary(curriculum),
      topics: progress.topics.map(({ status, nextClass, ...rest }) => ({
        ...rest,
        ...(showStatus ? { status, ...(nextClass ? { nextClass } : {}) } : {}),
        materials: byTopic.get(rest.publicId) ?? [],
      })),
      otherClasses: progress.otherClasses,
    };
  }

  private async _structureRole(course: ICourse, viewer: Viewer): Promise<'STUDENT' | 'PARENT' | 'TUTOR' | 'ADMIN'> {
    if (viewer.role === 'ADMIN' || viewer.role === 'SUPER_ADMIN') return 'ADMIN';
    if (viewer.role === 'STUDENT') {
      const s = await StudentProfileModel.findOne({ userPublicId: viewer.userPublicId, isDeleted: false }).lean();
      if (s?.publicId === course.studentPublicId) return 'STUDENT';
    }
    if (viewer.role === 'PARENT') {
      const p = await ParentProfileModel.findOne({ userPublicId: viewer.userPublicId }).lean();
      if (p?.childStudentPublicIds?.includes(course.studentPublicId)) return 'PARENT';
    }
    if (viewer.role === 'TUTOR') {
      const t = await TutorProfileModel.findOne({ userPublicId: viewer.userPublicId, isDeleted: false }).lean();
      if (t?.publicId === course.tutorPublicId) return 'TUTOR';
    }
    throw new NotFoundError('Course');
  }

  async getForParent(parentUserPublicId: string): Promise<EnrichedCourse[]> {
    const parent = await ParentProfileModel.findOne({ userPublicId: parentUserPublicId }).lean();
    const children = parent?.childStudentPublicIds ?? [];
    if (children.length === 0) return [];
    const courses = await CourseModel.find({
      studentPublicId: { $in: children },
      status: { $in: ACTIVE_COURSE_STATUSES },
      isDeleted: false,
    }).sort({ updatedAt: -1 }).lean();
    return enrichCourses(courses);
  }

  async getForTutor(tutorUserPublicId: string, query: PaginationQuery & { status?: string }): Promise<PaginatedResult<EnrichedCourse>> {
    const tutorProfile = await tutorService.getByUserPublicId(tutorUserPublicId);
    return this._list({ tutorPublicId: tutorProfile.publicId }, query);
  }

  private async _list(
    scope: Record<string, string>,
    query: PaginationQuery & { status?: string },
  ): Promise<PaginatedResult<EnrichedCourse>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { ...scope, isDeleted: false };
    if (query.status) {
      const statuses = query.status.split(',').map((s) => s.trim()).filter(Boolean);
      filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }

    const [items, total] = await Promise.all([
      CourseModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CourseModel.countDocuments(filter),
    ]);
    const enriched = await enrichCourses(items);
    return buildPaginatedResult(enriched, total, page, limit);
  }

  private async _loadOwnedByTutor(coursePublicId: string, tutorUserPublicId: string) {
    const tutorProfile = await tutorService.getByUserPublicId(tutorUserPublicId);
    const request = await CourseModel.findOne({ publicId: coursePublicId, isDeleted: false }).lean();
    if (!request) throw new NotFoundError('Course');
    if (request.tutorPublicId !== tutorProfile.publicId) throw new AppError('Not authorized', 403);
    return { tutorProfile, request };
  }

  async accept(coursePublicId: string, tutorUserPublicId: string, dto: AcceptCourseDto): Promise<ICourse> {
    const { tutorProfile, request } = await this._loadOwnedByTutor(coursePublicId, tutorUserPublicId);
    if (request.status !== CourseStatus.PENDING) {
      throw new ConflictError(`Request already ${request.status.toLowerCase()}`);
    }

    const studentProfile = await studentService.getByPublicId(request.studentPublicId);
    const costCentsPerClass = tutorProfile.hourlyRateCents;
    const totalCostCentsCharged = costCentsPerClass * dto.classesRequired;

    // Atomic status transition FIRST, debit only after it succeeds. If a
    // concurrent call already moved this request out of PENDING (lost a
    // race), we must not have charged the student with no compensating
    // refund — so no money moves until we know the transition landed.
    const updated = await CourseModel.findOneAndUpdate(
      { publicId: coursePublicId, status: CourseStatus.PENDING },
      {
        $set: {
          status: CourseStatus.ACCEPTED,
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
        description: `Curriculum series (${dto.classesRequired} classes)`,
        // Persisted in wallettransactions — do not rename (see rename spec §3.5).
        idempotencyKey: `course-request-accept-${coursePublicId}`,
        referenceId: coursePublicId,
        // Persisted in wallettransactions — do not rename (see rename spec §3.5).
        referenceType: 'COURSE_REQUEST_ACCEPT',
      });
    }

    domainEvents.emit(DomainEvent.COURSE_ACCEPTED, {
      tutorUserPublicId,
      studentUserPublicId: studentProfile.userPublicId,
      curriculumPublicId: request.curriculumPublicId,
      classesRequired: dto.classesRequired,
    });

    return updated;
  }

  async reject(coursePublicId: string, tutorUserPublicId: string, dto: RejectCourseDto): Promise<ICourse> {
    const { request } = await this._loadOwnedByTutor(coursePublicId, tutorUserPublicId);
    if (request.status !== CourseStatus.PENDING) {
      throw new ConflictError(`Request already ${request.status.toLowerCase()}`);
    }

    const updated = await CourseModel.findOneAndUpdate(
      { publicId: coursePublicId },
      { $set: { status: CourseStatus.REJECTED, rejectionReason: dto.reason } },
      { new: true },
    ).lean();

    const studentProfile = await studentService.getByPublicId(request.studentPublicId);
    domainEvents.emit(DomainEvent.COURSE_REJECTED, {
      tutorUserPublicId,
      studentUserPublicId: studentProfile.userPublicId,
      curriculumPublicId: request.curriculumPublicId,
    });

    return updated!;
  }

  async scheduleClass(
    coursePublicId: string,
    tutorUserPublicId: string,
    dto: ScheduleCourseClassDto,
  ): Promise<IScheduledClass> {
    const { tutorProfile, request } = await this._loadOwnedByTutor(coursePublicId, tutorUserPublicId);
    if (request.status !== CourseStatus.ACCEPTED) {
      throw new ConflictError('Request must be accepted before scheduling classes');
    }
    if (request.classesScheduledCount >= (request.classesRequired ?? 0)) {
      throw new ConflictError('All classes for this course are already scheduled');
    }
    if (!request.topicPublicIds.includes(dto.topicPublicId)) {
      throw new AppError('Topic is not part of this course', 400);
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
      // Persisted in wallettransactions — do not rename (see rename spec §3.5).
      idempotencyKey: `course-class-${coursePublicId}-${uuidv4()}`,
      coursePublicId: request.publicId,
      curriculumPublicId: request.curriculumPublicId,
      topicPublicId: dto.topicPublicId,
      isDeleted: false,
    });

    const incremented = await CourseModel.findOneAndUpdate(
      { publicId: coursePublicId, classesScheduledCount: { $lt: request.classesRequired! } },
      { $inc: { classesScheduledCount: 1 } },
      { new: true },
    ).lean();
    if (!incremented) {
      // Lost the race to another concurrent schedule call — undo the class we just created.
      await ScheduledClassModel.deleteOne({ publicId: created.publicId });
      throw new ConflictError('All classes for this course are already scheduled');
    }

    domainEvents.emit(DomainEvent.COURSE_CLASS_SCHEDULED, {
      tutorUserPublicId,
      classPublicId: created.publicId,
      coursePublicId: request.publicId,
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
    request: Pick<ICourse, 'studentPublicId' | 'tutorPublicId'>,
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

  async cancel(coursePublicId: string, actorUserPublicId: string): Promise<ICourse> {
    const request = await CourseModel.findOne({ publicId: coursePublicId, isDeleted: false }).lean();
    if (!request) throw new NotFoundError('Course');
    if (!(await this._actorOwnsRequest(actorUserPublicId, request))) {
      throw new AppError('Not authorized', 403);
    }
    if (request.status !== CourseStatus.ACCEPTED && request.status !== CourseStatus.PENDING) {
      throw new ConflictError(`Request already ${request.status.toLowerCase()}`);
    }

    if (request.status === CourseStatus.ACCEPTED) {
      const scheduledNotCompleted = await ScheduledClassModel.find(
        { coursePublicId: coursePublicId, status: { $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] }, isDeleted: false },
        { publicId: 1 },
      ).lean();

      for (const cls of scheduledNotCompleted) {
        await classService.cancelClass(cls.publicId, actorUserPublicId, { reason: 'Course cancelled' });
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
          description: 'Course cancelled — unscheduled classes refunded',
          // Persisted in wallettransactions — do not rename (see rename spec §3.5).
          idempotencyKey: `course-request-cancel-${coursePublicId}`,
          referenceId: coursePublicId,
          // Persisted in wallettransactions — do not rename (see rename spec §3.5).
          referenceType: 'COURSE_REQUEST_CANCEL',
        });
      }
    }

    const updated = await CourseModel.findOneAndUpdate(
      { publicId: coursePublicId },
      { $set: { status: CourseStatus.CANCELLED } },
      { new: true },
    ).lean();

    domainEvents.emit(DomainEvent.COURSE_CANCELLED, { coursePublicId, actorUserPublicId });

    return updated!;
  }
}

export const courseService = new CourseService();
