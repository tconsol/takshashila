import type { Request, Response, NextFunction } from 'express';
import { isAppError } from '../utils/error';
import { sendError } from '../utils/response';
import { logger } from '../lib/logger';
import { env } from '../config/env';

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
