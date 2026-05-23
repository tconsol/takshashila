import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { NotificationType, NotificationChannel } from './notification.types';
import type { INotification } from './notification.types';

const notificationSchema = new Schema<INotification>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    recipientPublicId: { type: String, required: true, index: true },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    title: { type: String, required: true, maxlength: 255 },
    body: { type: String, required: true, maxlength: 1000 },
    data: { type: Schema.Types.Mixed },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
    channel: {
      type: String,
      enum: Object.values(NotificationChannel),
      default: NotificationChannel.IN_APP,
    },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret: Record<string, unknown>) => { delete ret.__v; return ret; } },
  },
);

notificationSchema.index({ recipientPublicId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipientPublicId: 1, createdAt: -1 });

export const NotificationModel = mongoose.model<INotification>('Notification', notificationSchema);

