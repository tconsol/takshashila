import { v4 as uuidv4 } from 'uuid';
import { ScheduledClassModel } from '../schedules/schedule.model';
import { ClassStatus, ClassType, BillingMode, AutoResolution, AUTO_RESOLVE_GRACE_MINUTES, MIN_SESSION_MINUTES, isPrepaid } from '../schedules/schedule.types';
import type { IScheduledClass } from '../schedules/schedule.types';
import { scheduleService } from '../schedules/schedule.service';
import { walletService, spendableCents } from '../wallets/wallet.service';
import { CreditType } from '../wallets/wallet.types';
import { studentService } from '../students/student.service';
import { tutorService } from '../tutors/tutor.service';
import { tutorRepository } from '../tutors/tutor.repository';
import { principalService } from '../principals/principal.service';
import { TutorProfileModel } from '../tutors/tutor.model';
import { TutorStatus } from '../tutors/tutor.types';
import { StudentProfileModel } from '../students/student.model';
import { isWithinAvailability } from '../../shared/availability';
import { COURSE_CLASS_MINUTES, isCourseClassLength } from '../courses/course.constants';
import { EARNINGS_HOLD_HOURS } from '../wallets/payout.service';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../utils/error';
import { settingsService } from '../settings/settings.service';
import { logger } from '../../lib/logger';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { PLATFORM_FEE_CENTS } from '../../utils/currency';
import { attendanceService } from '../attendance/attendance.service';
import { auditService } from '../audit/audit.service';
import { AttendanceStatus } from '../attendance/attendance.types';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';
import type { BookClassDto, CancelClassDto, RescheduleClassDto, SetMeetingUrlDto, TutorCreateClassDto, TutorRescheduleDto } from './class.validators';

// A completed demo class consumes 10 credits from the student's free demo-credit bucket.
const DEMO_CLASS_COST_CENTS = 10 * 100;

// Cancelling at least this long before the start is free; later costs the platform fee.
const CANCELLATION_FREE_NOTICE_HOURS = 24;

export class ClassService {
  async bookClass(
    studentUserPublicId: string,
    dto: BookClassDto,
  ): Promise<IScheduledClass> {
    const existingByKey = await ScheduledClassModel.findOne({
      idempotencyKey: dto.idempotencyKey,
    }).lean();
    if (existingByKey) return existingByKey;

    if (!(await settingsService.isFeatureEnabled('classBookingEnabled'))) {
      throw new AppError('Class booking is temporarily unavailable. Please try again later.', 503);
    }

    const slot = await scheduleService.getSlotByPublicId(dto.availabilitySlotPublicId);

    if (slot.tutorPublicId !== dto.tutorPublicId) {
      throw new AppError('Slot does not belong to the specified tutor', 400);
    }

    const tutorProfile = await tutorService.getByPublicId(dto.tutorPublicId);
    if (tutorProfile.status !== TutorStatus.ACTIVE) {
      throw new ConflictError(
        tutorProfile.status === TutorStatus.UNDER_VERIFICATION
          ? "This tutor's account is being reviewed by their organization and cannot take bookings until it is approved. Please try again later."
          : 'This tutor is not currently accepting bookings',
      );
    }

    const bookingSettings = await settingsService.get();
    this.assertWithinClassLimits(
      bookingSettings,
      [{ start: new Date(slot.startUTC) }],
      slot.durationMinutes,
    );
    const studentProfile = await studentService.getByUserPublicId(studentUserPublicId);

    // hourlyRateCents is the price of 60 minutes: bill in proportion to the
    // booked length so a 30-minute class is not charged as a full hour.
    const costCents = Math.round((tutorProfile.hourlyRateCents * slot.durationMinutes) / 60);

    // Charge happens at class completion (not booking), so nothing is held
    // here. Balance alone isn't enough to check: a student with one balance
    // could otherwise book N classes, since each check reads the same untouched
    // balance. So we also count every SCHEDULED/LIVE class that will charge the
    // student at completion. STUDENT_REQUESTED is the only such billing mode:
    // COURSE_/PROGRAM_PREPAID were paid up front, TUTOR_INVITED charges the
    // tutor. The check and the class insert run in ONE transaction that first
    // writes the student's wallet (see runWithBookingLock), so concurrent
    // bookings for the same student serialize instead of both passing.
    const buildClass = () => ({
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
      billingMode: BillingMode.STUDENT_REQUESTED,
      idempotencyKey: dto.idempotencyKey,
      isDeleted: false,
    });

    if (costCents > 0) {
      // Make sure the wallet exists; the lock below needs a document to write.
      await walletService.getWallet(studentUserPublicId);
    }

    await scheduleService.blockSlot(slot.publicId);

    try {
      let scheduledClass;
      if (costCents > 0) {
        scheduledClass = await walletService.runWithBookingLock(studentUserPublicId, async ({ session, wallet }) => {
          const outstanding = await ScheduledClassModel.aggregate([
            {
              $match: {
                studentPublicId: studentProfile.publicId,
                billingMode: BillingMode.STUDENT_REQUESTED,
                status: { $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] },
                // Free demo classes (cost 0) are paid from demo credits and charge no fee: nothing to reserve.
                costCents: { $gt: 0 },
                isDeleted: false,
              },
            },
            { $group: { _id: null, totalCents: { $sum: '$costCents' }, count: { $sum: 1 } } },
          ]).session(session);
          const outstandingCents = outstanding[0]?.totalCents ?? 0;
          const outstandingCount = outstanding[0]?.count ?? 0;
          const totalOwedCents =
            outstandingCents + (outstandingCount + 1) * PLATFORM_FEE_CENTS + costCents;
          const availableCents = spendableCents(wallet);
          if (availableCents < totalOwedCents) {
            const reservedCents = outstandingCents + outstandingCount * PLATFORM_FEE_CENTS;
            const thisClassCents = costCents + PLATFORM_FEE_CENTS;
            const reservedNote = outstandingCount > 0
              ? ` ${reservedCents / 100} credits are already reserved for ${outstandingCount} other booked class${outstandingCount === 1 ? '' : 'es'}.`
              : '';
            const demoNote = (wallet.demoCreditsCents ?? 0) > 0
              ? ' Free demo credits can only be used for demo classes.'
              : '';
            throw new AppError(
              `Insufficient credits to book this class. It costs ${thisClassCents / 100} credits (rate plus platform fee) and you have ${availableCents / 100} available.${reservedNote}${demoNote}`,
              402,
            );
          }
          const [created] = await ScheduledClassModel.create([buildClass()], { session });
          return created;
        });
      } else {
        scheduledClass = await ScheduledClassModel.create(buildClass());
      }

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
      { $set: { status: ClassStatus.LIVE, startedAt: new Date(), tutorJoinedAt: new Date() } },
      { new: true },
    ).lean();

    if (!scheduled) throw new NotFoundError('Scheduled class');
    if (scheduled.groupPublicId) await this._startGroupSiblings(scheduled);

    // The student needs to be in the event, or nobody is told the class is live.
    const studentProfile = await StudentProfileModel.findOne(
      { publicId: scheduled.studentPublicId, isDeleted: false },
      { userPublicId: 1 },
    ).lean();

