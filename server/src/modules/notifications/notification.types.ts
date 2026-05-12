export const NotificationType = {
  CLASS_BOOKED: 'CLASS_BOOKED',
  CLASS_STARTED: 'CLASS_STARTED',
  CLASS_COMPLETED: 'CLASS_COMPLETED',
  CLASS_CANCELLED: 'CLASS_CANCELLED',
  CLASS_REMINDER: 'CLASS_REMINDER',
  ASSIGNMENT_PUBLISHED: 'ASSIGNMENT_PUBLISHED',
  ASSIGNMENT_GRADED: 'ASSIGNMENT_GRADED',
  ASSIGNMENT_DUE_SOON: 'ASSIGNMENT_DUE_SOON',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  WALLET_CREDITED: 'WALLET_CREDITED',
  WALLET_DEBITED: 'WALLET_DEBITED',
  STUDENT_APPROVED: 'STUDENT_APPROVED',
  TUTOR_APPROVED: 'TUTOR_APPROVED',
  PRINCIPAL_APPROVED: 'PRINCIPAL_APPROVED',
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
