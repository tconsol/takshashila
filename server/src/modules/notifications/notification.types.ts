export const NotificationType = {
  CLASS_BOOKED: 'CLASS_BOOKED',
  CLASS_STARTED: 'CLASS_STARTED',
  CLASS_COMPLETED: 'CLASS_COMPLETED',
  CLASS_CANCELLED: 'CLASS_CANCELLED',
  CLASS_REMINDER: 'CLASS_REMINDER',
  CLASS_RESCHEDULED: 'CLASS_RESCHEDULED',
  ASSIGNMENT_PUBLISHED: 'ASSIGNMENT_PUBLISHED',
  ASSIGNMENT_SUBMITTED: 'ASSIGNMENT_SUBMITTED',
  ASSIGNMENT_GRADED: 'ASSIGNMENT_GRADED',
  ASSIGNMENT_DUE_SOON: 'ASSIGNMENT_DUE_SOON',
  ATTENDANCE_MARKED: 'ATTENDANCE_MARKED',
  DEMO_REQUESTED: 'DEMO_REQUESTED',
  DEMO_ACCEPTED: 'DEMO_ACCEPTED',
  DEMO_REJECTED: 'DEMO_REJECTED',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  WALLET_CREDITED: 'WALLET_CREDITED',
  WALLET_DEBITED: 'WALLET_DEBITED',
  PAYOUT_REQUESTED: 'PAYOUT_REQUESTED',
  PAYOUT_APPROVED: 'PAYOUT_APPROVED',
  PAYOUT_REJECTED: 'PAYOUT_REJECTED',
  STUDENT_APPROVED: 'STUDENT_APPROVED',
  TUTOR_APPROVED: 'TUTOR_APPROVED',
  PRINCIPAL_APPROVED: 'PRINCIPAL_APPROVED',
  JOIN_REQUEST_SENT: 'JOIN_REQUEST_SENT',
  JOIN_REQUEST_APPROVED: 'JOIN_REQUEST_APPROVED',
  JOIN_REQUEST_REJECTED: 'JOIN_REQUEST_REJECTED',
  TUTOR_LEFT_ORGANIZATION: 'TUTOR_LEFT_ORGANIZATION',
  SUPPORT_TICKET_UPDATED: 'SUPPORT_TICKET_UPDATED',
  SYSTEM: 'SYSTEM',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const NotificationChannel = {
  IN_APP: 'IN_APP',
  EMAIL: 'EMAIL',
  BOTH: 'BOTH',
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export interface INotification {
  _id: string;
  publicId: string;
  recipientPublicId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date;
  channel: NotificationChannel;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationDto {
  recipientPublicId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channel?: NotificationChannel;
}
