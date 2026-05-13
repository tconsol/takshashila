import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { Role } from '../../constants/roles';
import { worksheetService } from './worksheet.service';
import { tutorService } from '../tutors/tutor.service';
import { studentService } from '../students/student.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';

const router = Router();
router.use(authMiddleware);

// ─── Tutor routes ─────────────────────────────────────────────────────────────

router.post('/', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    const worksheet = await worksheetService.create(tutor.publicId, req.body);
    sendCreated(res, worksheet, 'Worksheet created');
  } catch (e) { next(e); }
});

router.get('/my', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    const result = await worksheetService.getByTutor(tutor.publicId, req.query as Record<string, string>);
    sendPaginated(res, result, 'Worksheets fetched');
  } catch (e) { next(e); }
});

router.patch('/:worksheetId', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    const updated = await worksheetService.update(req.params.worksheetId, tutor.publicId, req.body);
    sendSuccess(res, updated, 'Worksheet updated');
  } catch (e) { next(e); }
});

router.post('/:worksheetId/publish', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    const updated = await worksheetService.publish(req.params.worksheetId, tutor.publicId);
    sendSuccess(res, updated, 'Worksheet published');
  } catch (e) { next(e); }
});

router.post('/:worksheetId/unpublish', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    const updated = await worksheetService.unpublish(req.params.worksheetId, tutor.publicId);
    sendSuccess(res, updated, 'Worksheet unpublished');
  } catch (e) { next(e); }
});

router.post('/:worksheetId/share', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    const { studentPublicIds } = req.body;
    const updated = await worksheetService.shareWithStudents(req.params.worksheetId, tutor.publicId, studentPublicIds);
    sendSuccess(res, updated, 'Worksheet shared');
  } catch (e) { next(e); }
});

router.delete('/:worksheetId', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    await worksheetService.softDelete(req.params.worksheetId, tutor.publicId);
    sendSuccess(res, null, 'Worksheet deleted');
  } catch (e) { next(e); }
});

// ─── Student route ─────────────────────────────────────────────────────────────

router.get('/student/me', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const student = await studentService.getByUserPublicId(req.user!.publicId);
    const result = await worksheetService.getForStudent(student.publicId, req.query as Record<string, string>);
    sendPaginated(res, result, 'Worksheets fetched');
  } catch (e) { next(e); }
});

// ─── Shared single-worksheet fetch (tutor, student, parent) ───────────────────

router.get('/:worksheetId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const worksheet = await worksheetService.getByPublicId(req.params.worksheetId);
    sendSuccess(res, worksheet, 'Worksheet fetched');
  } catch (e) { next(e); }
});

export default router;
