import { v4 as uuidv4 } from 'uuid';
import { NotificationModel } from './notification.model';
import { NotificationChannel } from './notification.types';
import type { INotification, CreateNotificationDto } from './notification.types';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { logger } from '../../lib/logger';

export class NotificationService {
  async create(dto: CreateNotificationDto): Promise<INotification> {
    const notification = await NotificationModel.create({
      publicId: uuidv4(),
      recipientPublicId: dto.recipientPublicId,
      type: dto.type,
      title: dto.title,
      body: dto.body,
      data: dto.data,
      channel: dto.channel ?? NotificationChannel.IN_APP,
      isRead: false,
      isDeleted: false,
    });

    domainEvents.emit(DomainEvent.NOTIFICATION_SENT, {
      recipientPublicId: dto.recipientPublicId,
      notificationPublicId: notification.publicId,
      type: dto.type,
    });

    return notification.toObject();
  }

  async createBulk(dtos: CreateNotificationDto[]): Promise<void> {
    const docs = dtos.map((dto) => ({
      publicId: uuidv4(),
      recipientPublicId: dto.recipientPublicId,
      type: dto.type,
      title: dto.title,
      body: dto.body,
      data: dto.data,
      channel: dto.channel ?? NotificationChannel.IN_APP,
      isRead: false,
      isDeleted: false,
    }));
    await NotificationModel.insertMany(docs);
  }

  async getForUser(
    recipientPublicId: string,
    query: PaginationQuery & { unreadOnly?: string },
  ): Promise<PaginatedResult<INotification>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { recipientPublicId, isDeleted: false };
    if (query.unreadOnly === 'true') filter.isRead = false;

    const [items, total] = await Promise.all([
      NotificationModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      NotificationModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async getUnreadCount(recipientPublicId: string): Promise<number> {
    return NotificationModel.countDocuments({ recipientPublicId, isRead: false, isDeleted: false });
  }

  async markRead(publicId: string, recipientPublicId: string): Promise<void> {
    await NotificationModel.updateOne(
      { publicId, recipientPublicId, isDeleted: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
  }

  async markAllRead(recipientPublicId: string): Promise<void> {
    await NotificationModel.updateMany(
      { recipientPublicId, isRead: false, isDeleted: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
  }

  async deleteOne(publicId: string, recipientPublicId: string): Promise<void> {
    await NotificationModel.updateOne(
      { publicId, recipientPublicId },
      { $set: { isDeleted: true } },
    );
  }

  setupEventListeners(): void {
    // Auto-create notifications from domain events
    domainEvents.on(DomainEvent.CLASS_BOOKED, async (payload: { studentPublicId: string; tutorPublicId: string; classPublicId: string }) => {
      try {
        await this.createBulk([
          {
            recipientPublicId: payload.tutorPublicId,
            type: 'CLASS_BOOKED' as const,
            title: 'New Class Booked',
            body: 'A student has booked a class with you.',
            data: { classPublicId: payload.classPublicId },
          },
          {
            recipientPublicId: payload.studentPublicId,
            type: 'CLASS_BOOKED' as const,
            title: 'Class Confirmed',
            body: 'Your class has been booked successfully.',
            data: { classPublicId: payload.classPublicId },
          },
        ]);
      } catch (e) {
        logger.error('Failed to create CLASS_BOOKED notifications', { error: e });
      }
    });

    domainEvents.on(DomainEvent.CLASS_CANCELLED, async (payload: { studentPublicId: string; tutorPublicId: string; classPublicId: string }) => {
      try {
        await this.createBulk([
          {
            recipientPublicId: payload.studentPublicId,
            type: 'CLASS_CANCELLED' as const,
            title: 'Class Cancelled',
            body: 'A class has been cancelled. Your wallet has been refunded.',
            data: { classPublicId: payload.classPublicId },
          },
          {
            recipientPublicId: payload.tutorPublicId,
            type: 'CLASS_CANCELLED' as const,
            title: 'Class Cancelled',
            body: 'A class has been cancelled.',
            data: { classPublicId: payload.classPublicId },
          },
        ]);
      } catch (e) {
        logger.error('Failed to create CLASS_CANCELLED notifications', { error: e });
      }
    });

    domainEvents.on(DomainEvent.STUDENT_APPROVED, async (payload: { studentPublicId: string }) => {
      try {
        await this.create({
          recipientPublicId: payload.studentPublicId,
          type: 'STUDENT_APPROVED' as const,
          title: 'Account Approved',
          body: 'Your student account has been approved. Demo credits have been added to your wallet!',
        });
      } catch (e) {
        logger.error('Failed to create STUDENT_APPROVED notification', { error: e });
      }
    });

    domainEvents.on(DomainEvent.ASSIGNMENT_SUBMITTED, async (payload: { assignmentPublicId: string; studentPublicId: string }) => {
      try {
        await this.create({
          recipientPublicId: payload.studentPublicId,
          type: 'ASSIGNMENT_PUBLISHED' as const,
          title: 'Assignment Submitted',
          body: 'Your assignment has been submitted successfully.',
          data: { assignmentPublicId: payload.assignmentPublicId },
        });
      } catch (e) {
        logger.error('Failed to create ASSIGNMENT_SUBMITTED notification', { error: e });
      }
    });
  }
}

export const notificationService = new NotificationService();
