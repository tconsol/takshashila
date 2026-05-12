import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../shared/types';
import { verifyAccessToken } from '../utils/token';
import { getRedisClient } from '../config/redis';
import { AuthenticationError } from '../utils/error';

export async function authMiddleware(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      throw new AuthenticationError('No access token provided');
    }

    const payload = verifyAccessToken(token);

    const redis = getRedisClient();
    const sessionKey = `session:${payload.sessionId}`;
    const session = await redis.get(sessionKey);

    if (!session) {
      throw new AuthenticationError('Session expired or revoked');
    }

    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return next(error);
    }
    next(new AuthenticationError('Invalid or expired access token'));
  }
}

function extractBearerToken(req: AuthRequest): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

export const requireAuth = authMiddleware;

export function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void {
  const token = extractBearerToken(req);
  if (!token) return next();

  try {
    req.user = verifyAccessToken(token);
  } catch {
    // non-blocking proceed without user
  }
  next();
}
