import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../shared/types';
import type { Role } from '../constants/roles';
import type { Permission } from '../constants/permissions';
import { hasPermission, hasAnyPermission } from '../constants/permissions';
import { AuthorizationError, AuthenticationError } from '../utils/error';

export function requireRole(...allowedRoles: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AuthorizationError(`Role '${req.user.role}' is not permitted`));
    }
    next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError());
    }
    if (!hasPermission(req.user.role, permission)) {
      return next(new AuthorizationError(`Missing permission: ${permission}`));
    }
    next();
  };
}

export function requireAnyPermission(...permissions: Permission[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError());
    }
    if (!hasAnyPermission(req.user.role, permissions)) {
      return next(
        new AuthorizationError(`Missing one of: ${permissions.join(', ')}`),
      );
    }
    next();
  };
}

export function requireSelf(paramField = 'userId') {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError());
    }
    const targetId = req.params[paramField];
    if (req.user.publicId !== targetId && req.user.role !== 'SUPER_ADMIN') {
      return next(new AuthorizationError('Cannot access another user\'s resource'));
    }
    next();
  };
}
