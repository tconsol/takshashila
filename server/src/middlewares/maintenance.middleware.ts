import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../shared/types';
import { settingsService } from '../modules/settings/settings.service';
import { verifyAccessToken } from '../utils/token';
import { Role } from '../constants/roles';

/**
 * Paths that stay reachable while maintenance mode is on. Admins must be able to
 * sign in and switch it back off, and health checks must keep answering or the
 * platform looks dead to whatever is watching it.
 */
const ALWAYS_ALLOWED = [
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/settings/platform',
  '/system/health',
  '/users/me',
];

/**
 * Read-only traffic is left alone during maintenance; only writes are held back.
 * That keeps dashboards legible while stopping new state from being created.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function maintenanceMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (SAFE_METHODS.has(req.method)) { next(); return; }
    if (ALWAYS_ALLOWED.some((p) => req.path.startsWith(p))) { next(); return; }

    const { maintenanceMode, maintenanceMessage } = await settingsService.get();
    if (!maintenanceMode) { next(); return; }

    // This runs ahead of the routers, so `req.user` is not populated yet — read the
    // role straight off the bearer token. Authentication proper still happens later;
    // this only decides whether to let the request reach it.
    if (isAdminToken(req)) { next(); return; }

    res.status(503).json({
      success: false,
      message: maintenanceMessage,
      maintenance: true,
    });
  } catch {
    // Settings unreachable is not a reason to take writes down.
    next();
  }
}

/** Admins keep working during maintenance — they are the ones fixing it. */
function isAdminToken(req: AuthRequest): boolean {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return false;
  try {
    const payload = verifyAccessToken(header.slice(7));
    return payload.role === Role.SUPER_ADMIN || payload.role === Role.ADMIN;
  } catch {
    return false;
  }
}
