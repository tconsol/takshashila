import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { tutorService } from './tutor.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';

export class TutorController {
  async getMyProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await tutorService.getByUserPublicId(req.user!.publicId);
      sendSuccess(res, profile, 'Tutor profile fetched');
    } catch (error) { next(error); }
  }

  async getByPublicId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await tutorService.getByPublicId(req.params.tutorId);
      sendSuccess(res, profile, 'Tutor profile fetched');
    } catch (error) { next(error); }
  }

  async updateMyProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await tutorService.getByUserPublicId(req.user!.publicId);
      const updated = await tutorService.updateProfile(profile.publicId, req.body);
      sendSuccess(res, updated, 'Profile updated');
    } catch (error) { next(error); }
  }

  async submitForVerification(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await tutorService.getByUserPublicId(req.user!.publicId);
      const updated = await tutorService.submitForVerification(profile.publicId);
      sendSuccess(res, updated, 'Submitted for verification');
    } catch (error) { next(error); }
  }

  async approveTutor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await tutorService.approve(req.params.tutorId, req.user!.publicId);
      sendSuccess(res, updated, 'Tutor approved');
    } catch (error) { next(error); }
  }

  async suspendTutor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await tutorService.suspend(req.params.tutorId);
      sendSuccess(res, updated, 'Tutor suspended');
    } catch (error) { next(error); }
  }

  async reactivateTutor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await tutorService.reactivate(req.params.tutorId);
      sendSuccess(res, updated, 'Tutor reactivated');
    } catch (error) { next(error); }
  }

  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subject, language, timezone, minRating, maxHourlyRateCents, isVerified, ...paginationQuery } = req.query as Record<string, string>;
      const result = await tutorService.search(
        {
          subject,
          language,
          timezone,
          minRating: minRating ? +minRating : undefined,
          maxHourlyRateCents: maxHourlyRateCents ? +maxHourlyRateCents : undefined,
          // Only filter by verification status when the caller explicitly asks for it —
          // otherwise we'd hide every verified tutor by sending `isVerified=false`
          isVerified: isVerified === undefined ? undefined : isVerified === 'true',
        },
        paginationQuery,
      );
      sendPaginated(res, result, 'Tutors fetched');
    } catch (error) { next(error); }
  }

  async getByPrincipal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const principalId = req.params.principalId || req.user!.publicId;
      const result = await tutorService.getByPrincipal(principalId, req.query);
      sendPaginated(res, result, 'Tutors fetched');
    } catch (error) { next(error); }
  }

  async getPending(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Principals only see pending tutors under them; admins see all
      const isStaff = ['SUPER_ADMIN', 'ADMIN'].includes(req.user!.role);
      const principalFilter = isStaff ? undefined : req.user!.publicId;
      const result = await tutorService.getPending(req.query, principalFilter);
      sendPaginated(res, result, 'Pending tutors fetched');
    } catch (error) { next(error); }
  }

  async invite(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, firstName, lastName, subjects, hourlyRateCents } = req.body as {
        email: string;
        firstName: string;
        lastName: string;
        subjects?: string[];
        hourlyRateCents?: number;
      };
      const profile = await tutorService.inviteTutor({
        email,
        firstName,
        lastName,
        subjects,
        hourlyRateCents,
        principalPublicId: req.user!.publicId,
        invitedBy: req.user!.publicId,
      });
      sendCreated(res, profile, 'Tutor invited');
    } catch (error) { next(error); }
  }
}

export const tutorController = new TutorController();
