import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { scheduleService } from './schedule.service';
import { tutorService } from '../tutors/tutor.service';
import { sendSuccess, sendCreated, sendPaginated, sendNoContent } from '../../utils/response';

export class ScheduleController {
  async createSlot(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tutorProfile = await tutorService.getByUserPublicId(req.user!.publicId);
      const slot = await scheduleService.createSlot(tutorProfile.publicId, req.body);
      sendCreated(res, slot, 'Availability slot created');
    } catch (error) { next(error); }
  }

  async getMySlots(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tutorProfile = await tutorService.getByUserPublicId(req.user!.publicId);
      const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = req.query.to ? new Date(req.query.to as string) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      const slots = await scheduleService.getMyCalendar(tutorProfile.publicId, from, to);
      sendSuccess(res, { items: slots, total: slots.length }, 'Slots fetched');
    } catch (error) { next(error); }
  }

  async getTutorAvailability(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const from = req.query.from ? new Date(req.query.from as string) : new Date();
      const to = req.query.to ? new Date(req.query.to as string) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const result = await scheduleService.getAvailableSlots(req.params.tutorId, from, to, req.query);
      sendPaginated(res, result, 'Availability fetched');
    } catch (error) { next(error); }
  }

  async getMyCalendar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tutorProfile = await tutorService.getByUserPublicId(req.user!.publicId);
      const from = req.query.from ? new Date(req.query.from as string) : new Date();
      const to = req.query.to ? new Date(req.query.to as string) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const slots = await scheduleService.getMyCalendar(tutorProfile.publicId, from, to);
      sendSuccess(res, slots, 'Calendar fetched');
    } catch (error) { next(error); }
  }

  async deleteSlot(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tutorProfile = await tutorService.getByUserPublicId(req.user!.publicId);
      await scheduleService.deleteSlot(req.params.slotId, tutorProfile.publicId);
      sendNoContent(res);
    } catch (error) { next(error); }
  }

  async cancelSlot(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tutorProfile = await tutorService.getByUserPublicId(req.user!.publicId);
      const slot = await scheduleService.cancelSlot(req.params.slotId, tutorProfile.publicId);
      sendSuccess(res, slot, 'Slot cancelled');
    } catch (error) { next(error); }
  }

  async rescheduleSlot(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tutorProfile = await tutorService.getByUserPublicId(req.user!.publicId);
      const slot = await scheduleService.rescheduleSlot(req.params.slotId, tutorProfile.publicId, req.body);
      sendSuccess(res, slot, 'Slot rescheduled');
    } catch (error) { next(error); }
  }
}

export const scheduleController = new ScheduleController();
