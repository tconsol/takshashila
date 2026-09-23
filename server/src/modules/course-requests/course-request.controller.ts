import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { courseRequestService } from './course-request.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';

export class CourseRequestController {
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseRequestService.create(req.user!.publicId, req.body);
      sendCreated(res, result, 'Course request submitted');
    } catch (error) { next(error); }
  }

  async getMine(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseRequestService.getForStudent(req.user!.publicId, req.query as Record<string, string>);
      sendPaginated(res, result, 'Course requests fetched');
    } catch (error) { next(error); }
  }

  async getIncoming(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseRequestService.getForTutor(req.user!.publicId, req.query as Record<string, string>);
      sendPaginated(res, result, 'Course requests fetched');
    } catch (error) { next(error); }
  }

  async accept(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseRequestService.accept(req.params.requestPublicId, req.user!.publicId, req.body);
      sendSuccess(res, result, 'Course request accepted');
    } catch (error) { next(error); }
  }

  async reject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseRequestService.reject(req.params.requestPublicId, req.user!.publicId, req.body);
      sendSuccess(res, result, 'Course request rejected');
    } catch (error) { next(error); }
  }

  async scheduleClass(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseRequestService.scheduleClass(req.params.requestPublicId, req.user!.publicId, req.body);
      sendCreated(res, result, 'Class scheduled');
    } catch (error) { next(error); }
  }

  async cancel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseRequestService.cancel(req.params.requestPublicId, req.user!.publicId);
      sendSuccess(res, result, 'Course request cancelled');
    } catch (error) { next(error); }
  }
}

export const courseRequestController = new CourseRequestController();
