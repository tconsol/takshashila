import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { courseService } from './course.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';

export class CourseController {
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseService.create(req.user!.publicId, req.body);
      sendCreated(res, result, 'Course sent to tutor');
    } catch (error) { next(error); }
  }

  async getMine(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseService.getForStudent(req.user!.publicId, req.query as Record<string, string>);
      sendPaginated(res, result, 'Courses fetched');
    } catch (error) { next(error); }
  }

  async getProgress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseService.getProgress(req.params.coursePublicId, req.user!.publicId);
      sendSuccess(res, result, 'Curriculum progress fetched');
    } catch (error) { next(error); }
  }

  async getIncoming(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseService.getForTutor(req.user!.publicId, req.query as Record<string, string>);
      sendPaginated(res, result, 'Courses fetched');
    } catch (error) { next(error); }
  }

  async accept(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseService.accept(req.params.coursePublicId, req.user!.publicId, req.body);
      sendSuccess(res, result, 'Course accepted');
    } catch (error) { next(error); }
  }

  async reject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseService.reject(req.params.coursePublicId, req.user!.publicId, req.body);
      sendSuccess(res, result, 'Course rejected');
    } catch (error) { next(error); }
  }

  async scheduleClass(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseService.scheduleClass(req.params.coursePublicId, req.user!.publicId, req.body);
      sendCreated(res, result, 'Class scheduled');
    } catch (error) { next(error); }
  }

  async cancel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseService.cancel(req.params.coursePublicId, req.user!.publicId);
      sendSuccess(res, result, 'Course cancelled');
    } catch (error) { next(error); }
  }
}

export const courseController = new CourseController();
