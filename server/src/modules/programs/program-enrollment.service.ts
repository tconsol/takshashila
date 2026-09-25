// server/src/modules/programs/program-enrollment.service.ts
import { v4 as uuidv4 } from 'uuid';
import { ProgramModel, ProgramEnrollmentModel } from './program.model';
import { EnrollmentStatus, ProgramStatus } from './program.types';
import type { IProgramEnrollment } from './program.types';
import type { EnrollDto, ScheduleSessionDto } from './program.validators';
import { ScheduledClassModel } from '../schedules/schedule.model';
import { BillingMode, ClassStatus, ClassType } from '../schedules/schedule.types';
import type { IScheduledClass } from '../schedules/schedule.types';
import { StudentProfileModel } from '../students/student.model';
import { TutorProfileModel } from '../tutors/tutor.model';
import { ParentProfileModel } from '../parents/parent.model';
import { UserModel } from '../users/user.model';
import { studentService } from '../students/student.service';
import { tutorService } from '../tutors/tutor.service';
import { walletService } from '../wallets/wallet.service';
import { classService } from '../classes/class.service';
import { computeTopicProgress } from '../courses/course-progress';
import { isWithinAvailability } from '../../shared/availability';
import { AppError, ConflictError, NotFoundError } from '../../utils/error';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { logger } from '../../lib/logger';

/**
 * Every session costs the same flat share, so booking order (and rebooking after a
 * cancellation) never changes prices. The rounding remainder is refunded when the
 * enrollment completes or is cancelled.
 */
export function sessionCost(priceCents: number, sessionCount: number, _sessionNumber?: number): number {
  return Math.floor(priceCents / sessionCount);
}

const SESSION_LENGTH_TOLERANCE_MIN = 15;

export type EnrichedEnrollment = IProgramEnrollment & {
  programTitle: string;
  programCategory: string;
  tutorName: string;
  studentName: string;
};

async function enrich(items: IProgramEnrollment[]): Promise<EnrichedEnrollment[]> {
  if (items.length === 0) return [];
  const [programs, tutors, students] = await Promise.all([
    ProgramModel.find({ publicId: { $in: [...new Set(items.map((e) => e.programPublicId))] } }, { publicId: 1, title: 1, category: 1 }).lean(),
    TutorProfileModel.find({ publicId: { $in: [...new Set(items.map((e) => e.tutorPublicId))] } }, { publicId: 1, userPublicId: 1 }).lean(),
    StudentProfileModel.find({ publicId: { $in: [...new Set(items.map((e) => e.studentPublicId))] } }, { publicId: 1, userPublicId: 1 }).lean(),
  ]);
  const users = await UserModel.find(
    { publicId: { $in: [...tutors, ...students].map((p) => p.userPublicId) } },
    { publicId: 1, firstName: 1, lastName: 1 },
  ).lean();
  const nameByUser = new Map(users.map((u) => [u.publicId, `${u.firstName} ${u.lastName}`.trim()]));
  const programById = new Map(programs.map((p) => [p.publicId, p]));
  const tutorName = new Map(tutors.map((t) => [t.publicId, nameByUser.get(t.userPublicId) ?? 'Tutor']));
  const studentName = new Map(students.map((s) => [s.publicId, nameByUser.get(s.userPublicId) ?? 'Student']));
  return items.map((e) => ({
    ...e,
    programTitle: programById.get(e.programPublicId)?.title ?? 'Program',
    programCategory: programById.get(e.programPublicId)?.category ?? 'OTHER',
    tutorName: tutorName.get(e.tutorPublicId) ?? 'Tutor',
    studentName: studentName.get(e.studentPublicId) ?? 'Student',
  }));
}

