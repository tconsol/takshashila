import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { Role } from '../../constants/roles';
import { parentService } from './parent.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';
import { validate } from '../../middlewares/validation.middleware';
import { createStudentByParentSchema } from '../students/student.validators';

const router = Router();
router.use(authMiddleware);
router.use(requireRole(Role.PARENT));

router.get('/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await parentService.getOrCreateProfile(req.user!.publicId);
    sendSuccess(res, profile, 'Parent profile fetched');
  } catch (e) { next(e); }
});

router.get('/me/children', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const children = await parentService.getChildren(req.user!.publicId);
    sendSuccess(res, children, 'Children fetched');
  } catch (e) { next(e); }
});

router.post('/me/children/create', validate(createStudentByParentSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const child = await parentService.createChild(req.user!.publicId, req.body);
    sendCreated(res, child, 'Child account created');
  } catch (e) { next(e); }
});

router.post('/me/children/link', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { studentPublicId } = req.body;
    const profile = await parentService.linkChild(req.user!.publicId, studentPublicId);
    sendSuccess(res, profile, 'Child linked successfully');
  } catch (e) { next(e); }
});

router.post('/me/children/request', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { studentPublicId } = req.body;
    await parentService.requestLinkChild(req.user!.publicId, studentPublicId);
    sendSuccess(res, null, 'Link request sent to student');
  } catch (e) { next(e); }
});

router.patch('/me/children/:studentPublicId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await parentService.updateChild(req.user!.publicId, req.params.studentPublicId, req.body);
    sendSuccess(res, null, 'Child updated');
  } catch (e) { next(e); }
});

router.delete('/me/children/:studentPublicId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await parentService.unlinkChild(req.user!.publicId, req.params.studentPublicId);
    sendSuccess(res, profile, 'Child removed');
  } catch (e) { next(e); }
});

router.get('/me/children/:studentPublicId/classes', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await parentService.getChildClasses(
      req.user!.publicId,
      req.params.studentPublicId,
      req.query as Record<string, string>,
    );
    sendPaginated(res, result, 'Classes fetched');
  } catch (e) { next(e); }
});

router.get('/me/children/:studentPublicId/attendance', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await parentService.getChildAttendance(
      req.user!.publicId,
      req.params.studentPublicId,
      req.query as Record<string, string>,
    );
    sendPaginated(res, result, 'Attendance fetched');
  } catch (e) { next(e); }
});

router.get('/me/children/:studentPublicId/assignments', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await parentService.getChildAssignments(
      req.user!.publicId,
      req.params.studentPublicId,
    );
    sendSuccess(res, result, 'Assignments fetched');
  } catch (e) { next(e); }
});

router.get('/me/children/:studentPublicId/worksheets', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await parentService.getChildWorksheets(
      req.user!.publicId,
      req.params.studentPublicId,
      req.query as Record<string, string>,
    );
    sendPaginated(res, result, 'Worksheets fetched');
  } catch (e) { next(e); }
});

router.post('/me/children/:studentPublicId/request-tutor', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { tutorPublicId } = req.body as { tutorPublicId: string };
    await parentService.requestTutorForChild(req.user!.publicId, req.params.studentPublicId, tutorPublicId);
    sendSuccess(res, null, 'Tutor request sent');
  } catch (e) { next(e); }
});

export default router;