    domainEvents.emit(DomainEvent.CLASS_STARTED, {
      classPublicId,
      tutorUserPublicId,
      studentUserPublicId: studentProfile?.userPublicId ?? '',
      startedBy: 'TUTOR',
      wentLive: true,
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
      // A student has one profile per tutor link: look up the class's own profile, not the first one.
      const studentProfile = await StudentProfileModel.findOne(
        { userPublicId, publicId: cls.studentPublicId, isDeleted: false },
        { publicId: 1 },
      ).lean();
      authorized = studentProfile?.publicId === cls.studentPublicId;
    } else {
      authorized = true;
    }
    if (!authorized) throw new AppError('Not authorized to join this class', 403);

    // Terminal states — nothing to update.
    if (cls.status === ClassStatus.COMPLETED || cls.status === ClassStatus.CANCELLED) return cls;

    // Transition SCHEDULED → LIVE, and ALWAYS record the student's join time the
    // first time they join — even if the tutor already started the class (LIVE).
    // (Previously this early-returned for LIVE, so a student joining after the
    //  tutor started was wrongly marked absent on completion.)
    const setFields: Record<string, unknown> = {};
    if (cls.status === ClassStatus.SCHEDULED) {
      setFields.status = ClassStatus.LIVE;
      if (!cls.startedAt) setFields.startedAt = new Date();
    }
    if (role === 'STUDENT' && !cls.studentJoinedAt) setFields.studentJoinedAt = new Date();
    // Both sides are needed to judge whether the session really happened.
    if (role === 'TUTOR' && !cls.tutorJoinedAt) setFields.tutorJoinedAt = new Date();

    if (Object.keys(setFields).length === 0) return cls; // already LIVE + already joined

    const updated = await ScheduledClassModel.findOneAndUpdate(
      { publicId: classPublicId, status: { $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] }, isDeleted: false },
      { $set: setFields },
      { new: true },
    ).lean();

    // Race condition another participant won the race, fetch current state
    if (!updated) {
      return (await ScheduledClassModel.findOne({ publicId: classPublicId, isDeleted: false }).lean()) ?? cls;
    }

    // The tutor is in one room for the whole group: every student's record starts with them.
    if (role === 'TUTOR' && cls.groupPublicId) await this._startGroupSiblings(cls);

    // Emit with full payload so socket can invalidate both parties
    const [tutorProfile, studentProfile] = await Promise.all([
      TutorProfileModel.findOne({ publicId: cls.tutorPublicId, isDeleted: false }, { userPublicId: 1 }).lean(),
      StudentProfileModel.findOne({ publicId: cls.studentPublicId, isDeleted: false }, { userPublicId: 1 }).lean(),
    ]);

    domainEvents.emit(DomainEvent.CLASS_STARTED, {
      classPublicId,
      tutorUserPublicId: tutorProfile?.userPublicId ?? '',
      studentUserPublicId: studentProfile?.userPublicId ?? '',
      // Lets the notification say who actually opened the room, and only once:
      // later joins of an already-LIVE class must not re-announce it.
      startedBy: role,
      wentLive: cls.status === ClassStatus.SCHEDULED,
    });