export class ProgramEnrollmentService {
  async enroll(studentUserPublicId: string, programPublicId: string, dto: EnrollDto): Promise<IProgramEnrollment> {
    const student = await studentService.getByUserPublicId(studentUserPublicId);
    const program = await ProgramModel.findOne({ publicId: programPublicId, status: ProgramStatus.PUBLISHED, isDeleted: false }).lean();
    if (!program) throw new NotFoundError('Program');
    if (await ProgramEnrollmentModel.exists({ programPublicId, studentPublicId: student.publicId, status: EnrollmentStatus.ACTIVE })) {
      throw new ConflictError('You are already enrolled in this program');
    }

    // Reserve a seat atomically so two students can't take the last one.
    const reserved = await ProgramModel.findOneAndUpdate(
      {
        publicId: programPublicId,
        status: ProgramStatus.PUBLISHED,
        isDeleted: false,
        $or: [{ maxEnrollees: { $exists: false } }, { $expr: { $lt: ['$activeEnrollmentCount', '$maxEnrollees'] } }],
      },
      { $inc: { activeEnrollmentCount: 1 } },
      { new: true },
    ).lean();
    if (!reserved) throw new ConflictError('Program is full');
    const releaseSeat = () => ProgramModel.updateOne({ publicId: programPublicId }, { $inc: { activeEnrollmentCount: -1 } });

    const enrollmentPublicId = uuidv4();
    if (program.priceCents > 0) {
      try {
        await walletService.debitWallet({
          ownerPublicId: studentUserPublicId,
          amountCents: program.priceCents,
          description: `Skill program: ${program.title}`,
          // Persisted in wallettransactions — do not rename.
          idempotencyKey: `program-enroll-${enrollmentPublicId}`,
          referenceId: enrollmentPublicId,
          referenceType: 'PROGRAM_ENROLL',
        });
      } catch (error) {
        await releaseSeat();
        throw error;
      }
    }

    try {
      const created = await ProgramEnrollmentModel.create({
        publicId: enrollmentPublicId,
        programPublicId,
        tutorPublicId: program.tutorPublicId,
        studentPublicId: student.publicId,
        availabilityWindow: dto.availabilityWindow,
        sessionCount: program.sessionCount,
        priceCentsPaid: program.priceCents,
        sessionsScheduledCount: 0,
        sessionsCompletedCount: 0,
        status: EnrollmentStatus.ACTIVE,
        isDeleted: false,
      });
      domainEvents.emit(DomainEvent.PROGRAM_ENROLLED, {
        enrollmentPublicId,
        programPublicId,
        tutorPublicId: program.tutorPublicId,
        studentUserPublicId,
      });
      return created.toObject();
    } catch (error) {
      // e.g. the unique ACTIVE index lost a race — undo the charge and the seat.
      if (program.priceCents > 0) {
        await walletService.refundWallet({
          ownerPublicId: studentUserPublicId,
          amountCents: program.priceCents,
          description: `Refund: ${program.title} (enrollment failed)`,
          idempotencyKey: `program-enroll-undo-${enrollmentPublicId}`,
          referenceId: enrollmentPublicId,
          referenceType: 'PROGRAM_CANCEL',
        }).catch((refundError) => logger.error('Enrollment failed and its refund also failed — reconcile manually', {
          enrollmentPublicId, studentUserPublicId, amountCents: program.priceCents, error: (refundError as Error).message,
        }));
      }
      await releaseSeat();
      throw error;
    }
  }

  async scheduleSession(enrollmentPublicId: string, tutorUserPublicId: string, dto: ScheduleSessionDto): Promise<IScheduledClass> {
    const tutor = await tutorService.getByUserPublicId(tutorUserPublicId);
    const enrollment = await ProgramEnrollmentModel.findOne({ publicId: enrollmentPublicId, isDeleted: false }).lean();
    if (!enrollment || enrollment.tutorPublicId !== tutor.publicId) throw new NotFoundError('Enrollment');
    if (enrollment.status !== EnrollmentStatus.ACTIVE) throw new ConflictError('Enrollment is not active');
    const program = await ProgramModel.findOne({ publicId: enrollment.programPublicId }).lean();
    if (!program) throw new NotFoundError('Program');
    if (!program.modules.some((m) => m.publicId === dto.programModulePublicId)) {
      throw new AppError('Module is not part of this program', 400);
    }

    const start = new Date(dto.startUTC);
    const end = new Date(dto.endUTC);
    if (end <= start) throw new AppError('endUTC must be after startUTC', 400);
    if (start <= new Date()) throw new AppError('Sessions must be scheduled in the future', 400);
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60_000);
    if (durationMinutes > program.sessionMinutes + SESSION_LENGTH_TOLERANCE_MIN) {
      throw new AppError(`Sessions are ${program.sessionMinutes} minutes long`, 400);
    }
    if (!isWithinAvailability(enrollment.availabilityWindow, start, end)) {
      throw new AppError('Requested time is outside the student\'s stated availability window', 400);
    }

    // Claim the next session number first; its value prices this session.
    const claimed = await ProgramEnrollmentModel.findOneAndUpdate(
      { publicId: enrollmentPublicId, status: EnrollmentStatus.ACTIVE, sessionsScheduledCount: { $lt: enrollment.sessionCount } },
      { $inc: { sessionsScheduledCount: 1 } },
      { new: true },
    ).lean();
    if (!claimed) throw new ConflictError('All sessions for this enrollment are already scheduled');

