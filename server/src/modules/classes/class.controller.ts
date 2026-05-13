import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { classService } from './class.service';
import { tutorService } from '../tutors/tutor.service';
import { studentService } from '../students/student.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';
import { NotFoundError } from '../../utils/error';

function parseClassFilters(query: Record<string, unknown>) {
  return {
    status: query.status as string | undefined,
    from: query.from ? new Date(query.from as string) : undefined,
    to: query.to ? new Date(query.to as string) : undefined,
  };
}

export class ClassController {
  async bookClass(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cls = await classService.bookClass(req.user!.publicId, req.body);
      sendCreated(res, cls, 'Class booked successfully');
    } catch (error) { next(error); }
  }

  async startClass(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cls = await classService.startClass(req.params.classId, req.user!.publicId);
      sendSuccess(res, cls, 'Class started');
    } catch (error) { next(error); }
  }

  async completeClass(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cls = await classService.completeClass(req.params.classId, req.user!.publicId);
      sendSuccess(res, cls, 'Class completed');
    } catch (error) { next(error); }
  }

  async cancelClass(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cls = await classService.cancelClass(req.params.classId, req.user!.publicId, req.body);
      sendSuccess(res, cls, 'Class cancelled');
    } catch (error) { next(error); }
  }

  async setMeetingUrl(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cls = await classService.setMeetingUrl(req.params.classId, req.body);
      sendSuccess(res, cls, 'Meeting URL set');
    } catch (error) { next(error); }
  }

  async getLiveClassesAsPrincipal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await classService.getLiveClassesForPrincipal(req.user!.publicId, req.query);
      sendPaginated(res, result, 'Live classes fetched');
    } catch (error) { next(error); }
  }

  async getMyClassesAsTutor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tutorProfile = await tutorService.getByUserPublicId(req.user!.publicId);
      const result = await classService.getClassesByTutor(
        tutorProfile.publicId,
        parseClassFilters(req.query as Record<string, unknown>),
        req.query,
      );
      sendPaginated(res, result, 'Classes fetched');
    } catch (error) { next(error); }
  }

  async getMyClassesAsStudent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      let studentProfile;
      try {
        studentProfile = await studentService.getByUserPublicId(req.user!.publicId);
      } catch (err) {
        if (err instanceof NotFoundError) {
          sendPaginated(res, { items: [], total: 0, page: 1, limit: 20, totalPages: 0 }, 'Classes fetched');
          return;
        }
        throw err;
      }
      const result = await classService.getClassesByStudent(
        studentProfile.publicId,
        parseClassFilters(req.query as Record<string, unknown>),
        req.query,
      );
      sendPaginated(res, result, 'Classes fetched');
    } catch (error) { next(error); }
  }

  async getByPublicId(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cls = await classService.getByPublicId(req.params.classId);
      sendSuccess(res, cls, 'Class fetched');
    } catch (error) { next(error); }
  }

  async saveRecording(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cls = await classService.saveRecording(req.params.classId, req.user!.publicId, req.body);
      sendSuccess(res, cls, 'Recording saved');
    } catch (error) { next(error); }
  }
}

export const classController = new ClassController();
