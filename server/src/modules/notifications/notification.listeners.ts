import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { notificationService } from './notification.service';
import { NotificationType } from './notification.types';
import { logger } from '../../lib/logger';
import { StudentProfileModel } from '../students/student.model';
import { TutorProfileModel } from '../tutors/tutor.model';
import { UserModel } from '../users/user.model';
import { ScheduledClassModel } from '../schedules/schedule.model';

/**
 * Turns domain events into in-app notifications for the bell.
 *
 * The socket layer already pushes these events out for cache invalidation and
 * toasts, but those are transient — nothing survived a refresh, so the bell was
 * permanently empty. This is the durable half: one row per event, per recipient.
 *
 * Registered once at startup, not per connection.
 */

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Never let a notification write break the flow that emitted the event. */
function notify(
  recipientPublicId: string | undefined,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): void {
  if (!recipientPublicId) return;
  notificationService
    .create({ recipientPublicId, type, title, body, data })
    .catch((error) => logger.warn('notification write failed', { type, error: String(error) }));
}

/** "Sam Student" — falls back to "A student" when the user cannot be found. */
async function displayName(userPublicId: string | undefined, fallback: string): Promise<string> {
  if (!userPublicId) return fallback;
  const user = await UserModel.findOne({ publicId: userPublicId }, { firstName: 1, lastName: 1 }).lean();
  const name = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
  return name || fallback;
}

