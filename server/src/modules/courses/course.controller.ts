import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { courseService } from './course.service';
import { sendSuccess, sendCreated } from '../../utils/response';
import { NotFoundError, ValidationError } from '../../utils/error';
import { studentCatalogQuerySchema } from './course.validators';

export class CourseController {
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseService.create(req.user!.publicId, req.body);
      sendCreated(res, result, 'Course created');
    } catch (error) { next(error); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseService.update(req.params.coursePublicId, req.body);
      sendSuccess(res, result, 'Course updated');
    } catch (error) { next(error); }
  }

  async publish(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseService.setPublished(req.params.coursePublicId, true);
      sendSuccess(res, result, 'Course published');
    } catch (error) { next(error); }
  }

  async unpublish(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseService.setPublished(req.params.coursePublicId, false);
      sendSuccess(res, result, 'Course unpublished');
    } catch (error) { next(error); }
  }

  async remove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await courseService.softDelete(req.params.coursePublicId);
      sendSuccess(res, null, 'Course deleted');
    } catch (error) { next(error); }
  }

  async getByPublicId(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await courseService.getByPublicId(req.params.coursePublicId);
      const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';
      if (!isAdmin && !result.isPublished) {
        // Don't reveal that an unpublished course exists at this id.
        throw new NotFoundError('Course');
      }
      sendSuccess(res, result, 'Course fetched');
    } catch (error) { next(error); }
  }

  /** Admin/SuperAdmin management listing vs. the Student-facing published catalog. */
  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';
      if (isAdmin) {
        const result = await courseService.listForAdmin(req.query as never);
        sendSuccess(res, result, 'Courses fetched');
      } else {
        const parsed = studentCatalogQuerySchema.safeParse(req.query);
        if (!parsed.success) {
          throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
        }
        const result = await courseService.listCatalog(parsed.data);
        sendSuccess(res, result, 'Courses fetched');
      }
    } catch (error) { next(error); }
  }
}

export const courseController = new CourseController();