    try {
      const created = await ScheduledClassModel.create({
        publicId: uuidv4(),
        tutorPublicId: tutor.publicId,
        studentPublicId: enrollment.studentPublicId,
        classType: ClassType.RECURRING,
        status: ClassStatus.SCHEDULED,
        startUTC: start,
        endUTC: end,
        ianaTimezone: enrollment.availabilityWindow.ianaTimezone,
        durationMinutes,
        title: dto.title,
        costCents: sessionCost(enrollment.priceCentsPaid, enrollment.sessionCount),
        billingMode: BillingMode.PROGRAM_PREPAID,
        idempotencyKey: `program-class-${enrollmentPublicId}-${uuidv4()}`,
        programEnrollmentPublicId: enrollmentPublicId,
        programPublicId: enrollment.programPublicId,
        programModulePublicId: dto.programModulePublicId,
        isDeleted: false,
      });
      // The enrollment may have been cancelled between our claim and this insert.
      const still = await ProgramEnrollmentModel.findOne({ publicId: enrollmentPublicId }, { status: 1 }).lean();
      if (still?.status !== EnrollmentStatus.ACTIVE) {
        await ScheduledClassModel.deleteOne({ publicId: created.publicId });
        throw new ConflictError('Enrollment was cancelled');
      }
      domainEvents.emit(DomainEvent.PROGRAM_SESSION_SCHEDULED, {
        enrollmentPublicId,
        classPublicId: created.publicId,
        tutorUserPublicId,
      });
      return created.toObject();
    } catch (error) {
      await ProgramEnrollmentModel.updateOne(
        { publicId: enrollmentPublicId, sessionsScheduledCount: { $gt: 0 } },
        { $inc: { sessionsScheduledCount: -1 } },
      );
      throw error;
    }
  }

  async cancel(enrollmentPublicId: string, actorUserPublicId: string): Promise<IProgramEnrollment> {
    const enrollment = await ProgramEnrollmentModel.findOne({ publicId: enrollmentPublicId, isDeleted: false }).lean();
    if (!enrollment) throw new NotFoundError('Enrollment');
    const [student, tutor] = await Promise.all([
      StudentProfileModel.findOne({ userPublicId: actorUserPublicId, isDeleted: false }).lean(),
      TutorProfileModel.findOne({ userPublicId: actorUserPublicId, isDeleted: false }).lean(),
    ]);
    const isParty = student?.publicId === enrollment.studentPublicId || tutor?.publicId === enrollment.tutorPublicId;
    if (!isParty) throw new NotFoundError('Enrollment');
    // Claim first: flipping ACTIVE → CANCELLED before touching sessions stops a concurrent
    // scheduleSession (it requires ACTIVE) and makes a second cancel a no-op.
    const claimed = await ProgramEnrollmentModel.findOneAndUpdate(
      { publicId: enrollmentPublicId, status: EnrollmentStatus.ACTIVE },
      { $set: { status: EnrollmentStatus.CANCELLED, cancelledBy: actorUserPublicId } },
      { new: true },
    ).lean();
    if (!claimed) throw new ConflictError(`Enrollment already ${enrollment.status.toLowerCase()}`);

    const upcoming = await ScheduledClassModel.find(
      { programEnrollmentPublicId: enrollmentPublicId, status: { $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] }, isDeleted: false },
      { publicId: 1 },
    ).lean();
    for (const cls of upcoming) {
      // Program sessions aren't refunded individually; the refund below covers them.
      await classService.cancelClass(cls.publicId, actorUserPublicId, { reason: 'Program enrollment cancelled' }).catch((error) =>
        logger.warn('Could not cancel program session', { classPublicId: cls.publicId, error: (error as Error).message }));
    }

    // Refund everything not yet taught: price − Σ costs of completed sessions.
    const completed = await ScheduledClassModel.find(
      { programEnrollmentPublicId: enrollmentPublicId, status: ClassStatus.COMPLETED, isDeleted: false },
      { costCents: 1 },
    ).lean();
    const refundable = enrollment.priceCentsPaid - completed.reduce((sum, c) => sum + (c.costCents ?? 0), 0);
    if (refundable > 0) {
      const studentProfile = await StudentProfileModel.findOne({ publicId: enrollment.studentPublicId }, { userPublicId: 1 }).lean();
      if (!studentProfile) throw new NotFoundError('Student profile');
      await walletService.refundWallet({
        ownerPublicId: studentProfile.userPublicId,
        amountCents: refundable,
        description: 'Skill program cancelled — untaught sessions refunded',
        // Persisted in wallettransactions — do not rename.
        idempotencyKey: `program-cancel-${enrollmentPublicId}`,
        referenceId: enrollmentPublicId,
        referenceType: 'PROGRAM_CANCEL',
      });
    }

    await ProgramModel.updateOne({ publicId: enrollment.programPublicId }, { $inc: { activeEnrollmentCount: -1 } });
    domainEvents.emit(DomainEvent.PROGRAM_ENROLLMENT_CANCELLED, { enrollmentPublicId, actorUserPublicId });
    return claimed;
  }

  async listMine(studentUserPublicId: string): Promise<EnrichedEnrollment[]> {
    const student = await studentService.getByUserPublicId(studentUserPublicId);
    return enrich(await ProgramEnrollmentModel.find({ studentPublicId: student.publicId, isDeleted: false }).sort({ createdAt: -1 }).lean());
  }

  async listForParent(parentUserPublicId: string): Promise<EnrichedEnrollment[]> {
    const parent = await ParentProfileModel.findOne({ userPublicId: parentUserPublicId, isDeleted: false }).lean();
    const children = parent?.childStudentPublicIds ?? [];
    if (children.length === 0) return [];
    return enrich(await ProgramEnrollmentModel.find({
      studentPublicId: { $in: children },
      status: { $in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
      isDeleted: false,
    }).sort({ createdAt: -1 }).lean());
  }

  async listForProgram(tutorUserPublicId: string, programPublicId: string): Promise<EnrichedEnrollment[]> {
    const tutor = await tutorService.getByUserPublicId(tutorUserPublicId);
    const program = await ProgramModel.findOne({ publicId: programPublicId, tutorPublicId: tutor.publicId, isDeleted: false }).lean();
    if (!program) throw new NotFoundError('Program');
    return enrich(await ProgramEnrollmentModel.find({ programPublicId, isDeleted: false }).sort({ createdAt: -1 }).lean());
  }

  /** Program › Module › sessions. Status only for the student and their parents. */
  async getStructure(enrollmentPublicId: string, viewer: { role: string; userPublicId: string }) {
    const enrollment = await ProgramEnrollmentModel.findOne({ publicId: enrollmentPublicId, isDeleted: false }).lean();
    if (!enrollment) throw new NotFoundError('Enrollment');
    const viewerRole = await this._structureRole(enrollment, viewer);

    const [program, classes, [enriched]] = await Promise.all([
      ProgramModel.findOne({ publicId: enrollment.programPublicId }).lean(),
      ScheduledClassModel.find(
        { programEnrollmentPublicId: enrollmentPublicId, isDeleted: false },
        { publicId: 1, status: 1, startUTC: 1, endUTC: 1, programModulePublicId: 1 },
      ).lean(),
      enrich([enrollment]),
    ]);
    if (!program) throw new NotFoundError('Program');

    const progress = computeTopicProgress(
      program.modules.map((m) => ({ publicId: m.publicId, title: m.title, order: m.order })),
      classes.map((c) => ({ ...c, topicPublicId: c.programModulePublicId })),
      new Date(),
    );
    const showStatus = viewerRole === 'STUDENT' || viewerRole === 'PARENT';
    return {
      viewerRole,
      enrollment: {
        publicId: enrollment.publicId,
        status: enrollment.status,
        sessionCount: enrollment.sessionCount,
        sessionsScheduledCount: enrollment.sessionsScheduledCount,
        sessionsCompletedCount: enrollment.sessionsCompletedCount,
        availabilityWindow: enrollment.availabilityWindow,
        tutorName: enriched.tutorName,
        studentName: enriched.studentName,
      },
      program: { publicId: program.publicId, title: program.title, category: program.category, level: program.level, sessionMinutes: program.sessionMinutes, modules: program.modules },
      topics: progress.topics.map(({ status, nextClass, ...rest }) => ({
        ...rest,
        ...(showStatus ? { status, ...(nextClass ? { nextClass } : {}) } : {}),
        materials: [],
      })),
      otherClasses: progress.otherClasses,
    };
  }

  private async _structureRole(e: IProgramEnrollment, viewer: { role: string; userPublicId: string }): Promise<'STUDENT' | 'PARENT' | 'TUTOR' | 'ADMIN'> {
    if (viewer.role === 'ADMIN' || viewer.role === 'SUPER_ADMIN') return 'ADMIN';
    if (viewer.role === 'STUDENT') {
      const s = await StudentProfileModel.findOne({ userPublicId: viewer.userPublicId, isDeleted: false }).lean();
      if (s?.publicId === e.studentPublicId) return 'STUDENT';
    }
    if (viewer.role === 'PARENT') {
      const p = await ParentProfileModel.findOne({ userPublicId: viewer.userPublicId, isDeleted: false }).lean();
      if (p?.childStudentPublicIds?.includes(e.studentPublicId)) return 'PARENT';
    }
    if (viewer.role === 'TUTOR' || viewer.role === 'PRINCIPAL') {
      const t = await TutorProfileModel.findOne({ userPublicId: viewer.userPublicId, isDeleted: false }).lean();
      if (t?.publicId === e.tutorPublicId) return 'TUTOR';
    }
    throw new NotFoundError('Enrollment');
  }
}

export const programEnrollmentService = new ProgramEnrollmentService();
