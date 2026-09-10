import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { notificationService } from './notification.service';
import { NotificationType } from './notification.types';
import { logger } from '../../lib/logger';

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

export function registerNotificationListeners(): void {
  domainEvents.on(DomainEvent.CLASS_BOOKED, (p: {
    tutorUserPublicId: string; studentUserPublicId: string; classPublicId: string; classType: string;
  }) => {
    notify(p.tutorUserPublicId, NotificationType.CLASS_BOOKED, 'New class booked',
      'A student booked a session with you.', { classPublicId: p.classPublicId });
    notify(p.studentUserPublicId, NotificationType.CLASS_BOOKED, 'Class confirmed',
      'Your session is on the calendar.', { classPublicId: p.classPublicId });
  });

  domainEvents.on(DomainEvent.CLASS_CREATED_BY_TUTOR, (p: {
    studentUserPublicIds: string[]; title: string; count: number;
  }) => {
    const body = p.count > 1 ? `${p.count} sessions were scheduled for you.` : `"${p.title}" was scheduled for you.`;
    p.studentUserPublicIds.forEach((uid) =>
      notify(uid, NotificationType.CLASS_BOOKED, 'New class scheduled', body));
  });

  domainEvents.on(DomainEvent.CLASS_STARTED, (p: {
    classPublicId: string; studentUserPublicId?: string;
  }) => {
    notify(p.studentUserPublicId, NotificationType.CLASS_STARTED, 'Your class is live',
      'Your tutor has started the session — join now.', { classPublicId: p.classPublicId });
  });

  domainEvents.on(DomainEvent.CLASS_COMPLETED, (p: {
    tutorUserPublicId: string; studentUserPublicId: string; classPublicId?: string;
  }) => {
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

  domainEvents.on(DomainEvent.ASSIGNMENT_GRADED, (p: { studentPublicId: string }) => {
    notify(p.studentPublicId, NotificationType.ASSIGNMENT_GRADED, 'Assignment graded',
      'Your tutor has graded your submission.');
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

  domainEvents.on(DomainEvent.DEMO_REQUEST_CREATED, (p: {
    tutorUserPublicId: string; subject?: string;
  }) => {
    notify(p.tutorUserPublicId, NotificationType.DEMO_REQUESTED, 'New demo request',
      p.subject ? `A student wants a demo for ${p.subject}.` : 'A student sent you a demo request.');
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
