import type { Response } from 'express';
import type { ApiSuccessResponse, ApiErrorResponse, PaginatedResult } from '../shared/types';

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
): Response<ApiSuccessResponse<T>> {
  return res.status(statusCode).json({ success: true, message, data });
}

export function sendCreated<T>(
  res: Response,
  data: T,
  message = 'Created successfully',
): Response<ApiSuccessResponse<T>> {
  return sendSuccess(res, data, message, 201);
}

export function sendPaginated<T>(
  res: Response,
  result: PaginatedResult<T>,
  message = 'Success',
): Response {
  // Nest under `data` so the response shape matches sendSuccess —
  // frontend can always read body.data.items
  return res.status(200).json({ success: true, message, data: result });
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  errors?: Record<string, string[]> | string[],
): Response<ApiErrorResponse> {
  return res.status(statusCode).json({ success: false, message, ...(errors ? { errors } : {}) });
}

export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}
