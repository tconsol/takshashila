import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { demoRequestService } from './demo-request.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';

export class DemoRequestController {
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await demoRequestService.create(req.user!.publicId, req.body);
      sendCreated(res, result, 'Demo request submitted');
    } catch (error) { next(error); }
  }

  async getForTutor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await demoRequestService.getForTutor(req.user!.publicId, req.query as Record<string, string>);
      sendPaginated(res, result, 'Demo requests fetched');
    } catch (error) { next(error); }
  }

  async getForStudent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await demoRequestService.getForStudent(req.user!.publicId, req.query as Record<string, string>);
      sendPaginated(res, result, 'Demo requests fetched');
    } catch (error) { next(error); }
  }

  async accept(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await demoRequestService.accept(req.params.requestId, req.user!.publicId);
      sendSuccess(res, result, 'Demo request accepted – class created');
    } catch (error) { next(error); }
  }

  async reject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await demoRequestService.reject(req.params.requestId, req.user!.publicId, req.body);
      sendSuccess(res, result, 'Demo request rejected');
    } catch (error) { next(error); }
  }
}

export const demoRequestController = new DemoRequestController();
