import type { Request, Response, NextFunction } from 'express';
import { isAppError } from '../utils/error';
import { sendError } from '../utils/response';
import { logger } from '../lib/logger';
import { env } from '../config/env';

interface MongoDuplicateKeyError extends Error {
  code?: number;
  keyPattern?: Record<string, unknown>;
}

function isDuplicateKeyError(err: Error): boolean {
  return (err as MongoDuplicateKeyError).code === 11000;
}

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (isAppError(err)) {
    if (err.statusCode >= 500) {
      logger.error('Operational error', {
        message: err.message,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
        stack: err.stack,
      });
    }
    sendError(res, err.message, err.statusCode, err.errors);
    return;
  }

  // A unique-index collision is a client-resolvable conflict, not a server
  // fault. Unmapped it surfaces as a bare 500 with no message in production,
  // which is unreadable for the caller and indistinguishable from a real crash.
  if (isDuplicateKeyError(err)) {
    const field = Object.keys((err as MongoDuplicateKeyError).keyPattern ?? {})[0];
    logger.warn('Duplicate key', { field, path: req.path, method: req.method });
    sendError(res, field ? `That ${field} is already in use` : 'That value is already in use', 409);
    return;
  }

  logger.error('Unexpected error', {
    message: err.message,
    path: req.path,
    method: req.method,
    stack: err.stack,
  });

  sendError(
    res,
    env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    500,
  );
}

export function notFoundMiddleware(req: Request, res: Response): void {
  sendError(res, `Route ${req.method} ${req.path} not found`, 404);
}
