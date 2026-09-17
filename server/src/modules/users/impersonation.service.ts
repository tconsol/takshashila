import { getRedisClient } from '../../config/redis';
import { userRepository } from './user.repository';
import { auditService } from '../audit/audit.service';
import { logger } from '../../lib/logger';
import { AuthorizationError, NotFoundError, ValidationError } from '../../utils/error';
import { Role, ROLE_HIERARCHY } from '../../constants/roles';
import { UserStatus } from './user.types';
import {
  generateAccessToken,
  generateSessionId,
  buildTokenPayload,
} from '../../utils/token';

/**
 * "Sign in as this user" for support and debugging.
 *
 * This is the single most dangerous capability in the product, so it is
 * deliberately constrained:
 *
 *   • super admin only — never delegated to ADMIN
 *   • never onto another super admin, and never onto yourself
 *   • short-lived: a 30-minute access token and no refresh token, so a session
 *     cannot be silently extended or revived after the window closes
 *   • every start and stop is written to the audit log with both identities
 *   • the session is tagged in Redis, so the impersonated session is
 *     distinguishable from a real login and can be revoked on its own
 *
 * No refresh token is issued on purpose: the whole point is that the access
 * cannot outlive the support task.
 */

const IMPERSONATION_TTL_SECONDS = 30 * 60;

const invalid = (msg: string) => new ValidationError([msg], msg);

export interface ImpersonationActor {
  publicId: string;
  role: Role;
  ip?: string;
  userAgent?: string;
}

export class ImpersonationService {
  async start(targetPublicId: string, actor: ImpersonationActor, reason?: string) {
    if (actor.role !== Role.SUPER_ADMIN) {
      throw new AuthorizationError('Only a super admin can impersonate a user');
    }
    if (targetPublicId === actor.publicId) {
      throw invalid('You are already signed in as yourself');
    }

    const target = await userRepository.findByPublicId(targetPublicId);
    if (!target) throw new NotFoundError('User');

    // Impersonating a peer would let one super admin act as another with no
    // way to tell the two apart afterwards.
    if (ROLE_HIERARCHY[target.role] >= ROLE_HIERARCHY[Role.SUPER_ADMIN]) {
      throw new AuthorizationError('Cannot impersonate another super admin');
    }
    if (target.status === UserStatus.SUSPENDED) {
      throw invalid('That account is suspended — reactivate it first');
    }

    const sessionId = generateSessionId();
    const payload = buildTokenPayload(
      target._id.toString(),
      target.publicId,
      target.role,
      sessionId,
    );
    const accessToken = generateAccessToken(payload);

    // Tagged so the session list can show it, and so it can be revoked without
    // touching the target's own genuine sessions.
    const redis = getRedisClient();
    await redis.setex(
      `session:${sessionId}`,
      IMPERSONATION_TTL_SECONDS,
      JSON.stringify({
        userId: target.publicId,
        role: target.role,
        impersonated: true,
        impersonatedBy: actor.publicId,
        ip: actor.ip,
        userAgent: actor.userAgent,
        createdAt: new Date().toISOString(),
      }),
    );

    await auditService.log({
      actorId: actor.publicId,
      actorRole: actor.role,
      action: 'IMPERSONATION_STARTED',
      resourceType: 'User',
      resourceId: target.publicId,
      ip: actor.ip,
      userAgent: actor.userAgent,
      after: {
        targetEmail: target.email,
        targetRole: target.role,
        sessionId,
        expiresInSeconds: IMPERSONATION_TTL_SECONDS,
        reason,
      },
    });

    logger.warn('Impersonation started', {
      by: actor.publicId,
      target: target.publicId,
      targetRole: target.role,
      sessionId,
    });

    return {
      accessToken,
      expiresInSeconds: IMPERSONATION_TTL_SECONDS,
      sessionId,
      user: {
        publicId: target.publicId,
        firstName: target.firstName,
        lastName: target.lastName,
        email: target.email,
        role: target.role,
      },
    };
  }

  /** Ends an impersonated session immediately rather than waiting for the TTL. */
  async stop(sessionId: string, actor: { publicId: string; role: Role; ip?: string; userAgent?: string }) {
    const redis = getRedisClient();
    const raw = await redis.get(`session:${sessionId}`);
    if (!raw) return;

    let session: { impersonated?: boolean; impersonatedBy?: string; userId?: string } = {};
    try {
      session = JSON.parse(raw);
    } catch {
      // A malformed session is still worth deleting.
    }

    if (!session.impersonated) {
      throw invalid('That session is not an impersonation session');
    }

    await redis.del(`session:${sessionId}`);

    await auditService.log({
      actorId: session.impersonatedBy ?? actor.publicId,
      actorRole: Role.SUPER_ADMIN,
      action: 'IMPERSONATION_ENDED',
      resourceType: 'User',
      resourceId: session.userId ?? 'unknown',
      ip: actor.ip,
      userAgent: actor.userAgent,
      after: { sessionId },
    });

    logger.warn('Impersonation ended', { sessionId, target: session.userId });
  }
}

export const impersonationService = new ImpersonationService();
