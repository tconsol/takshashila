import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole, requirePermission } from '../../middlewares/permission.middleware';
import { Permission } from '../../constants/permissions';
import { Role } from '../../constants/roles';
import { attendanceService } from './attendance.service';
import { tutorService } from '../tutors/tutor.service';
import { studentService } from '../students/student.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';
import { NotFoundError, ValidationError } from '../../utils/error';
import { assertClassParty } from '../classes/class-access';
import { ScheduledClassModel } from '../schedules/schedule.model';
import { AttendanceModel } from './attendance.model';

const router = Router();
router.use(authMiddleware);

router.post('/mark', requirePermission(Permission.MARK_ATTENDANCE), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Only the class's own tutor (or an admin) may mark it, and only for that class's student.
    await assertClassParty(req.user!, req.body.classPublicId, { allowStudent: false });
    const cls = await ScheduledClassModel.findOne({ publicId: req.body.classPublicId, isDeleted: false }, { studentPublicId: 1 }).lean();
    if (cls && cls.studentPublicId !== req.body.studentPublicId) {
      throw new ValidationError({ studentPublicId: ['This student is not part of that class'] });
    }
    const tutorProfile = await tutorService.getByUserPublicId(req.user!.publicId);
    const attendance = await attendanceService.markAttendance(req.body, tutorProfile.publicId);
    sendCreated(res, attendance, 'Attendance marked');
  } catch (e) { next(e); }
});

router.patch('/:attendanceId/override', requirePermission(Permission.MARK_ATTENDANCE), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const record = await AttendanceModel.findOne({ publicId: req.params.attendanceId, isDeleted: false }, { classPublicId: 1 }).lean();
    if (!record) throw new NotFoundError('Attendance record');
    await assertClassParty(req.user!, record.classPublicId, { allowStudent: false });
    const updated = await attendanceService.overrideAttendance(req.params.attendanceId, req.body, req.user!.publicId);
    sendSuccess(res, updated, 'Attendance overridden');
  } catch (e) { next(e); }
});

router.get('/class/:classId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await assertClassParty(req.user!, req.params.classId, { allowStudent: true });
    let records = await attendanceService.getByClass(req.params.classId);
    if (req.user!.role === Role.STUDENT) {
      // A student sees only their own record, not the rest of the roster.
      const student = await studentService.getByUserPublicId(req.user!.publicId);
      records = records.filter((r) => r.studentPublicId === student.publicId);
    }
    sendSuccess(res, records, 'Attendance fetched');
  } catch (e) { next(e); }
});

router.get('/tutor/my', requireRole(Role.TUTOR, Role.PRINCIPAL), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutorProfile = await tutorService.getByUserPublicId(req.user!.publicId);
    const result = await attendanceService.getByTutor(tutorProfile.publicId, req.query);
    sendPaginated(res, result, 'Attendance fetched');
  } catch (e) { next(e); }
});

router.get('/my', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let studentProfile;
    try {
      studentProfile = await studentService.getByUserPublicId(req.user!.publicId);
    } catch (err) {
      if (err instanceof NotFoundError) {
        sendPaginated(res, { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }, 'Attendance history fetched');
        return;
      }
      throw err;
    }
    const result = await attendanceService.getByStudent(studentProfile.publicId, req.query);
    sendPaginated(res, result, 'Attendance history fetched');
  } catch (e) { next(e); }
});

// Admin/principal/support: attendance by student profile publicId
router.get('/student/:studentPublicId', requirePermission(Permission.MANAGE_STUDENTS), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await attendanceService.getByStudent(req.params.studentPublicId, req.query);
    sendPaginated(res, result, 'Attendance fetched');
  } catch (e) { next(e); }
});

export default router;
