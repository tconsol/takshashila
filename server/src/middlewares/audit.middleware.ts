import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../shared/types';
import { domainEvents } from '../events/event-emitter';
import { logger } from '../lib/logger';

export function auditMiddleware(action: string, resourceType: string) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (req.user) {
      logger.info('Audit trail', {
        action,
        resourceType,
        actorId: req.user.publicId,
        actorRole: req.user.role,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
      });
    }
    next();
  };
}

export function emitAuditEvent(
  actorId: string,
  actorRole: string,
  action: string,
  resourceType: string,
  resourceId: string,
  meta?: Record<string, unknown>,
) {
  domainEvents.emit('AUDIT', {
    actorId,
    actorRole,
    action,
    resourceType,
    resourceId,
    timestamp: new Date(),
    ...meta,
  });
}
