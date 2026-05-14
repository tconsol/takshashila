import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../shared/types';
import { verifyAccessToken } from '../utils/token';
import { getRedisClient } from '../config/redis';
import { AuthenticationError } from '../utils/error';
import { userRepository } from '../modules/users/user.repository';
import { UserStatus } from '../modules/users/user.types';

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

    // Validate session in Redis
    try {
      const redis = getRedisClient();
      const session = await redis.get(`session:${payload.sessionId}`);
      if (!session) {
        throw new AuthenticationError('Session expired or revoked');
      }
    } catch (err) {
      if (err instanceof AuthenticationError) throw err;
      // Redis unavailable — fall through to DB check below
    }

    // Verify user still exists in DB and is not deleted/suspended
    const user = await userRepository.findByPublicId(payload.publicId);
    if (!user) {
      throw new AuthenticationError('Account not found');
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new AuthenticationError('Your account has been suspended');
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
