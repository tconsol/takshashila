import { v4 as uuidv4 } from 'uuid';
import { NotificationModel } from './notification.model';
import { NotificationChannel } from './notification.types';
import type { INotification, CreateNotificationDto } from './notification.types';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { logger } from '../../lib/logger';
import { enqueueEmail } from '../../queues/email.queue';
import { env } from '../../config/env';
import { UserModel } from '../users/user.model';

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
    domainEvents.on(DomainEvent.USER_REGISTERED, async (payload: { userId: string; email: string; role: string; verificationToken: string; isInvite?: boolean; firstName?: string; lastName?: string }) => {
      try {
        if (payload.isInvite) {
          const inviteUrl = `${env.FRONTEND_URL}/accept-invite?token=${payload.verificationToken}&email=${encodeURIComponent(payload.email)}&firstName=${encodeURIComponent(payload.firstName ?? '')}&lastName=${encodeURIComponent(payload.lastName ?? '')}`;
          await enqueueEmail({
            to: payload.email,
            subject: "You've been invited to Takshashila!",
            html: `
              <div style="font-family:sans-serif;max-width:520px;margin:auto">
                <h2 style="color:#4f46e5">You're invited!</h2>
                <p>Hi ${payload.firstName ?? ''},</p>
                <p>You have been invited to join Takshashila as a <strong>${payload.role.toLowerCase()}</strong>. Click the button below to set your password and activate your account.</p>
                <a href="${inviteUrl}"
                   style="display:inline-block;margin:16px 0;padding:12px 28px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
                  Accept Invitation
                </a>
                <p style="color:#6b7280;font-size:13px">Or copy this link: <a href="${inviteUrl}">${inviteUrl}</a></p>
                <p style="color:#6b7280;font-size:13px">This invite link expires in 7 days.</p>
              </div>
            `,
            text: `You're invited to Takshashila. Accept your invitation: ${inviteUrl}`,
          });
        } else {
          const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${payload.verificationToken}`;
          await enqueueEmail({
            to: payload.email,
            subject: 'Verify your Takshashila account',
            html: `
              <div style="font-family:sans-serif;max-width:520px;margin:auto">
                <h2 style="color:#4f46e5">Welcome to Takshashila!</h2>
                <p>Thanks for signing up. Please click the button below to verify your email address.</p>
                <a href="${verifyUrl}"
                   style="display:inline-block;margin:16px 0;padding:12px 28px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
                  Verify Email
                </a>
                <p style="color:#6b7280;font-size:13px">Or copy this link: <a href="${verifyUrl}">${verifyUrl}</a></p>
                <p style="color:#6b7280;font-size:13px">This link expires in 24 hours. If you did not sign up, you can ignore this email.</p>
              </div>
            `,
            text: `Verify your email: ${verifyUrl}`,
          });
        }
      } catch (e) {
        logger.error('Failed to send verification/invite email', { error: e });
      }
    });

    domainEvents.on(DomainEvent.USER_PASSWORD_RESET, async (payload: { userId: string; email: string; resetToken: string }) => {
      try {
        const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${payload.resetToken}`;
        await enqueueEmail({
          to: payload.email,
          subject: 'Reset your Takshashila password',
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:auto">
              <h2 style="color:#4f46e5">Password Reset Request</h2>
              <p>We received a request to reset your password. Click the button below to proceed.</p>
              <a href="${resetUrl}"
                 style="display:inline-block;margin:16px 0;padding:12px 28px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
                Reset Password
              </a>
              <p style="color:#6b7280;font-size:13px">Or copy this link: <a href="${resetUrl}">${resetUrl}</a></p>
              <p style="color:#6b7280;font-size:13px">This link expires in 1 hour. If you did not request a reset, ignore this email.</p>
            </div>
          `,
          text: `Reset your password: ${resetUrl}`,
        });
      } catch (e) {
        logger.error('Failed to send password reset email', { error: e });
      }
    });

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

    domainEvents.on(DomainEvent.JOIN_REQUEST_SENT, async (payload: {
      requestPublicId: string;
      tutorUserPublicId: string;
      principalUserPublicId: string;
      initiatedBy: 'TUTOR' | 'PRINCIPAL';
    }) => {
      try {
        if (payload.initiatedBy === 'TUTOR') {
          // Notify principal: a tutor wants to join
          const tutor = await UserModel.findOne({ publicId: payload.tutorUserPublicId }, { firstName: 1, lastName: 1, email: 1 }).lean();
          const principal = await UserModel.findOne({ publicId: payload.principalUserPublicId }, { email: 1, firstName: 1 }).lean();
          if (!tutor || !principal) return;

          await this.create({
            recipientPublicId: payload.principalUserPublicId,
            type: 'CLASS_BOOKED' as const,
            title: 'New Join Request',
            body: `${tutor.firstName} ${tutor.lastName} has requested to join your institution.`,
            data: { requestPublicId: payload.requestPublicId },
          });

          await enqueueEmail({
            to: principal.email,
            subject: `${tutor.firstName} ${tutor.lastName} wants to join your institution`,
            html: `
              <div style="font-family:sans-serif;max-width:520px;margin:auto">
                <h2 style="color:#4f46e5">New Join Request</h2>
                <p>Hi ${principal.firstName},</p>
                <p><strong>${tutor.firstName} ${tutor.lastName}</strong> (${tutor.email}) has sent a request to join your institution on Takshashila.</p>
                <p>Log in to review and approve or reject this request.</p>
                <a href="${env.FRONTEND_URL}/dashboard/principal/tutors"
                   style="display:inline-block;margin:16px 0;padding:12px 28px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
                  Review Request
                </a>
              </div>
            `,
            text: `${tutor.firstName} ${tutor.lastName} has requested to join your institution. Review it at ${env.FRONTEND_URL}/dashboard/principal/tutors`,
          });
        } else {
          // Notify tutor: a principal wants to add them
          const principal = await UserModel.findOne({ publicId: payload.principalUserPublicId }, { firstName: 1, lastName: 1, email: 1 }).lean();
          const tutor = await UserModel.findOne({ publicId: payload.tutorUserPublicId }, { email: 1, firstName: 1 }).lean();
          if (!principal || !tutor) return;

          await this.create({
            recipientPublicId: payload.tutorUserPublicId,
            type: 'CLASS_BOOKED' as const,
            title: 'Institution Invitation',
            body: `${principal.firstName} ${principal.lastName} has invited you to join their institution.`,
            data: { requestPublicId: payload.requestPublicId },
          });

          await enqueueEmail({
            to: tutor.email,
            subject: `${principal.firstName} ${principal.lastName} wants you to join their institution`,
            html: `
              <div style="font-family:sans-serif;max-width:520px;margin:auto">
                <h2 style="color:#4f46e5">Institution Invitation</h2>
                <p>Hi ${tutor.firstName},</p>
                <p><strong>${principal.firstName} ${principal.lastName}</strong> has invited you to join their institution on Takshashila.</p>
                <p>Log in to accept or decline this invitation.</p>
                <a href="${env.FRONTEND_URL}/dashboard/tutor/principals"
                   style="display:inline-block;margin:16px 0;padding:12px 28px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
                  View Invitation
                </a>
              </div>
            `,
            text: `${principal.firstName} ${principal.lastName} has invited you to join their institution. View it at ${env.FRONTEND_URL}/dashboard/tutor/principals`,
          });
        }
      } catch (e) {
        logger.error('Failed to send JOIN_REQUEST_SENT notification', { error: e });
      }
    });

    domainEvents.on(DomainEvent.JOIN_REQUEST_APPROVED, async (payload: {
      requestPublicId: string;
      tutorUserPublicId: string;
      principalUserPublicId: string;
    }) => {
      try {
        const tutor = await UserModel.findOne({ publicId: payload.tutorUserPublicId }, { email: 1, firstName: 1 }).lean();
        const principal = await UserModel.findOne({ publicId: payload.principalUserPublicId }, { firstName: 1, lastName: 1, email: 1 }).lean();
        if (!tutor || !principal) return;

        // Notify tutor their request was approved
        await this.create({
          recipientPublicId: payload.tutorUserPublicId,
          type: 'STUDENT_APPROVED' as const,
          title: 'Join Request Approved',
          body: `Your request to join ${principal.firstName} ${principal.lastName}'s institution has been approved.`,
          data: { requestPublicId: payload.requestPublicId },
        });

        await enqueueEmail({
          to: tutor.email,
          subject: 'Your join request has been approved!',
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:auto">
              <h2 style="color:#22c55e">Request Approved!</h2>
              <p>Hi ${tutor.firstName},</p>
              <p>Great news! <strong>${principal.firstName} ${principal.lastName}</strong> has approved your request to join their institution.</p>
              <p>Your profile is now under review. You will be notified once approved to start teaching.</p>
              <a href="${env.FRONTEND_URL}/dashboard/tutor"
                 style="display:inline-block;margin:16px 0;padding:12px 28px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
                Go to Dashboard
              </a>
            </div>
          `,
          text: `Your join request to ${principal.firstName} ${principal.lastName}'s institution has been approved. Visit ${env.FRONTEND_URL}/dashboard/tutor`,
        });

        // Also notify the principal (if they were the receiver)
        await this.create({
          recipientPublicId: payload.principalUserPublicId,
          type: 'CLASS_BOOKED' as const,
          title: 'Tutor Joined',
          body: `${tutor.firstName} ${tutor.lastName} has joined your institution and is under review.`,
          data: { requestPublicId: payload.requestPublicId },
        });
      } catch (e) {
        logger.error('Failed to send JOIN_REQUEST_APPROVED notification', { error: e });
      }
    });

    domainEvents.on(DomainEvent.JOIN_REQUEST_REJECTED, async (payload: {
      requestPublicId: string;
      tutorUserPublicId: string;
      principalUserPublicId: string;
    }) => {
      try {
        const tutor = await UserModel.findOne({ publicId: payload.tutorUserPublicId }, { email: 1, firstName: 1 }).lean();
        const principal = await UserModel.findOne({ publicId: payload.principalUserPublicId }, { firstName: 1, lastName: 1 }).lean();
        if (!tutor || !principal) return;

        await this.create({
          recipientPublicId: payload.tutorUserPublicId,
          type: 'CLASS_BOOKED' as const,
          title: 'Join Request Declined',
          body: `Your request to join ${principal.firstName} ${principal.lastName}'s institution was not accepted.`,
          data: { requestPublicId: payload.requestPublicId },
        });

        await enqueueEmail({
          to: tutor.email,
          subject: 'Update on your institution join request',
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:auto">
              <h2 style="color:#4f46e5">Join Request Update</h2>
              <p>Hi ${tutor.firstName},</p>
              <p>Your request to join <strong>${principal.firstName} ${principal.lastName}</strong>'s institution was not accepted at this time.</p>
              <p>You can browse other institutions and send a new request.</p>
              <a href="${env.FRONTEND_URL}/dashboard/tutor/principals"
                 style="display:inline-block;margin:16px 0;padding:12px 28px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
                Browse Institutions
              </a>
            </div>
          `,
          text: `Your join request to ${principal.firstName} ${principal.lastName}'s institution was not accepted. Browse other institutions at ${env.FRONTEND_URL}/dashboard/tutor/principals`,
        });
      } catch (e) {
        logger.error('Failed to send JOIN_REQUEST_REJECTED notification', { error: e });
      }
    });

    domainEvents.on(DomainEvent.PRINCIPAL_APPROVED, async (payload: { principalPublicId: string; userPublicId: string; approvedBy: string }) => {
      try {
        const user = await UserModel.findOne({ publicId: payload.userPublicId }, { email: 1, firstName: 1 }).lean();
        if (!user) return;

        const loginUrl = `${env.FRONTEND_URL}/login`;

        await enqueueEmail({
          to: user.email,
          subject: 'Your Takshashila account has been approved!',
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:auto">
              <h2 style="color:#4f46e5">Account Approved!</h2>
              <p>Hi ${user.firstName},</p>
              <p>Great news! Your principal account on Takshashila has been reviewed and <strong>approved</strong> by our team.</p>
              <p>You can now log in and start managing your institution.</p>
              <a href="${loginUrl}"
                 style="display:inline-block;margin:16px 0;padding:12px 28px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
                Log In Now
              </a>
              <p style="color:#6b7280;font-size:13px">Or copy this link: <a href="${loginUrl}">${loginUrl}</a></p>
              <p style="color:#6b7280;font-size:13px">If you have any questions, please contact our support team.</p>
            </div>
          `,
          text: `Hi ${user.firstName}, your Takshashila principal account has been approved. Log in at: ${loginUrl}`,
        });

        await this.create({
          recipientPublicId: payload.userPublicId,
          type: 'STUDENT_APPROVED' as const,
          title: 'Account Approved',
          body: 'Your principal account has been approved by our team. You can now log in.',
        });
      } catch (e) {
        logger.error('Failed to send PRINCIPAL_APPROVED notification', { error: e });
      }
    });
  }
}

export const notificationService = new NotificationService();
