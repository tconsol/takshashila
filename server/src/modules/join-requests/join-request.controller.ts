import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { joinRequestService } from './join-request.service';
import { sendSuccess } from '../../utils/response';

export class JoinRequestController {
  async createTutorRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { principalProfilePublicId, message } = req.body;
      const request = await joinRequestService.createTutorRequest(
        req.user!.publicId,
        principalProfilePublicId,
        message,
      );
      sendSuccess(res, request, 'Join request sent', 201);
    } catch (e) { next(e); }
  }

  async createPrincipalRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, message } = req.body;
      const request = await joinRequestService.createPrincipalRequest(
        req.user!.publicId,
        query,
        message,
      );
      sendSuccess(res, request, 'Request sent to tutor', 201);
    } catch (e) { next(e); }
  }

  async approveRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await joinRequestService.approveRequest(req.params.requestId, req.user!.publicId);
      sendSuccess(res, request, 'Request approved');
    } catch (e) { next(e); }
  }

  async rejectRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reason } = req.body;
      const request = await joinRequestService.rejectRequest(req.params.requestId, req.user!.publicId, reason);
      sendSuccess(res, request, 'Request rejected');
    } catch (e) { next(e); }
  }

  async cancelRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await joinRequestService.cancelRequest(req.params.requestId, req.user!.publicId);
      sendSuccess(res, null, 'Request cancelled');
    } catch (e) { next(e); }
  }

  async listIncoming(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const requests = await joinRequestService.listIncoming(req.user!.publicId, req.user!.role);
      sendSuccess(res, requests, 'Incoming requests fetched');
    } catch (e) { next(e); }
  }

  async listOutgoing(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const requests = await joinRequestService.listOutgoing(req.user!.publicId, req.user!.role);
      sendSuccess(res, requests, 'Outgoing requests fetched');
    } catch (e) { next(e); }
  }

  async searchTutor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q } = req.query as { q?: string };
      if (!q) {
        sendSuccess(res, null, 'No query provided');
        return;
      }
      const result = await joinRequestService.searchTutor(q);
      sendSuccess(res, result, 'Tutor search complete');
    } catch (e) { next(e); }
  }
}

export const joinRequestController = new JoinRequestController();