/** "30 Sep 2026, 10:00 UTC" for a class — empty when the class is unknown. */
async function classWhen(classPublicId: string | undefined): Promise<string> {
  if (!classPublicId) return '';
  const cls = await ScheduledClassModel.findOne({ publicId: classPublicId }, { startUTC: 1 }).lean();
  if (!cls?.startUTC) return '';
  const d = new Date(cls.startUTC);
  const pad = (n: number) => String(n).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export function registerNotificationListeners(): void {
  domainEvents.on(DomainEvent.CLASS_BOOKED, async (p: {
    tutorUserPublicId: string; studentUserPublicId: string; classPublicId: string; classType: string;
  }) => {
    const [student, when] = await Promise.all([
      displayName(p.studentUserPublicId, 'A student'),
      classWhen(p.classPublicId),
    ]);
    notify(p.tutorUserPublicId, NotificationType.CLASS_BOOKED, 'New class booked',
      `${student} booked a session with you${when ? ` on ${when}` : ''}.`, { classPublicId: p.classPublicId });
    notify(p.studentUserPublicId, NotificationType.CLASS_BOOKED, 'Class confirmed',
      `Your session${when ? ` on ${when}` : ''} is on the calendar.`, { classPublicId: p.classPublicId });
  });

  domainEvents.on(DomainEvent.CLASS_CREATED_BY_TUTOR, (p: {
    studentUserPublicIds: string[]; title: string; count: number;
    requiresAcceptance?: boolean; studentChargeCents?: number;
  }) => {
    if (p.requiresAcceptance) {
      const price = p.studentChargeCents ? ` Each session is ${p.studentChargeCents / 100} credits, charged only after it is completed.` : '';
      const what = p.count > 1 ? `${p.count} sessions of "${p.title}"` : `"${p.title}"`;
      p.studentUserPublicIds.forEach((uid) =>
        notify(uid, NotificationType.CLASS_BOOKED, 'Class request',
          `Your tutor invited you to ${what}.${price} Accept it in your Classes to confirm your place.`));
      return;
    }
    const body = p.count > 1 ? `${p.count} sessions were scheduled for you.` : `"${p.title}" was scheduled for you.`;
    p.studentUserPublicIds.forEach((uid) =>
      notify(uid, NotificationType.CLASS_BOOKED, 'New class scheduled', body));
  });

  domainEvents.on(DomainEvent.CLASS_REQUEST_RESPONDED, async (p: {
    classPublicId: string; title: string; answer: 'ACCEPTED' | 'DECLINED' | 'EXPIRED'; sessions: number;
    tutorUserPublicId: string; studentUserPublicId: string;
  }) => {
    const student = await displayName(p.studentUserPublicId, 'A student');
    const what = p.sessions > 1 ? `${p.sessions} sessions of "${p.title}"` : `"${p.title}"`;
    const verb = p.answer === 'ACCEPTED' ? 'accepted' : p.answer === 'DECLINED' ? 'declined' : 'did not answer in time for';
    notify(p.tutorUserPublicId, NotificationType.CLASS_BOOKED, `Class request ${p.answer.toLowerCase()}`,
      `${student} ${verb} ${what}.`, { classPublicId: p.classPublicId });
  });

  domainEvents.on(DomainEvent.CLASS_STARTED, async (p: {
    classPublicId: string; tutorUserPublicId?: string; studentUserPublicId?: string;
    startedBy?: string; wentLive?: boolean;
  }) => {
    // Announce the class going live once, not on every later join, and word it
    // by who actually opened the room.
    if (p.wentLive === false) return;
    if (p.startedBy === 'STUDENT') {
      const student = await displayName(p.studentUserPublicId, 'Your student');
      notify(p.tutorUserPublicId, NotificationType.CLASS_STARTED, 'Your student is waiting',
        `${student} has joined the class room — join now.`, { classPublicId: p.classPublicId });
      return;
    }
    if (p.startedBy && p.startedBy !== 'TUTOR') return; // an observer opening the room
    notify(p.studentUserPublicId, NotificationType.CLASS_STARTED, 'Your class is live',
      'Your tutor has started the session — join now.', { classPublicId: p.classPublicId });
  });

  domainEvents.on(DomainEvent.CLASS_COMPLETED, (p: {
    tutorUserPublicId: string; studentUserPublicId: string; classPublicId?: string; incomplete?: boolean;
  }) => {
    if (p.incomplete) {
      notify(p.studentUserPublicId, NotificationType.CLASS_COMPLETED, 'Class incomplete',
        'The tutor was not in the session for long enough, so it was marked incomplete. You were not charged.',
        { classPublicId: p.classPublicId });
      notify(p.tutorUserPublicId, NotificationType.CLASS_COMPLETED, 'Class incomplete',
        'You were not in the session for the required time, so it was marked incomplete and not paid.',
        { classPublicId: p.classPublicId });
      return;
    }
    notify(p.studentUserPublicId, NotificationType.CLASS_COMPLETED, 'Class completed',
      'Your session has ended. Leave a rating for your tutor.', { classPublicId: p.classPublicId });
  });

  domainEvents.on(DomainEvent.CLASS_CANCELLED, (p: {
    tutorUserPublicId: string; studentUserPublicId: string; classPublicId?: string;
  }) => {
    notify(p.tutorUserPublicId, NotificationType.CLASS_CANCELLED, 'Class cancelled',
      'A scheduled session was cancelled.', { classPublicId: p.classPublicId });
    notify(p.studentUserPublicId, NotificationType.CLASS_CANCELLED, 'Class cancelled',
      'A scheduled session was cancelled and any credits were returned.', { classPublicId: p.classPublicId });
  });

  domainEvents.on(DomainEvent.CLASS_RESCHEDULED, (p: {
    studentUserPublicId?: string; classPublicId?: string; newStartUTC?: string;
  }) => {
    notify(p.studentUserPublicId, NotificationType.CLASS_RESCHEDULED, 'Class rescheduled',
      p.newStartUTC
        ? `Your tutor moved a session to ${new Date(p.newStartUTC).toUTCString()}.`
        : 'Your tutor moved a session to a new time.',
      { classPublicId: p.classPublicId });
  });

  // Assignment events carry the student/tutor PROFILE ids; the bell is keyed by USER id.
  domainEvents.on(DomainEvent.ASSIGNMENT_GRADED, (p: { studentPublicId: string; assignmentPublicId?: string }) => {
    void (async () => {
      const student = await StudentProfileModel.findOne({ publicId: p.studentPublicId }, { userPublicId: 1 }).lean();
      notify(student?.userPublicId, NotificationType.ASSIGNMENT_GRADED, 'Assignment graded',
        'Your tutor has graded your submission.', { assignmentPublicId: p.assignmentPublicId });
    })().catch((error) => logger.warn('assignment graded notification failed', { error: String(error) }));
  });

  domainEvents.on(DomainEvent.ASSIGNMENT_SUBMITTED, (p: {
    assignmentPublicId: string; studentPublicId: string; graderTutorPublicId?: string; ownerTutorPublicId?: string;
  }) => {
    void (async () => {
      const tutorProfileId = p.graderTutorPublicId ?? p.ownerTutorPublicId;
      const [student, tutor] = await Promise.all([
        StudentProfileModel.findOne({ publicId: p.studentPublicId }, { userPublicId: 1 }).lean(),
        tutorProfileId ? TutorProfileModel.findOne({ publicId: tutorProfileId }, { userPublicId: 1 }).lean() : null,
      ]);
      notify(student?.userPublicId, NotificationType.ASSIGNMENT_SUBMITTED, 'Assignment submitted',
        'Your assignment has been submitted successfully.', { assignmentPublicId: p.assignmentPublicId });
      notify(tutor?.userPublicId, NotificationType.ASSIGNMENT_SUBMITTED, 'New submission to grade',
        'A student submitted an assignment for you to grade.', { assignmentPublicId: p.assignmentPublicId });
    })().catch((error) => logger.warn('assignment submitted notification failed', { error: String(error) }));
  });

  domainEvents.on(DomainEvent.TUTOR_LEFT_ORGANIZATION, (p: {
    tutorUserPublicId: string; principalUserPublicId: string; initiatedBy: 'TUTOR' | 'PRINCIPAL'; tutorName: string;
  }) => {
    if (p.initiatedBy === 'TUTOR') {
      notify(p.principalUserPublicId, NotificationType.TUTOR_LEFT_ORGANIZATION, 'Tutor left your organization',
        `${p.tutorName} has left your organization.`);
    } else {
      notify(p.tutorUserPublicId, NotificationType.TUTOR_LEFT_ORGANIZATION, 'Removed from organization',
        'You were removed from an organization.');
    }
  });

  domainEvents.on(DomainEvent.PAYOUT_INITIATED, (p: { ownerPublicId: string; amountCents: number }) => {
    notify(p.ownerPublicId, NotificationType.PAYOUT_REQUESTED, 'Payout requested',
      `Your ${money(p.amountCents)} payout request is awaiting review.`);
  });

  domainEvents.on(DomainEvent.PAYOUT_COMPLETED, (p: { ownerPublicId: string; amountCents: number }) => {
    notify(p.ownerPublicId, NotificationType.PAYOUT_APPROVED, 'Payout approved',
      `Your ${money(p.amountCents)} payout was approved.`);
  });

  domainEvents.on(DomainEvent.PAYOUT_FAILED, (p: { ownerPublicId: string; amountCents: number }) => {
    notify(p.ownerPublicId, NotificationType.PAYOUT_REJECTED, 'Payout rejected',
      `Your ${money(p.amountCents)} payout was rejected and the funds were returned to your wallet.`);
  });

  domainEvents.on(DomainEvent.ATTENDANCE_MARKED, (p: { studentPublicId: string; status: string }) => {
    notify(p.studentPublicId, NotificationType.ATTENDANCE_MARKED, 'Attendance updated',
      `You were marked ${p.status.toLowerCase()} for a class.`);
  });

  domainEvents.on(DomainEvent.CREDITS_ADDED, (p: { ownerPublicId: string; amountCents: number }) => {
    notify(p.ownerPublicId, NotificationType.WALLET_CREDITED, 'Credits added',
      `${money(p.amountCents)} was added to your wallet.`);
  });

  domainEvents.on(DomainEvent.CREDITS_DEDUCTED, (p: { ownerPublicId: string; amountCents: number }) => {
    notify(p.ownerPublicId, NotificationType.WALLET_DEBITED, 'Credits deducted',
      `${money(p.amountCents)} was deducted from your wallet.`);
  });

  domainEvents.on(DomainEvent.STUDENT_APPROVED, (p: { studentUserPublicId?: string }) => {
    notify(p.studentUserPublicId, NotificationType.STUDENT_APPROVED, 'You are approved',
      'Your student account has been approved — you can book classes now.');
  });

  domainEvents.on(DomainEvent.TUTOR_APPROVED, (p: { userPublicId?: string }) => {
    notify(p.userPublicId, NotificationType.TUTOR_APPROVED, 'You are approved',
      'Your tutor account has been verified.');
  });

  domainEvents.on(DomainEvent.PRINCIPAL_APPROVED, (p: { userPublicId?: string }) => {
    notify(p.userPublicId, NotificationType.PRINCIPAL_APPROVED, 'You are approved',
      'Your principal account has been approved.');
  });

  domainEvents.on(DomainEvent.DEMO_REQUEST_CREATED, async (p: {
    tutorUserPublicId: string; studentUserPublicId?: string; subject?: string;
  }) => {
    const student = await displayName(p.studentUserPublicId, 'A student');
    notify(p.tutorUserPublicId, NotificationType.DEMO_REQUESTED, 'New demo request',
      p.subject ? `${student} wants a demo for ${p.subject}.` : `${student} sent you a demo request.`);
  });

  domainEvents.on(DomainEvent.DEMO_REQUEST_ACCEPTED, (p: {
    studentUserPublicId: string; subject: string; classPublicId: string;
  }) => {
    notify(p.studentUserPublicId, NotificationType.DEMO_ACCEPTED, 'Demo class accepted',
      `Your ${p.subject} demo has been scheduled.`, { classPublicId: p.classPublicId });
  });

  domainEvents.on(DomainEvent.DEMO_REQUEST_REJECTED, (p: {
    studentUserPublicId: string; subject: string;
  }) => {
    notify(p.studentUserPublicId, NotificationType.DEMO_REJECTED, 'Demo request declined',
      `Your ${p.subject} demo request was not accepted this time.`);
  });
}