    return updated;
  }

  /**
   * Which live room a class uses and whether it is over. The room of a group session
   * ends only when none of its students' records is still open, so one student
   * cancelling their own record does not throw everyone else out.
   */
  private async _roomState(
    cls: Pick<IScheduledClass, 'publicId' | 'groupPublicId'>,
  ): Promise<{ roomPublicId: string; roomEnded: boolean }> {
    if (!cls.groupPublicId) return { roomPublicId: cls.publicId, roomEnded: true };
    const stillOpen = await ScheduledClassModel.countDocuments({
      groupPublicId: cls.groupPublicId,
      isDeleted: false,
      status: { $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] },
    });
    return { roomPublicId: cls.groupPublicId, roomEnded: stillOpen === 0 };
  }

  /**
   * When the tutor enters a group's shared room, mark every other student's record
   * of that session as joined by the tutor and LIVE, so each student's record can be
   * completed and billed on its own (billing needs both people present).
   */
  private async _startGroupSiblings(cls: Pick<IScheduledClass, 'publicId' | 'groupPublicId'>): Promise<void> {
    const siblings = { groupPublicId: cls.groupPublicId, publicId: { $ne: cls.publicId }, isDeleted: false };
    const now = new Date();
    await ScheduledClassModel.updateMany(
      { ...siblings, status: { $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] }, tutorJoinedAt: { $exists: false } },
      { $set: { tutorJoinedAt: now } },
    );
    await ScheduledClassModel.updateMany(
      { ...siblings, status: ClassStatus.SCHEDULED },
      { $set: { status: ClassStatus.LIVE, startedAt: now } },
    );
  }

  /**
   * Recount a program enrollment's completed sessions (idempotent — safe under double
   * completion). On the last one: mark COMPLETED, refund the rounding remainder
   * (price − Σ completed session costs) and free the seat.
   */
  async recordProgramSessionCompleted(enrollmentPublicId: string): Promise<void> {
    // Dynamic import avoids a static cycle: programs/ imports class.service for cancellations.
    const { ProgramEnrollmentModel, ProgramModel } = await import('../programs/program.model');
    const completed = await ScheduledClassModel.find(
      { programEnrollmentPublicId: enrollmentPublicId, status: ClassStatus.COMPLETED, isDeleted: false },
      { costCents: 1 },
    ).lean();
    const updated = await ProgramEnrollmentModel.findOneAndUpdate(
      { publicId: enrollmentPublicId },
      { $set: { sessionsCompletedCount: completed.length } },
      { new: true },
    ).lean();
    if (!updated || updated.status !== 'ACTIVE' || completed.length < updated.sessionCount) return;

    const done = await ProgramEnrollmentModel.findOneAndUpdate(
      { publicId: enrollmentPublicId, status: 'ACTIVE' },
      { $set: { status: 'COMPLETED' } },
      { new: true },
    ).lean();
    if (!done) return; // someone else completed/cancelled it first

    const remainder = updated.priceCentsPaid - completed.reduce((sum, c) => sum + (c.costCents ?? 0), 0);
    if (remainder > 0) {
      const student = await StudentProfileModel.findOne({ publicId: updated.studentPublicId }, { userPublicId: 1 }).lean();
      if (student?.userPublicId) {
        await walletService.refundWallet({
          ownerPublicId: student.userPublicId,
          amountCents: remainder,
          description: 'Skill program completed — rounding remainder refunded',
          // Persisted in wallettransactions — do not rename.
          idempotencyKey: `program-complete-remainder-${enrollmentPublicId}`,
          referenceId: enrollmentPublicId,
          referenceType: 'PROGRAM_COMPLETE',
        }).catch((error) => logger.error('Could not refund program completion remainder', {
          enrollmentPublicId, amountCents: remainder, error: (error as Error).message,
        }));
      }
    }
    await ProgramModel.updateOne({ publicId: updated.programPublicId }, { $inc: { activeEnrollmentCount: -1 } });
    domainEvents.emit(DomainEvent.PROGRAM_ENROLLMENT_COMPLETED, { enrollmentPublicId });
  }

  /**
   * `manual` is true when a person presses Complete. The auto-resolve sweep
   * (which only runs after the scheduled end) passes false and skips the
   * timing guard below.
   */
  async completeClass(
    classPublicId: string,
    tutorUserPublicId: string,
    opts: { manual?: boolean } = {},
  ): Promise<IScheduledClass> {
    const scheduled = await ScheduledClassModel.findOne({
      publicId: classPublicId,
      isDeleted: false,
    }).lean();

    if (!scheduled) throw new NotFoundError('Scheduled class');
    if (scheduled.status !== ClassStatus.LIVE && scheduled.status !== ClassStatus.SCHEDULED) {
      throw new ConflictError(`Cannot complete class in status: ${scheduled.status}`);
    }

    if (opts.manual) this._assertCanCompleteNow(scheduled);

    // Guarded on status so a double-click or a race with the sweep completes (and pays) only once.
    let updated = await ScheduledClassModel.findOneAndUpdate(
      { publicId: classPublicId, status: { $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] } },
      { $set: { status: ClassStatus.COMPLETED, needsTutorDecision: false, completedAt: new Date() } },
      { new: true },
    ).lean();
    if (!updated) throw new ConflictError('Class was already completed or cancelled');

    const studentProfileForEvent = await StudentProfileModel.findOne(
      { publicId: scheduled.studentPublicId, isDeleted: false },
      { userPublicId: 1 },
    ).lean();

    // ── Billing on completion ──────────────────────────────────────────────
    const tutorProfile = await tutorService.getByPublicId(scheduled.tutorPublicId);
    // A session only happened if the tutor was there too: a student sitting alone in
    // a room (or a tutor who never joined) must not be charged, paid, or billed for.
    const studentAttended = !!scheduled.studentJoinedAt && !!scheduled.tutorJoinedAt;

    if (scheduled.classType === ClassType.DEMO) {
      // A demo costs 10 credits, drawn from the student's free demo-credit bucket.
      // No tutor payout (it's a trial). Only charged if the student attended.
      if (studentAttended && studentProfileForEvent?.userPublicId) {
        try {
          await walletService.debitWallet({
            ownerPublicId: studentProfileForEvent.userPublicId,
            amountCents: DEMO_CLASS_COST_CENTS,
            description: `Demo class: ${scheduled.title}`,
            idempotencyKey: `demo-charge-${classPublicId}`,
            referenceId: classPublicId,
            referenceType: 'CLASS_COMPLETION',
            bucketField: 'demoCreditsCents',
          });
        } catch (error) {
          // Insufficient demo credits — complete the class anyway.
          logger.error('Could not charge demo class credits on completion', {
            classPublicId,
            studentUserPublicId: studentProfileForEvent.userPublicId,
            error: (error as Error).message,
          });
        }
      }
    } else if (scheduled.billingMode === BillingMode.TUTOR_INVITED) {
      // Tutor created + invited: students attend FREE. The tutor pays a flat
      // 2-credit platform fee PER ATTENDING STUDENT, and earns nothing.
      // tutorCreateClass writes one class doc per student, so completing each
      // attended doc charges 2 credits → e.g. 10 attendees = 20 credits.
      if (studentAttended && studentProfileForEvent?.userPublicId) {
        const tutorFeeCents = PLATFORM_FEE_CENTS * 2;
        try {
          await walletService.debitWallet({
            ownerPublicId: tutorProfile.userPublicId,
            amountCents: tutorFeeCents,
            description: `Platform fee (hosted class): ${scheduled.title}`,
            idempotencyKey: `tutor-platform-fee-${classPublicId}`,
            referenceId: classPublicId,
            referenceType: 'CLASS_COMPLETION',
          });
        } catch (error) {
          // Insufficient tutor balance complete the class but skip the fee.
          logger.error('Could not charge hosted-class platform fee on completion', {
            classPublicId,
            tutorUserPublicId: tutorProfile.userPublicId,
            tutorFeeCents,
            error: (error as Error).message,
          });
        }
      }
    } else if (isPrepaid(scheduled.billingMode)) {
      // Student already paid for this class in full when the Course was
      // accepted (see courses module) — do not charge them again here.
      // The tutor still earns per completed class, same as STUDENT_REQUESTED.
      if (scheduled.costCents > 0 && studentAttended) {
        const tutorEarningsCents = Math.max(0, scheduled.costCents - PLATFORM_FEE_CENTS);
        if (tutorEarningsCents > 0) {
          try {
            await walletService.creditWallet({
              ownerPublicId: tutorProfile.userPublicId,
              amountCents: tutorEarningsCents,
              creditType: CreditType.EARNED_CREDITS,
              description: `Earnings: ${scheduled.title}`,
              idempotencyKey: `tutor-earning-${classPublicId}`,
              referenceId: classPublicId,
              referenceType: 'CLASS_COMPLETION',
            });
            await tutorService.recordClassCompleted(scheduled.tutorPublicId, tutorEarningsCents);
          } catch (error) {
            // Could not pay the tutor complete the class anyway. The student was
            // already charged in full at Course-accept time, so a swallowed
            // failure here is the platform silently pocketing the tutor's share —
            // must be visible so finance can catch and correct it.
            logger.error('Could not pay tutor earnings on prepaid class completion', {
              classPublicId,
              tutorUserPublicId: tutorProfile.userPublicId,
              tutorEarningsCents,
              error: (error as Error).message,
            });
          }
        }
      }

      // Advance the Course's progress regardless of the attendance/
      // payment outcome above — a completed class is one class closer to the
      // series being done. Dynamic import avoids a static circular import
      // between classes/ and courses/ (courses/ already
      // imports class.service).
      if (scheduled.coursePublicId) {
        try {
          const { CourseModel } = await import('../courses/course.model');
          const { CourseStatus } = await import('../courses/course.types');

          const updatedRequest = await CourseModel.findOneAndUpdate(
            { publicId: scheduled.coursePublicId },
            { $inc: { classesCompletedCount: 1 } },
            { new: true },
          ).lean();

          if (
            updatedRequest &&
            updatedRequest.status !== CourseStatus.COMPLETED &&
            updatedRequest.classesCompletedCount >= (updatedRequest.classesRequired ?? Infinity)
          ) {
            await CourseModel.findOneAndUpdate(
              { publicId: scheduled.coursePublicId },
              { $set: { status: CourseStatus.COMPLETED } },
            );
            domainEvents.emit(DomainEvent.COURSE_COMPLETED, {
              coursePublicId: scheduled.coursePublicId,
            });
          }
        } catch (error) {
          logger.warn('Could not update Course completion progress', {
            classPublicId,
            coursePublicId: scheduled.coursePublicId,
            error: (error as Error).message,
          });
        }
      }

      if (scheduled.programEnrollmentPublicId) {
        try {
          await this.recordProgramSessionCompleted(scheduled.programEnrollmentPublicId);
        } catch (error) {
          logger.warn('Could not update program enrollment progress', {
            classPublicId,
            enrollmentPublicId: scheduled.programEnrollmentPublicId,
            error: (error as Error).message,
          });
        }
      }
    } else {
      // Student-requested: charge student (rate + fee), pay tutor (rate − fee),
      // platform keeps the fee from both sides. Only if the student attended.
      if (scheduled.costCents > 0 && studentAttended && studentProfileForEvent?.userPublicId) {
        const studentChargeCents = scheduled.costCents + PLATFORM_FEE_CENTS;
        const tutorEarningsCents = Math.max(0, scheduled.costCents - PLATFORM_FEE_CENTS);

        try {
          // Debit student and credit tutor in one transaction — either both
          // happen or neither does, so the platform never pockets a charge
          // it never paid out.
          await walletService.transferWallet({
            fromOwnerPublicId: studentProfileForEvent.userPublicId,
            toOwnerPublicId: tutorProfile.userPublicId,
            debitAmountCents: studentChargeCents,
            creditAmountCents: tutorEarningsCents,
            debitDescription: `Class: ${scheduled.title}`,
            creditDescription: `Earnings: ${scheduled.title}`,
            creditType: CreditType.EARNED_CREDITS,
            debitIdempotencyKey: `class-charge-${classPublicId}`,
            creditIdempotencyKey: `tutor-earning-${classPublicId}`,
            referenceId: classPublicId,
            referenceType: 'CLASS_COMPLETION',
          });
          if (tutorEarningsCents > 0) {
            await tutorService.recordClassCompleted(scheduled.tutorPublicId, tutorEarningsCents);
          }
        } catch (error) {
          // Insufficient student balance: still complete the class (product
          // decision) but skip the charge. Record it on the class and in the
          // audit log so admins can find unpaid classes.
          logger.error('Could not bill class on completion', {
            classPublicId,
            studentUserPublicId: studentProfileForEvent.userPublicId,
            tutorUserPublicId: tutorProfile.userPublicId,
            studentChargeCents,
            tutorEarningsCents,
            error: (error as Error).message,
          });
          const reason = (error as Error).message;
          const flagged = await ScheduledClassModel.findOneAndUpdate(
            { publicId: classPublicId },
            { $set: { billingFailed: true, billingFailureReason: reason } },
            { new: true },
          ).lean().catch((e: Error) => {
            logger.error('completeClass: could not flag billingFailed', { classPublicId, error: e.message });
            return null;
          });
          if (flagged) updated = flagged;
          await auditService.log({
            actorId: tutorUserPublicId,
            actorRole: 'TUTOR' as never,
            action: 'CLASS_BILLING_FAILED',
            resourceType: 'ScheduledClass',
            resourceId: classPublicId,
            after: { studentChargeCents, tutorEarningsCents, reason, studentUserPublicId: studentProfileForEvent.userPublicId },
          }).catch((e: Error) => logger.error('completeClass: billing-failure audit log failed', { classPublicId, error: e.message }));
        }
      }
    }

    if (scheduled.classType === ClassType.DEMO && scheduled.studentPublicId) {
      await studentService.recordDemoClassUsed(scheduled.studentPublicId, scheduled.tutorPublicId).catch(() => {});
    }

    // Auto-create attendance based on whether student actually joined the class
    if (scheduled.studentPublicId) {
      const attended = !!scheduled.studentJoinedAt && !!scheduled.tutorJoinedAt;
      await attendanceService.markAttendance(
        {
          classPublicId,
          studentPublicId: scheduled.studentPublicId,
          status: attended ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT,
          durationPresentMinutes: attended ? this._minutesActuallyPresent(scheduled) : 0,
        },
        scheduled.tutorPublicId,
      ).catch(() => {}); // ignore if already manually marked
    }

    domainEvents.emit(DomainEvent.CLASS_COMPLETED, {
      classPublicId,
      ...(await this._roomState(scheduled)),
      tutorPublicId: scheduled.tutorPublicId,
      tutorUserPublicId,
      studentPublicId: scheduled.studentPublicId,
      studentUserPublicId: studentProfileForEvent?.userPublicId ?? '',
      costCents: scheduled.costCents,
    });

    return updated!;
  }

  /** The other still-open records of the same group session (one record per student). */
  private async _openGroupSiblings(cls: Pick<IScheduledClass, 'publicId' | 'groupPublicId'>) {
    if (!cls.groupPublicId) return [];
    return ScheduledClassModel.find(
      {
        groupPublicId: cls.groupPublicId,
        publicId: { $ne: cls.publicId },
        isDeleted: false,
        status: { $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] },
      },
      { publicId: 1, startUTC: 1, endUTC: 1, durationMinutes: 1, studentJoinedAt: 1, tutorJoinedAt: 1 },
    ).lean();
  }

  /**
   * The tutor's Complete for a group session: one press completes (and bills, per
   * attending student) every student's record, not just the one that was clicked.
   * Every record must be completable first, so the session is never left half done.
   */
  async completeSession(classPublicId: string, tutorUserPublicId: string): Promise<IScheduledClass> {
    const clicked = await ScheduledClassModel.findOne({ publicId: classPublicId, isDeleted: false }).lean();
    if (!clicked) throw new NotFoundError('Scheduled class');
    const siblings = await this._openGroupSiblings(clicked);
    for (const sibling of siblings) this._assertCanCompleteNow(sibling);

    const completed = await this.completeClass(classPublicId, tutorUserPublicId, { manual: true });
    for (const sibling of siblings) {
      try {
        await this.completeClass(sibling.publicId, tutorUserPublicId, { manual: true });
      } catch (error) {
        // One record failing must not undo the others; the sweep settles it later.
        logger.warn('Group session: could not complete a student record', {
          groupPublicId: clicked.groupPublicId, classPublicId: sibling.publicId, error: (error as Error).message,
        });
      }
    }
    return completed;
  }

  /**
   * Cancel for the tutor, a principal or an admin: cancelling a group session cancels
   * every student's record. A student cancelling still only cancels their own
   * record (use `cancelClass`).
   */
  async cancelSession(classPublicId: string, actorPublicId: string, dto: CancelClassDto): Promise<IScheduledClass> {
    const clicked = await ScheduledClassModel.findOne({ publicId: classPublicId, isDeleted: false }).lean();
    if (!clicked) throw new NotFoundError('Scheduled class');
    const siblings = await this._openGroupSiblings(clicked);

    const cancelled = await this.cancelClass(classPublicId, actorPublicId, dto);
    for (const sibling of siblings) {
      try {
        await this.cancelClass(sibling.publicId, actorPublicId, dto);
      } catch (error) {
        logger.warn('Group session: could not cancel a student record', {
          groupPublicId: clicked.groupPublicId, classPublicId: sibling.publicId, error: (error as Error).message,
        });
      }
    }
    return cancelled;
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

    // Guarded on status, same as completeClass — a cancel racing a concurrent
    // complete must not overwrite an already-COMPLETED (and paid) class back
    // to CANCELLED.
    const updated = await ScheduledClassModel.findOneAndUpdate(
      { publicId: classPublicId, status: { $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] } },
      {
        $set: {
          status: ClassStatus.CANCELLED,
          cancellationReason: dto.reason,
          cancelledBy: actorPublicId,
          needsTutorDecision: false,
        },
      },
      { new: true },
    ).lean();
    if (!updated) throw new ConflictError('Class was already completed or cancelled');

    if (scheduled.availabilitySlotPublicId) {
      await scheduleService.releaseSlot(scheduled.availabilitySlotPublicId);
    }

    // No refund needed students are only charged at class completion, not at
    // booking, so a cancelled class never debited the student in the first place.

    // Program sessions are not refunded one by one: the slot is freed so the tutor books a
    // replacement, and money only returns when the enrollment is cancelled or completes.
    if (scheduled.billingMode === BillingMode.PROGRAM_PREPAID && scheduled.programEnrollmentPublicId) {
      const { ProgramEnrollmentModel } = await import('../programs/program.model');
      await ProgramEnrollmentModel.updateOne(
        { publicId: scheduled.programEnrollmentPublicId, status: 'ACTIVE', sessionsScheduledCount: { $gt: 0 } },
        { $inc: { sessionsScheduledCount: -1 } },
      );
    }

    if (scheduled.billingMode === BillingMode.COURSE_PREPAID && scheduled.costCents > 0) {
      const studentProfile = await StudentProfileModel.findOne(
        { publicId: scheduled.studentPublicId, isDeleted: false },
        { userPublicId: 1 },
      ).lean();
      if (studentProfile?.userPublicId) {
        // Never fatal: the class is already cancelled by this point (see
        // _chargeCancellationFee below) and must not be un-cancelled, nor
        // block the rest of cancelClass, by a refund failure.
        try {
          await walletService.refundWallet({
            ownerPublicId: studentProfile.userPublicId,
            amountCents: scheduled.costCents,
            description: `Refund (course class cancelled): ${scheduled.title}`,
            // Persisted in wallettransactions — do not rename (see rename spec §3.5).
            idempotencyKey: `course-class-cancel-refund-${classPublicId}`,
            referenceId: classPublicId,
            referenceType: 'CLASS_CANCELLATION',
          });
        } catch (error) {
          logger.warn('Could not refund course-prepaid class cancellation', {
            classPublicId,
            actorPublicId,
            studentUserPublicId: studentProfile.userPublicId,
            error: (error as Error).message,
          });
        }
      }
    }

    await tutorService.recordClassCancelled(scheduled.tutorPublicId);

    const [cancelledTutorProfile, cancelledStudentProfile] = await Promise.all([
      TutorProfileModel.findOne({ publicId: scheduled.tutorPublicId, isDeleted: false }, { userPublicId: 1 }).lean(),
      StudentProfileModel.findOne({ publicId: scheduled.studentPublicId, isDeleted: false }, { userPublicId: 1 }).lean(),
    ]);

    if (!isPrepaid(scheduled.billingMode) && this._cancellationFeeApplies(scheduled)) {
      await this._chargeCancellationFee(classPublicId, actorPublicId, {
        tutorUserPublicId: cancelledTutorProfile?.userPublicId,
        studentUserPublicId: cancelledStudentProfile?.userPublicId,
      });
    }

    domainEvents.emit(DomainEvent.CLASS_CANCELLED, {
      classPublicId,
      ...(await this._roomState(scheduled)),
      cancelledBy: actorPublicId,
      reason: dto.reason,
      tutorUserPublicId: cancelledTutorProfile?.userPublicId ?? '',
      studentUserPublicId: cancelledStudentProfile?.userPublicId ?? '',
    });

    return updated!;
  }

  /**
   * No fee for a free demo class, and none when the class is cancelled with
   * enough notice: a fee is only a deterrent against last-minute walk-aways.
   */
  private _cancellationFeeApplies(cls: Pick<IScheduledClass, 'classType' | 'startUTC'>): boolean {
    if (cls.classType === ClassType.DEMO) return false;
    const hoursNotice = (new Date(cls.startUTC).getTime() - Date.now()) / 3_600_000;
    return hoursNotice < CANCELLATION_FREE_NOTICE_HOURS;
  }

  /**
   * The platform fee falls on whoever walked away. Only a party to the class
   * pays: an admin or the overdue sweep cancelling on someone's behalf is not a
   * cancellation by that person, so nobody is charged.
   *
   * Deliberately allowed to push the wallet negative — otherwise the fee is
   * avoidable by simply having no balance. Never fatal: the class is already
   * cancelled by this point and must not be un-cancelled by a billing failure.
   */
  private async _chargeCancellationFee(
    classPublicId: string,
    actorPublicId: string,
    parties: { tutorUserPublicId?: string; studentUserPublicId?: string },
  ): Promise<void> {
    const role =
      actorPublicId === parties.tutorUserPublicId ? 'TUTOR' :
      actorPublicId === parties.studentUserPublicId ? 'STUDENT' :
      null;

    if (!role) return;

    try {
      await walletService.debitWallet({
        ownerPublicId: actorPublicId,
        amountCents: PLATFORM_FEE_CENTS,
        description: 'Class cancellation fee',
        idempotencyKey: `cancel-fee-${classPublicId}`,
        referenceId: classPublicId,
        referenceType: 'CLASS_CANCELLATION_FEE',
        metadata: { cancelledBy: role },
        allowNegative: true,
      });
    } catch (error) {
      logger.warn('Could not charge cancellation fee', {
        classPublicId,
        actorPublicId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Refund/reverse a COMPLETED, already-charged class.
   * STUDENT_REQUESTED: refund the student (rate + fee) and claw back the tutor's
   * earning (rate − fee). TUTOR_INVITED: refund the tutor the platform fee they paid.
   * Idempotent via per-class transaction keys + the isRefunded flag.
   */
  async refundClass(
    classPublicId: string,
    actorUserPublicId: string,
    reason: string,
    auditContext?: { role: string; ip?: string; userAgent?: string },
  ): Promise<IScheduledClass> {
    const scheduled = await ScheduledClassModel.findOne({ publicId: classPublicId, isDeleted: false }).lean();
    if (!scheduled) throw new NotFoundError('Scheduled class');
    if (scheduled.status !== ClassStatus.COMPLETED) {
      throw new ConflictError('Only completed classes can be refunded');
    }
    if (scheduled.isRefunded) throw new ConflictError('Class already refunded');

    // The tutor's earnings are held for EARNINGS_HOLD_HOURS so problems can be raised and
    // refunded in that window. Once the hold ends the tutor may withdraw the money, and it
    // cannot be taken back, so a refund is no longer possible.
    const completedAt = scheduled.completedAt ?? scheduled.endUTC;
    if (completedAt && Date.now() - new Date(completedAt).getTime() > EARNINGS_HOLD_HOURS * 3_600_000) {
      throw new ConflictError(
        `Refunds can only be issued within ${EARNINGS_HOLD_HOURS} hours of the class being completed, because after that the tutor's earnings are released for withdrawal. Please raise any issue within that time.`,
      );
    }

    const studentAttended = !!scheduled.studentJoinedAt;
    const tutorProfile = await tutorService.getByPublicId(scheduled.tutorPublicId);

    if (scheduled.billingMode === BillingMode.TUTOR_INVITED) {
      // Tutor paid a 2-credit fee per attending student → refund it.
      if (studentAttended) {
        await walletService.refundWallet({
          ownerPublicId: tutorProfile.userPublicId,
          amountCents: PLATFORM_FEE_CENTS * 2,
          description: `Refund platform fee: ${scheduled.title}`,
          idempotencyKey: `tutor-fee-refund-${classPublicId}`,
          referenceId: classPublicId,
          referenceType: 'CLASS_REFUND',
        });
      }
    } else if (isPrepaid(scheduled.billingMode) && scheduled.costCents > 0 && studentAttended) {
      // Curriculum classes were only ever charged `costCents` flat, in bulk, at
      // Course accept time (see courseService.accept) — no
      // platform fee was added on top like the STUDENT_REQUESTED branch below.
      // Refund exactly costCents; refunding costCents + PLATFORM_FEE_CENTS
      // here would over-refund the student by the fee every time.
      const studentProfile = await StudentProfileModel.findOne(
        { publicId: scheduled.studentPublicId, isDeleted: false }, { userPublicId: 1 },
      ).lean();
      if (studentProfile?.userPublicId) {
        const tutorEarningsCents = Math.max(0, scheduled.costCents - PLATFORM_FEE_CENTS);

        // Refund the student exactly what they were charged (no fee) and claw
        // back the tutor's earning (rate − fee, paid on completion) atomically.
        await this.refundWithClawback(classPublicId, scheduled.title, {
          studentUserPublicId: studentProfile.userPublicId,
          tutorUserPublicId: tutorProfile.userPublicId,
          refundAmountCents: scheduled.costCents,
          clawbackAmountCents: tutorEarningsCents,
        });
      }
    } else if (scheduled.costCents > 0 && studentAttended) {
      const studentProfile = await StudentProfileModel.findOne(
        { publicId: scheduled.studentPublicId, isDeleted: false }, { userPublicId: 1 },
      ).lean();
      if (studentProfile?.userPublicId) {
        const studentChargeCents = scheduled.costCents + PLATFORM_FEE_CENTS;
        const tutorEarningsCents = Math.max(0, scheduled.costCents - PLATFORM_FEE_CENTS);

        // Refund the student in full (rate + fee) and claw back the tutor's
        // earning atomically. Must succeed before we mark refunded.
        await this.refundWithClawback(classPublicId, scheduled.title, {
          studentUserPublicId: studentProfile.userPublicId,
          tutorUserPublicId: tutorProfile.userPublicId,
          refundAmountCents: studentChargeCents,
          clawbackAmountCents: tutorEarningsCents,
        });
      }
    }

    const updated = await ScheduledClassModel.findOneAndUpdate(
      { publicId: classPublicId },
      { $set: { isRefunded: true, refundedAt: new Date(), cancellationReason: reason, cancelledBy: actorUserPublicId } },
      { new: true },
    ).lean();

    // Refunds move real money, so leave a record of who did it and why.
    await auditService.log({
      actorId: actorUserPublicId,
      actorRole: (auditContext?.role ?? 'UNKNOWN') as never,
      action: 'CLASS_REFUNDED',
      resourceType: 'ScheduledClass',
      resourceId: classPublicId,
      ip: auditContext?.ip,
      userAgent: auditContext?.userAgent,
      before: { isRefunded: false, status: scheduled.status },
      after: { isRefunded: true, reason, costCents: scheduled.costCents, billingMode: scheduled.billingMode },
    }).catch((error) => logger.error('refundClass: audit log failed', { classPublicId, error: (error as Error).message }));

    return updated!;
  }

  /** Student refund + tutor clawback in one wallet transaction (retry-safe via idempotency keys). */
  private async refundWithClawback(
    classPublicId: string,
    title: string,
    p: { studentUserPublicId: string; tutorUserPublicId: string; refundAmountCents: number; clawbackAmountCents: number },
  ): Promise<void> {
    const result = await walletService.refundWithClawback({
      studentOwnerPublicId: p.studentUserPublicId,
      tutorOwnerPublicId: p.tutorUserPublicId,
      refundAmountCents: p.refundAmountCents,
      clawbackAmountCents: p.clawbackAmountCents,
      refundDescription: `Refund: ${title}`,
      clawbackDescription: `Reversal: ${title}`,
      refundIdempotencyKey: `class-refund-${classPublicId}`,
      clawbackIdempotencyKey: `tutor-reversal-${classPublicId}`,
      referenceId: classPublicId,
      referenceType: 'CLASS_REFUND',
    });
    if (result.clawbackSkipped) {
      // Tutor balance too low (or no wallet): student was refunded in full, the
      // platform absorbs the unrecovered earning. Amounts are NOT reduced.
      logger.warn('Could not claw back tutor earnings on class refund; platform absorbs the difference', {
        classPublicId,
        tutorUserPublicId: p.tutorUserPublicId,
        studentUserPublicId: p.studentUserPublicId,
        refundAmountCents: p.refundAmountCents,
        unrecoveredClawbackCents: p.clawbackAmountCents,
      });
    }
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
    return buildPaginatedResult(await this.withParticipantNames(items), total, page, limit);
  }

  /** `studentPublicId` is one profile id, or every profile id of a student with several tutor links. */
  async getClassesByStudent(
    studentPublicId: string | string[],
    filters: { status?: string; from?: Date; to?: Date },
    query: PaginationQuery,
  ): Promise<PaginatedResult<IScheduledClass>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = {
      studentPublicId: Array.isArray(studentPublicId) ? { $in: studentPublicId } : studentPublicId,
      isDeleted: false,
    };
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
    return buildPaginatedResult(await this.withParticipantNames(items), total, page, limit);
  }

  /**
   * Attaches `tutorName` / `studentName` to a page of classes.
   *
   * Rows store profile ids, so a tutor's class list would otherwise show no
   * indication of *who* the class is for. Resolved in two queries per page
   * rather than per row.
   */
  async withParticipantNames<T extends { tutorPublicId: string; studentPublicId: string }>(
    items: T[],
  ): Promise<(T & { tutorName: string; studentName: string })[]> {
    if (items.length === 0) return [];

    const tutorIds = [...new Set(items.map((c) => c.tutorPublicId))];
    const studentIds = [...new Set(items.map((c) => c.studentPublicId))];

    const [tutorProfiles, studentProfiles] = await Promise.all([
      TutorProfileModel.find({ publicId: { $in: tutorIds } }, { publicId: 1, userPublicId: 1 }).lean(),
      StudentProfileModel.find({ publicId: { $in: studentIds } }, { publicId: 1, userPublicId: 1 }).lean(),
    ]);

    const { UserModel } = await import('../users/user.model');
    const users = await UserModel.find(
      { publicId: { $in: [...tutorProfiles, ...studentProfiles].map((p) => p.userPublicId) } },
      { publicId: 1, firstName: 1, lastName: 1 },
    ).lean();

    const nameByUser = new Map(users.map((u) => [u.publicId, `${u.firstName} ${u.lastName}`.trim()]));
    const tutorName = new Map(tutorProfiles.map((p) => [p.publicId, nameByUser.get(p.userPublicId) ?? 'Unknown tutor']));
    const studentName = new Map(studentProfiles.map((p) => [p.publicId, nameByUser.get(p.userPublicId) ?? 'Unknown student']));

    return items.map((c) => ({
      ...c,
      tutorName: tutorName.get(c.tutorPublicId) ?? 'Unknown tutor',
      studentName: studentName.get(c.studentPublicId) ?? 'Unknown student',
    }));
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

  /**
   * Enforces the platform's booking window and duration limits. Throws a
   * ValidationError describing the first limit broken.
   */
  private assertWithinClassLimits(
    settings: { maxAdvanceBookingDays: number; minClassDurationMinutes: number; maxClassDurationMinutes: number },
    occurrences: Array<{ start: Date }>,
    durationMinutes: number,
  ): void {
    const { maxAdvanceBookingDays, minClassDurationMinutes, maxClassDurationMinutes } = settings;
    if (durationMinutes < minClassDurationMinutes || durationMinutes > maxClassDurationMinutes) {
      const msg = `Class duration must be between ${minClassDurationMinutes} and ${maxClassDurationMinutes} minutes (got ${durationMinutes}).`;
      throw new ValidationError([msg], msg);
    }
    const latestAllowed = Date.now() + maxAdvanceBookingDays * 86_400_000;
    const tooFar = occurrences.find((o) => o.start.getTime() > latestAllowed);
    if (tooFar) {
      const msg = `Classes can only be scheduled up to ${maxAdvanceBookingDays} days in advance (${tooFar.start.toISOString()} is too far ahead).`;
      throw new ValidationError([msg], msg);
    }
  }

  /** First live (SCHEDULED/LIVE) class of this tutor overlapping any of the ranges. */
  private async findTutorOverlap(
    tutorPublicId: string,
    ranges: Array<{ start: Date; end: Date }>,
  ): Promise<{ startUTC: Date; endUTC: Date } | null> {
    if (ranges.length === 0) return null;
    return ScheduledClassModel.findOne({
      tutorPublicId,
      isDeleted: false,
      status: { $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] },
      $or: ranges.map((r) => ({ startUTC: { $lt: r.end }, endUTC: { $gt: r.start } })),
    }, { startUTC: 1, endUTC: 1 }).lean() as unknown as Promise<{ startUTC: Date; endUTC: Date } | null>;
  }

  async tutorCreateClasses(
    tutorUserPublicId: string,
    dto: TutorCreateClassDto,
  ): Promise<IScheduledClass[]> {
    const tutorProfile = await tutorService.getByUserPublicId(tutorUserPublicId);

    // Determine student public IDs to assign
    let studentPublicIds: string[] = [...new Set(dto.studentPublicIds)];
    if (studentPublicIds.length > 0) {
      // Explicit ids must be this tutor's own active students (a principal
      // creating classes acts through their own tutor profile, same rule).
      const owned = await StudentProfileModel.find(
        { publicId: { $in: studentPublicIds }, tutorPublicId: tutorProfile.publicId, status: 'ACTIVE', isDeleted: false },
        { publicId: 1 },
      ).lean();
      const ownedIds = new Set(owned.map((s) => s.publicId));
      const bad = studentPublicIds.filter((id) => !ownedIds.has(id));
      if (bad.length > 0) {
        throw new ValidationError(
          { studentPublicIds: bad.map((id) => `${id} is not one of your active students`) },
          `These students are not your active students: ${bad.join(', ')}`,
        );
      }
    }
    if (studentPublicIds.length === 0) {
      const allStudents = await StudentProfileModel.find(
        { tutorPublicId: tutorProfile.publicId, isDeleted: false, status: { $in: ['ACTIVE', 'APPROVED'] } },
        { publicId: 1 },
      ).lean();
      studentPublicIds = allStudents.map((s) => s.publicId);
    }

    // Native live room fits up to 10 students (+ tutor + linked principal = 12).
    // Larger groups must run on an external Google Meet / Zoom link.
    const MAX_NATIVE_GROUP_STUDENTS = 10;
    const externalUrl = dto.meetingUrl?.trim() || undefined;
    if (studentPublicIds.length > MAX_NATIVE_GROUP_STUDENTS && !externalUrl) {
      throw new AppError(
        `This class has ${studentPublicIds.length} students. The in-app room supports up to ${MAX_NATIVE_GROUP_STUDENTS}. Add a Google Meet or Zoom link to host a larger group.`,
        400,
      );
    }
    const meetingProvider = externalUrl
      ? (dto.meetingProvider ?? (/zoom/i.test(externalUrl) ? 'zoom' : 'google_meet'))
      : 'native';

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

    // Platform limits (demo classes are exempt) and tutor double-booking.
    if (dto.classType !== ClassType.DEMO) {
      this.assertWithinClassLimits(
        await settingsService.get(),
        occurrences,
        Math.round(durationMs / 60_000),
      );
    }
    const clash = await this.findTutorOverlap(tutorProfile.publicId, occurrences);
    if (clash) {
      throw new ConflictError(
        `You already have a class from ${new Date(clash.startUTC).toISOString()} to ${new Date(clash.endUTC).toISOString()} that overlaps this request. No classes were created.`,
      );
    }

    // The tutor pays a 2-credit platform fee per attending student on completion.
    // Require enough balance up front so they can't create a class they can't fund.
    const PER_STUDENT_FEE_CENTS = PLATFORM_FEE_CENTS * 2;
    const billableCount = studentPublicIds.length * occurrences.length;
    if (billableCount > 0) {
      const requiredCents = billableCount * PER_STUDENT_FEE_CENTS;
      const wallet = await walletService.getWallet(tutorProfile.userPublicId);
      if (wallet.balanceCents < requiredCents) {
        throw new AppError(
          `You don't have enough credits to create this class. It needs ${requiredCents / 100} credits (2 per student) but your balance is ${wallet.balanceCents / 100}. Please top up your wallet.`,
          402,
        );
      }
    }

    // Create one ScheduledClass per occurrence × student (or just for the tutor if no students)
    const created: IScheduledClass[] = [];
    const ianaTimezone = 'UTC';
    const durationMinutes = Math.round(durationMs / 60_000);

    for (const occ of occurrences) {
      // For GROUP/RECURRING with multiple students, create one class per student so each has their own record
      const targets = studentPublicIds.length > 0 ? studentPublicIds : [''];
      // Several students in one session = one group: their records share a live room.
      const groupPublicId = targets.length > 1 ? uuidv4() : undefined;
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
          billingMode: BillingMode.TUTOR_INVITED,
          meetingUrl: externalUrl,
          meetingProvider,
          groupPublicId,
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
          // The student's own first record, not the first one created for anybody.
          classPublicId: created.find((c) => c.studentPublicId === sp.publicId)?.publicId ?? '',
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
        // Sessions per student, not the records created for all students together.
        count: occurrences.length,
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

    const newStart = new Date(dto.startUTC);
    const newEnd = new Date(dto.endUTC);
    if (!(newEnd.getTime() > newStart.getTime())) {
      throw new AppError('End time must be after start time', 400);
    }
    if (newStart.getTime() <= Date.now()) {
      throw new AppError('Cannot reschedule a class into the past', 400);
    }

    // The tutor must not be double-booked against any other live booking.
    const overlapping = await ScheduledClassModel.findOne({
      publicId: { $ne: classPublicId },
      // The other students of this same group session move with it; they are not a clash.
      ...(cls.groupPublicId ? { groupPublicId: { $ne: cls.groupPublicId } } : {}),
      tutorPublicId: tutorProfile.publicId,
      isDeleted: false,
      status: { $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] },
      startUTC: { $lt: newEnd },
      endUTC: { $gt: newStart },
    }, { publicId: 1 }).lean();
    if (overlapping) throw new ConflictError('You already have a class during that time');

    // A course class was scheduled inside the student's stated free times; a
    // reschedule must respect them too, exactly like the first scheduling did.
    if (cls.coursePublicId) {
      // Course classes are priced per class, so a reschedule may move the time but never the length.
      if (!isCourseClassLength(newStart, newEnd)) {
        throw new AppError(`Every course class must be exactly ${COURSE_CLASS_MINUTES} minutes long`, 400);
      }
      const { CourseModel } = await import('../courses/course.model');
      const course = await CourseModel.findOne({ publicId: cls.coursePublicId }, { availabilityWindow: 1 }).lean();
      if (course?.availabilityWindow && !isWithinAvailability(course.availabilityWindow, newStart, newEnd)) {
        throw new AppError("Requested time is outside the student's stated availability window", 400);
      }
    }

    const durationMinutes = Math.round((newEnd.getTime() - newStart.getTime()) / 60_000);

    // Status-guarded write: a concurrent complete/cancel must not be overwritten.
    // The class is detached from its availability slot (which still describes the
    // original time) so a later cancel can't free a slot showing a stale time.
    const updated = await ScheduledClassModel.findOneAndUpdate(
      {
        publicId: classPublicId,
        isDeleted: false,
        status: { $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] },
      },
      {
        $set: { startUTC: newStart, endUTC: newEnd, durationMinutes },
        $unset: { availabilitySlotPublicId: '', reminderSentAt: '' },
      },
      { new: true },
    ).lean();
    if (!updated) throw new ConflictError('Class is no longer reschedulable');

    if (cls.availabilitySlotPublicId) {
      try {
        await scheduleService.releaseSlot(cls.availabilitySlotPublicId);
      } catch (err) {
        logger.error('Failed to release availability slot after reschedule', { classPublicId, err });
      }
    }

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

    // A group session moves as a whole: every student's record gets the new time.
    const siblings = await this._openGroupSiblings(cls);
    if (siblings.length > 0) {
      await ScheduledClassModel.updateMany(
        { publicId: { $in: siblings.map((x) => x.publicId) } },
        { $set: { startUTC: newStart, endUTC: newEnd, durationMinutes }, $unset: { reminderSentAt: '' } },
      );
      const siblingRecords = await ScheduledClassModel.find(
        { publicId: { $in: siblings.map((x) => x.publicId) } },
        { publicId: 1, studentPublicId: 1 },
      ).lean();
      const siblingStudents = await StudentProfileModel.find(
        { publicId: { $in: siblingRecords.map((x) => x.studentPublicId) }, isDeleted: false },
        { publicId: 1, userPublicId: 1 },
      ).lean();
      for (const record of siblingRecords) {
        const student = siblingStudents.find((x) => x.publicId === record.studentPublicId);
        domainEvents.emit(DomainEvent.CLASS_RESCHEDULED, {
          classPublicId: record.publicId,
          tutorPublicId: tutorProfile.publicId,
          tutorUserPublicId,
          studentUserPublicId: student?.userPublicId ?? '',
          newStartUTC: dto.startUTC,
        });
      }
    }

    return updated!;
  }

  /**
   * Closes classes that ran past their end time with nobody closing them.
   *
   * Two cases, distinguished by whether the class was ever started:
   *   • LIVE      — the tutor ran it and forgot to press Complete. Completing
   *                 it settles the money exactly as the manual path does, so
   *                 the tutor is paid and the student is charged correctly.
   *   • SCHEDULED — nobody started it. Cancelling refunds the student through
   *                 the normal cancellation path.
   *
   * Both are tagged with `autoResolution` so the UI can say a human did not do
   * this, and so the pair can be audited or reversed later.
   *
   * Runs on a repeating job; safe to run concurrently because each class is
   * claimed with a conditional update before any money moves.
   */
  async autoResolveOverdueClasses(): Promise<{ completed: number; cancelled: number; held: number }> {
    const cutoff = new Date(Date.now() - AUTO_RESOLVE_GRACE_MINUTES * 60 * 1000);

    const overdue = await ScheduledClassModel.find(
      {
        isDeleted: false,
        endUTC: { $lte: cutoff },
        status: { $in: [ClassStatus.LIVE, ClassStatus.SCHEDULED] },
        autoResolution: { $exists: false },
        needsTutorDecision: { $ne: true },
      },
      {
        publicId: 1, status: 1, tutorPublicId: 1,
        studentJoinedAt: 1, tutorJoinedAt: 1, startedAt: 1, endUTC: 1,
      },
    )
      .limit(200)
      .lean();

    let completed = 0;
    let cancelled = 0;
    let held = 0;

    for (const cls of overdue) {
      /* Only settle a LIVE class automatically when it plausibly happened: both
         people present, together, for at least the minimum. Anything shorter is
         ambiguous — it could be a mis-click or a session that fell apart — so a
         human decides rather than the platform moving money on a guess. */
      if (cls.status === ClassStatus.LIVE && !this._metMinimumSession(cls)) {
        await ScheduledClassModel.updateOne(
          { publicId: cls.publicId, needsTutorDecision: { $ne: true } },
          { $set: { needsTutorDecision: true } },
        );
        held += 1;
        continue;
      }

      // Claim it first: the conditional match means a second worker (or a
      // tutor pressing Complete right now) cannot double-resolve the class.
      const claimed = await ScheduledClassModel.findOneAndUpdate(
        { publicId: cls.publicId, status: cls.status, autoResolution: { $exists: false } },
        {
          $set: {
            autoResolution: cls.status === ClassStatus.LIVE
              ? AutoResolution.AUTO_COMPLETED
              : AutoResolution.AUTO_CANCELLED,
            autoResolvedAt: new Date(),
          },
        },
        { new: true },
      ).lean();
      if (!claimed) continue;

      try {
        if (cls.status === ClassStatus.LIVE) {
          const tutor = await tutorService.getByPublicId(cls.tutorPublicId);
          await this.completeClass(cls.publicId, tutor.userPublicId);
          completed += 1;
        } else {
          await this.cancelClass(cls.publicId, 'system', {
            reason: `Auto-cancelled: nobody joined within ${AUTO_RESOLVE_GRACE_MINUTES} minutes of the end time`,
          } as CancelClassDto);
          cancelled += 1;
        }
      } catch (error) {
        // Release the claim so a later sweep can retry rather than leaving the
        // class tagged as resolved when the settlement actually failed.
        await ScheduledClassModel.updateOne(
          { publicId: cls.publicId },
          { $unset: { autoResolution: '', autoResolvedAt: '' } },
        );
        logger.warn('Auto-resolve failed for class', {
          classPublicId: cls.publicId,
          status: cls.status,
          error: (error as Error).message,
        });
      }
    }

    return { completed, cancelled, held };
  }

  /**
   * Did tutor and student overlap in the room for long enough to call it a
   * lesson? Measured from the later of the two join times, so one person sitting
   * alone for an hour does not count.
   *
   * This is a proxy: there is no per-second presence heartbeat, so it cannot
   * detect someone joining and immediately walking away. It answers "were both
   * present, and did the session run at least this long".
   */
  /**
   * Minutes the student was really in the class: from when they joined (never
   * earlier than the scheduled start) to now, capped at the scheduled end. The
   * old code recorded the full scheduled length even for a class completed
   * minutes after it began.
   */
  private _minutesActuallyPresent(
    cls: Pick<IScheduledClass, 'startUTC' | 'endUTC' | 'durationMinutes' | 'studentJoinedAt'>,
  ): number {
    if (!cls.studentJoinedAt) return 0;
    const from = Math.max(new Date(cls.studentJoinedAt).getTime(), new Date(cls.startUTC).getTime());
    const until = Math.min(Date.now(), new Date(cls.endUTC).getTime());
    const minutes = Math.round((until - from) / 60_000);
    return Math.max(0, Math.min(minutes, cls.durationMinutes ?? minutes));
  }

  /**
   * A tutor must not be able to complete (and get paid for) a class that has
   * not started, or that the student joined seconds ago. Completing a class
   * nobody attended is allowed once it is due; it simply records an absence.
   */
  private _assertCanCompleteNow(
    cls: Pick<IScheduledClass, 'startUTC' | 'endUTC' | 'durationMinutes' | 'studentJoinedAt' | 'tutorJoinedAt'>,
  ): void {
    const now = Date.now();
    const startMs = new Date(cls.startUTC).getTime();
    const endMs = new Date(cls.endUTC).getTime();
    if (now < startMs) {
      throw new ConflictError(
        'This class has not started yet. Wait until its scheduled start time, or cancel it instead.',
      );
    }
    if (now >= endMs || !cls.studentJoinedAt) return;

    // The student is waiting but the tutor never entered: say so, instead of
    // reporting "the student joined 0 minutes ago".
    if (!cls.tutorJoinedAt) {
      throw new ConflictError(
        'You have not joined this class yet. Join the room first, or cancel the class if you cannot teach it.',
      );
    }

    const bothPresentFrom = Math.max(
      new Date(cls.studentJoinedAt).getTime(),
      cls.tutorJoinedAt ? new Date(cls.tutorJoinedAt).getTime() : now,
    );
    const requiredMinutes = Math.min(MIN_SESSION_MINUTES, Math.max(1, Math.floor((cls.durationMinutes ?? 0) / 2)));
    const minutesTogether = (now - bothPresentFrom) / 60_000;
    if (minutesTogether < requiredMinutes) {
      throw new ConflictError(
        `The student joined only ${Math.max(0, Math.floor(minutesTogether))} minute(s) ago. You can complete this class after ${requiredMinutes} minutes together or once its scheduled end time passes.`,
      );
    }
  }

  private _metMinimumSession(cls: Pick<
    IScheduledClass,
    'studentJoinedAt' | 'tutorJoinedAt' | 'endUTC'
  >): boolean {
    if (!cls.studentJoinedAt || !cls.tutorJoinedAt) return false;

    const bothPresentFrom = Math.max(
      new Date(cls.studentJoinedAt).getTime(),
      new Date(cls.tutorJoinedAt).getTime(),
    );
    // Cap at the scheduled end so a class left open all night isn't counted as
    // an all-night lesson.
    const until = Math.min(Date.now(), new Date(cls.endUTC).getTime());
    const minutesTogether = (until - bothPresentFrom) / 60_000;

    return minutesTogether >= MIN_SESSION_MINUTES;
  }

  /** Classes parked awaiting the tutor's Complete/Cancel decision. */
  async listAwaitingDecision(tutorUserPublicId: string): Promise<IScheduledClass[]> {
    const tutorProfile = await TutorProfileModel.findOne(
      { userPublicId: tutorUserPublicId, isDeleted: false },
      { publicId: 1 },
    ).lean();
    if (!tutorProfile) return [];

    return ScheduledClassModel.find({
      tutorPublicId: tutorProfile.publicId,
      needsTutorDecision: true,
      status: ClassStatus.LIVE,
      isDeleted: false,
    })
      .sort({ endUTC: 1 })
      .lean();
  }

  /**
   * Platform-wide class listing for the admin finance screen. `refundable` narrows
   * to the only classes `refundClass` will accept: completed, paid and not already
   * refunded — so the UI never offers a button that is going to 409.
   */
  async listForAdmin(
    filters: { status?: string; refundable?: boolean; refunded?: boolean; days?: number; billingFailed?: boolean },
    query: PaginationQuery,
  ) {
    const { page, limit, skip } = parsePaginationQuery(query);

    const filter: Record<string, unknown> = { isDeleted: false };
    if (filters.billingFailed) filter.billingFailed = true;
    if (filters.refundable) {
      filter.status = ClassStatus.COMPLETED;
      filter.isRefunded = false;
      filter.costCents = { $gt: 0 };
      // Only inside the refund window (see refundClass): older classes would 409.
      const cutoff = new Date(Date.now() - EARNINGS_HOLD_HOURS * 3_600_000);
      filter.$or = [
        { completedAt: { $gte: cutoff } },
        { completedAt: { $exists: false }, endUTC: { $gte: cutoff } },
      ];
    } else {
      if (filters.status) filter.status = filters.status;
      if (filters.refunded !== undefined) filter.isRefunded = filters.refunded;
    }
    if (filters.days) {
      filter.startUTC = { $gte: new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000) };
    }

    const [items, total] = await Promise.all([
      ScheduledClassModel.find(filter).sort({ startUTC: -1 }).skip(skip).limit(limit).lean(),
      ScheduledClassModel.countDocuments(filter),
    ]);

    // Rows key off profile ids; resolve both sides to names so the table is usable.
    const tutorIds = [...new Set(items.map((c) => c.tutorPublicId))];
    const studentIds = [...new Set(items.map((c) => c.studentPublicId))];

    const [tutorProfiles, studentProfiles] = await Promise.all([
      TutorProfileModel.find({ publicId: { $in: tutorIds } }, { publicId: 1, userPublicId: 1 }).lean(),
      StudentProfileModel.find({ publicId: { $in: studentIds } }, { publicId: 1, userPublicId: 1 }).lean(),
    ]);

    const { UserModel } = await import('../users/user.model');
    const userIds = [
      ...tutorProfiles.map((p) => p.userPublicId),
      ...studentProfiles.map((p) => p.userPublicId),
    ];
    const users = await UserModel.find(
      { publicId: { $in: userIds } },
      { publicId: 1, firstName: 1, lastName: 1 },
    ).lean();

    const nameByUserId = new Map(users.map((u) => [u.publicId, `${u.firstName} ${u.lastName}`]));
    const tutorNameByProfile = new Map(
      tutorProfiles.map((p) => [p.publicId, nameByUserId.get(p.userPublicId) ?? 'Unknown tutor']),
    );
    const studentNameByProfile = new Map(
      studentProfiles.map((p) => [p.publicId, nameByUserId.get(p.userPublicId) ?? 'Unknown student']),
    );

    const hydrated = items.map((c) => ({
      ...c,
      tutorName: tutorNameByProfile.get(c.tutorPublicId) ?? 'Unknown tutor',
      studentName: studentNameByProfile.get(c.studentPublicId) ?? 'Unknown student',
    }));

    return buildPaginatedResult(hydrated, total, page, limit);
  }
}

export const classService = new ClassService();
