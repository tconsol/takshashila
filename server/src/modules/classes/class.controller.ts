import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { classService } from './class.service';
import { tutorService } from '../tutors/tutor.service';
import { studentService } from '../students/student.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';
import { NotFoundError, AppError } from '../../utils/error';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { env } from '../../config/env';
import { ScheduledClassModel } from '../schedules/schedule.model';
import { ClassStatus } from '../schedules/schedule.types';
import { TutorProfileModel } from '../tutors/tutor.model';
import { StudentProfileModel } from '../students/student.model';
import { ParentProfileModel } from '../parents/parent.model';
import { assertClassParty, assertClassViewer } from './class-access';
import { classPresenceService } from './class-presence.service';

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
      await assertClassParty(req.user!, req.params.classId, { allowStudent: false });
      const cls = await classService.startClass(req.params.classId, req.user!.publicId);
      sendSuccess(res, cls, 'Class started');
    } catch (error) { next(error); }
  }

  async joinClass(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await assertClassViewer(req.user!, req.params.classId);
      const cls = await classService.joinClass(req.params.classId, req.user!.publicId, req.user!.role);
      sendSuccess(res, cls, 'Joined class');
    } catch (error) { next(error); }
  }

  /**
   * Heartbeat from the room page, and the last one when the person leaves. Both
   * routes do the same thing: note that this person was present just now.
   */
  async recordPresence(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const progress = await classPresenceService.recordPresence(req.params.classId, req.user!.publicId);
      sendSuccess(res, progress, 'Presence recorded');
    } catch (error) { next(error); }
  }

  async completeClass(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await assertClassParty(req.user!, req.params.classId, { allowStudent: false });
      const cls = await classService.completeSession(req.params.classId, req.user!.publicId);
      sendSuccess(res, cls, 'Class completed');
    } catch (error) { next(error); }
  }

  async cancelClass(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await assertClassParty(req.user!, req.params.classId, { allowStudent: true });
      // A student cancels only their own record; the tutor (or principal/admin) cancels the whole session.
      const cancel = req.user!.role === 'STUDENT' ? classService.cancelClass : classService.cancelSession;
      const cls = await cancel.call(classService, req.params.classId, req.user!.publicId, req.body);
      sendSuccess(res, cls, 'Class cancelled');
    } catch (error) { next(error); }
  }

  async refundClass(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await assertClassParty(req.user!, req.params.classId, { allowStudent: false });
      const cls = await classService.refundClass(req.params.classId, req.user!.publicId, req.body.reason, {
        role: req.user!.role,
        ip: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      });
      sendSuccess(res, cls, 'Class refunded');
    } catch (error) { next(error); }
  }

  async setMeetingUrl(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await assertClassParty(req.user!, req.params.classId, { allowStudent: false });
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
      // All of the student's profiles (one per tutor link), so classes from every tutor are listed.
      const profileIds = await studentService.getProfileIdsByUser(req.user!.publicId);
      if (profileIds.length === 0) {
        sendPaginated(res, { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }, 'Classes fetched');
        return;
      }
      const result = await classService.getClassesByStudent(
        profileIds,
        parseClassFilters(req.query as Record<string, unknown>),
        req.query,
      );
      sendPaginated(res, result, 'Classes fetched');
    } catch (error) { next(error); }
  }

  /** Classes that ran too short to settle themselves and need a decision. */
  async getAwaitingDecision(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const classes = await classService.listAwaitingDecision(req.user!.publicId);
      sendSuccess(res, classes, 'Classes awaiting your decision');
    } catch (error) { next(error); }
  }

  async getByPublicId(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await assertClassViewer(req.user!, req.params.classId);
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

  async getAgoraToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { classId } = req.params;
      const userPublicId = req.user!.publicId;
      const role = req.user!.role;

      const cls = await ScheduledClassModel.findOne({ publicId: classId, isDeleted: false }).lean();
      if (!cls) throw new NotFoundError('Class');

      // An ended class has no room: do not hand out a video token for it.
      if (cls.status === ClassStatus.COMPLETED || cls.status === ClassStatus.CANCELLED || cls.status === ClassStatus.INCOMPLETE) {
        throw new AppError('This class has ended', 409);
      }

      // Verify the requesting user belongs to this class
      // Every branch is an explicit allow; the default is deny.
      // Parties (tutor/student) may publish; observers are subscribe-only.
      let authorized = false;
      let rtcRole = RtcRole.SUBSCRIBER;
      if (role === 'TUTOR') {
        const tutorProfile = await TutorProfileModel.findOne({ userPublicId, isDeleted: false }, { publicId: 1 }).lean();
        authorized = tutorProfile?.publicId === cls.tutorPublicId;
        if (authorized) rtcRole = RtcRole.PUBLISHER;
      } else if (role === 'STUDENT') {
        // A student has one profile per tutor link: look up the class's own profile, not the first one.
        const studentProfile = await StudentProfileModel.findOne(
          { userPublicId, publicId: cls.studentPublicId, isDeleted: false },
          { publicId: 1 },
        ).lean();
        authorized = studentProfile?.publicId === cls.studentPublicId;
        if (authorized) rtcRole = RtcRole.PUBLISHER;
      } else if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
        authorized = true;
      } else if (role === 'PRINCIPAL') {
        const classTutor = await TutorProfileModel.findOne({ publicId: cls.tutorPublicId, isDeleted: false }, { principalPublicId: 1 }).lean();
        authorized = !!classTutor?.principalPublicId && classTutor.principalPublicId === userPublicId;
      } else if (role === 'PARENT') {
        const parent = await ParentProfileModel.findOne({ userPublicId, isDeleted: false }, { childStudentPublicIds: 1 }).lean();
        authorized = !!parent?.childStudentPublicIds?.includes(cls.studentPublicId);
      }

      if (!authorized) throw new AppError('Not authorized to join this class', 403);

      // Students of one group session share one room: their records carry the same groupPublicId.
      const channel = cls.groupPublicId ?? classId;
      const expireTime = Math.floor(Date.now() / 1000) + env.AGORA_TOKEN_EXPIRE_SECONDS;
      const token = RtcTokenBuilder.buildTokenWithUid(
        env.AGORA_APP_ID,
        env.AGORA_APP_CERTIFICATE,
        channel,   // channel name = groupPublicId, or classPublicId for a single class
        0,         // uid 0 = auto-assign
        rtcRole,
        env.AGORA_TOKEN_EXPIRE_SECONDS, // token expire (seconds)
        env.AGORA_TOKEN_EXPIRE_SECONDS, // privilege expire (seconds)
      );

      sendSuccess(res, {
        appId: env.AGORA_APP_ID,
        channel,
        token,
        uid: 0,
        expireTime,
        canPublish: rtcRole === RtcRole.PUBLISHER,
      }, 'Agora token generated');
    } catch (error) { next(error); }
  }
}

export const classController = new ClassController();
