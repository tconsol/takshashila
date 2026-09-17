import { UserModel } from '../users/user.model';
import { NotificationModel } from './notification.model';
import { NotificationType, NotificationChannel } from './notification.types';
import { realtime } from '../realtime/realtime.service';
import { auditService } from '../audit/audit.service';
import { enqueueEmail } from '../../queues/email.queue';
import { logger } from '../../lib/logger';
import { ValidationError } from '../../utils/error';
import { Role, ROLES_LIST } from '../../constants/roles';
import { v4 as uuidv4 } from 'uuid';

/**
 * Platform announcements from an admin to whole audiences.
 *
 * Writes go out in batches rather than one document per `create()` call: a
 * broadcast to every student is thousands of rows, and doing that one insert
 * at a time would hold a request open for minutes.
 *
 * Realtime delivery uses ONE fan-out per role channel rather than per user.
 * Emitting per recipient would cost thousands of Pusher messages and blow the
 * daily quota with a single announcement.
 */

const BATCH_SIZE = 1_000;

export interface BroadcastDto {
  title: string;
  body: string;
  /** Empty means every role. */
  roles?: Role[];
  /** Also send as email. In-app is always written. */
  alsoEmail?: boolean;
}

export interface BroadcastActor {
  publicId: string;
  role: Role;
  ip?: string;
  userAgent?: string;
}

const invalid = (msg: string) => new ValidationError([msg], msg);

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function emailHtml(title: string, body: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px">
      <h2 style="margin:0 0 12px">${escape(title)}</h2>
      <div style="color:#444;line-height:1.6;white-space:pre-wrap">${escape(body)}</div>
    </div>
  `;
}

export class BroadcastService {
  /** How many people a broadcast would reach, so the sender can see before sending. */
  async estimateAudience(roles?: Role[]): Promise<{ total: number; byRole: { role: string; count: number }[] }> {
    const filter: Record<string, unknown> = { isDeleted: false, status: 'ACTIVE' };
    if (roles?.length) filter.role = { $in: roles };

    const byRole = await UserModel.aggregate([
      { $match: filter },
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    return {
      total: byRole.reduce((s, r: { count: number }) => s + r.count, 0),
      byRole: byRole.map((r: { _id: string; count: number }) => ({ role: r._id, count: r.count })),
    };
  }

  async send(dto: BroadcastDto, actor: BroadcastActor) {
    const title = dto.title?.trim();
    const body = dto.body?.trim();
    if (!title) throw invalid('A title is required');
    if (!body) throw invalid('A message is required');
    if (title.length > 120) throw invalid('Title must be 120 characters or fewer');
    if (body.length > 4000) throw invalid('Message must be 4000 characters or fewer');

    const roles = (dto.roles ?? []).filter((r) => ROLES_LIST.includes(r));
    if (dto.roles?.length && roles.length === 0) throw invalid('No valid roles selected');

    const filter: Record<string, unknown> = { isDeleted: false, status: 'ACTIVE' };
    if (roles.length) filter.role = { $in: roles };

    // Only the fields needed to address the message — never load whole users.
    const recipients = await UserModel.find(filter, { publicId: 1, email: 1, role: 1 }).lean();
    if (recipients.length === 0) throw invalid('That audience has no active users');

    const broadcastId = uuidv4();
    const now = new Date();

    let delivered = 0;
    for (const batch of chunk(recipients, BATCH_SIZE)) {
      await NotificationModel.insertMany(
        batch.map((user) => ({
          publicId: uuidv4(),
          recipientPublicId: user.publicId,
          type: NotificationType.SYSTEM,
          title,
          body,
          data: { broadcastId, sentBy: actor.publicId },
          channel: dto.alsoEmail ? NotificationChannel.BOTH : NotificationChannel.IN_APP,
          isRead: false,
          isDeleted: false,
          createdAt: now,
        })),
        { ordered: false },
      );
      delivered += batch.length;
    }

    // One realtime message per audience, not per person.
    const rooms = roles.length ? roles.map((r) => `role:${r}`) : ROLES_LIST.map((r) => `role:${r}`);
    await realtime.emit(rooms, 'notification:new', { type: NotificationType.SYSTEM, title, broadcastId });

    let emailsQueued = 0;
    if (dto.alsoEmail) {
      // Queued individually so one bad address cannot sink the rest, and so
      // delivery is retried by the worker rather than inside this request.
      for (const user of recipients) {
        if (!user.email || user.email.endsWith('@student.internal')) continue;
        try {
          await enqueueEmail({ to: user.email, subject: title, html: emailHtml(title, body) });
          emailsQueued += 1;
        } catch (error) {
          logger.warn('Could not queue broadcast email', {
            broadcastId,
            error: (error as Error).message,
          });
        }
      }
    }

    await auditService.log({
      actorId: actor.publicId,
      actorRole: actor.role,
      action: 'BROADCAST_SENT',
      resourceType: 'Broadcast',
      resourceId: broadcastId,
      ip: actor.ip,
      userAgent: actor.userAgent,
      after: { title, roles: roles.length ? roles : 'ALL', delivered, emailsQueued },
    });

    logger.info('Broadcast sent', { broadcastId, delivered, emailsQueued, by: actor.publicId });

    return { broadcastId, delivered, emailsQueued };
  }

  /** Past announcements, one row per broadcast rather than per recipient. */
  async history(limit = 25) {
    const rows = await NotificationModel.aggregate([
      { $match: { type: NotificationType.SYSTEM, 'data.broadcastId': { $exists: true } } },
      {
        $group: {
          _id: '$data.broadcastId',
          title: { $first: '$title' },
          body: { $first: '$body' },
          sentBy: { $first: '$data.sentBy' },
          channel: { $first: '$channel' },
          sentAt: { $first: '$createdAt' },
          recipients: { $sum: 1 },
          readCount: { $sum: { $cond: ['$isRead', 1, 0] } },
        },
      },
      { $sort: { sentAt: -1 } },
      { $limit: Math.min(limit, 100) },
    ]);

    const senderIds = [...new Set(rows.map((r: { sentBy?: string }) => r.sentBy).filter(Boolean))];
    const senders = await UserModel.find(
      { publicId: { $in: senderIds } },
      { publicId: 1, firstName: 1, lastName: 1 },
    ).lean();
    const nameById = new Map(senders.map((u) => [u.publicId, `${u.firstName} ${u.lastName}`.trim()]));

    return rows.map((r: {
      _id: string; title: string; body: string; sentBy?: string;
      channel: string; sentAt: Date; recipients: number; readCount: number;
    }) => ({
      broadcastId: r._id,
      title: r.title,
      body: r.body,
      channel: r.channel,
      sentAt: r.sentAt,
      sentByName: r.sentBy ? nameById.get(r.sentBy) ?? 'Unknown' : 'Unknown',
      recipients: r.recipients,
      readCount: r.readCount,
    }));
  }
}

export const broadcastService = new BroadcastService();