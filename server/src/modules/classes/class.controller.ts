import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { classService } from './class.service';
import { tutorService } from '../tutors/tutor.service';
import { studentService } from '../students/student.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';
import { NotFoundError, AppError } from '../../utils/error';
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';
import { env } from '../../config/env';
import { ScheduledClassModel } from '../schedules/schedule.model';
import { TutorProfileModel } from '../tutors/tutor.model';
import { StudentProfileModel } from '../students/student.model';

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

  async joinClass(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cls = await classService.joinClass(req.params.classId, req.user!.publicId, req.user!.role);
      sendSuccess(res, cls, 'Joined class');
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
          sendPaginated(res, { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }, 'Classes fetched');
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

  async tutorCreateClass(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const classes = await classService.tutorCreateClasses(req.user!.publicId, req.body);
      sendCreated(res, classes, `${classes.length} class${classes.length !== 1 ? 'es' : ''} created`);
    } catch (error) { next(error); }
  }

  async tutorReschedule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cls = await classService.tutorReschedule(req.params.classId, req.user!.publicId, req.body);
      sendSuccess(res, cls, 'Class rescheduled');
    } catch (error) { next(error); }
  }

  async saveRecording(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cls = await classService.saveRecording(req.params.classId, req.user!.publicId, req.body);
      sendSuccess(res, cls, 'Recording saved');
    } catch (error) { next(error); }
  }

  async getAgoraToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { classId } = req.params;
      const userPublicId = req.user!.publicId;
      const role = req.user!.role;

      const cls = await ScheduledClassModel.findOne({ publicId: classId, isDeleted: false }).lean();
      if (!cls) throw new NotFoundError('Class');

      // Verify the requesting user belongs to this class
      let authorized = false;
      if (role === 'TUTOR') {
        const tutorProfile = await TutorProfileModel.findOne({ userPublicId, isDeleted: false }, { publicId: 1 }).lean();
        authorized = tutorProfile?.publicId === cls.tutorPublicId;
      } else if (role === 'STUDENT') {
        const studentProfile = await StudentProfileModel.findOne({ userPublicId, isDeleted: false }, { publicId: 1 }).lean();
        authorized = studentProfile?.publicId === cls.studentPublicId;
      } else {
        // PRINCIPAL, ADMIN, SUPER_ADMIN can observe
        authorized = true;
      }

      if (!authorized) throw new AppError('Not authorized to join this class', 403);

      const expireTime = Math.floor(Date.now() / 1000) + env.AGORA_TOKEN_EXPIRE_SECONDS;
      const token = RtcTokenBuilder.buildTokenWithUid(
        env.AGORA_APP_ID,
        env.AGORA_APP_CERTIFICATE,
        classId,   // channel name = classPublicId
        0,         // uid 0 = auto-assign
        RtcRole.PUBLISHER,
        expireTime,
      );

      sendSuccess(res, {
        appId: env.AGORA_APP_ID,
        channel: classId,
        token,
        uid: 0,
        expireTime,
      }, 'Agora token generated');
    } catch (error) { next(error); }
  }
}

export const classController = new ClassController();
