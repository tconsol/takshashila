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
import { NotFoundError } from '../../utils/error';

const router = Router();
router.use(authMiddleware);

router.post('/mark', requirePermission(Permission.MARK_ATTENDANCE), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutorProfile = await tutorService.getByUserPublicId(req.user!.publicId);
    const attendance = await attendanceService.markAttendance(req.body, tutorProfile.publicId);
    sendCreated(res, attendance, 'Attendance marked');
  } catch (e) { next(e); }
});

router.patch('/:attendanceId/override', requirePermission(Permission.MARK_ATTENDANCE), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await attendanceService.overrideAttendance(req.params.attendanceId, req.body, req.user!.publicId);
    sendSuccess(res, updated, 'Attendance overridden');
  } catch (e) { next(e); }
});

router.get('/class/:classId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const records = await attendanceService.getByClass(req.params.classId);
    sendSuccess(res, records, 'Attendance fetched');
  } catch (e) { next(e); }
});

router.get('/tutor/my', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
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
