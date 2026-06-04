import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { studentService } from './student.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';
import { NotFoundError } from '../../utils/error';
import type { CreateStudentByTutorDto, InviteExistingStudentDto, CreateStudentByPrincipalDto, InviteStudentByPrincipalDto } from './student.validators';

export class StudentController {
  async createStudent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = req.body as CreateStudentByTutorDto;
      const student = await studentService.createByTutor(req.user!.publicId, dto);
      sendCreated(res, student, 'Student created and linked to your account');
    } catch (error) { next(error); }
  }

  async getMyProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await studentService.getByUserPublicId(req.user!.publicId);
      sendSuccess(res, profile, 'Student profile fetched');
    } catch (error) {
      if (error instanceof NotFoundError) {
        sendSuccess(res, null, 'No student profile yet');
        return;
      }
      next(error);
    }
  }

  async getByPublicId(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await studentService.getByPublicId(req.params.studentId);
      sendSuccess(res, profile, 'Student profile fetched');
    } catch (error) { next(error); }
  }

  async getMyStudents(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tutorService } = await import('../tutors/tutor.service');
      const tutorProfile = await tutorService.getByUserPublicId(req.user!.publicId);
      const result = await studentService.getByTutor(tutorProfile.publicId, req.query);
      sendPaginated(res, result, 'Students fetched');
    } catch (error) { next(error); }
  }

  async approveStudent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await studentService.approve(req.params.studentId, req.user!.publicId);
      sendSuccess(res, updated, 'Student approved');
    } catch (error) { next(error); }
  }

  async rejectStudent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await studentService.reject(req.params.studentId);
      sendSuccess(res, null, 'Student rejected');
    } catch (error) { next(error); }
  }

  async suspendStudent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await studentService.suspend(req.params.studentId);
      sendSuccess(res, updated, 'Student suspended');
    } catch (error) { next(error); }
  }

  async listAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await studentService.listAll(req.query);
      sendPaginated(res, result, 'Students fetched');
    } catch (error) { next(error); }
  }

  async listPending(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await studentService.listPending(req.query);
      sendPaginated(res, result, 'Pending students fetched');
    } catch (error) { next(error); }
  }

  async lookupStudent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = req.query as InviteExistingStudentDto;
      const result = await studentService.lookupByEmailOrPhone(req.user!.publicId, dto);
      sendSuccess(res, result, 'Student found');
    } catch (error) { next(error); }
  }

  async inviteExistingStudent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = req.body as InviteExistingStudentDto;
      const profile = await studentService.inviteExisting(req.user!.publicId, dto);
      sendCreated(res, profile, 'Invite sent');
    } catch (error) { next(error); }
  }

  async acceptInvite(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await studentService.acceptInvite(req.user!.publicId);
      sendSuccess(res, profile, 'Invite accepted');
    } catch (error) { next(error); }
  }

  async declineInvite(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await studentService.declineInvite(req.user!.publicId);
      sendSuccess(res, null, 'Invite declined');
    } catch (error) { next(error); }
  }

  async transferStudent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await studentService.transfer(
        req.params.studentId,
        req.body,
        req.user!.publicId,
      );
      sendSuccess(res, updated, 'Student transferred');
    } catch (error) { next(error); }
  }

  async createStudentByPrincipal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = req.body as CreateStudentByPrincipalDto;
      const student = await studentService.createByPrincipal(req.user!.publicId, dto);
      sendCreated(res, student, 'Student created and linked to tutor');
    } catch (error) { next(error); }
  }

  async inviteExistingByPrincipal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = req.body as InviteStudentByPrincipalDto;
      const profile = await studentService.inviteExistingByPrincipal(req.user!.publicId, dto);
      sendCreated(res, profile, 'Student invite sent');
    } catch (error) { next(error); }
  }

  async getMyStudentsAsPrincipal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await studentService.getByPrincipal(req.user!.publicId, req.query);
      sendPaginated(res, result, 'Students fetched');
    } catch (error) { next(error); }
  }

  async unlinkStudent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = req.user!.role as 'TUTOR' | 'PRINCIPAL';
      await studentService.unlinkStudent(req.params.studentId, req.user!.publicId, role);
      sendSuccess(res, null, 'Student unlinked');
    } catch (error) { next(error); }
  }

  async searchParentByEmail(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const email = req.query.email as string;
      if (!email) { res.status(400).json({ message: 'email query param required' }); return; }
      const result = await studentService.searchParentByEmail(email);
      sendSuccess(res, result, 'Parent children fetched');
    } catch (error) { next(error); }
  }

  async getMyPrincipal(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await studentService.getMyPrincipal(req.user!.publicId);
      sendSuccess(res, result, 'Principal info fetched');
    } catch (error) { next(error); }
  }
}

export const studentController = new StudentController();
