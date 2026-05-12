export interface INotification {
  publicId: string;
  recipientPublicId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  channel: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}
