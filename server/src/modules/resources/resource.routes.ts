import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { Role } from '../../constants/roles';
import { resourceService } from './resource.service';
import { tutorService } from '../tutors/tutor.service';
import { studentService } from '../students/student.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';

const router = Router();
router.use(authMiddleware);

// ─── Tutor: create resource ───────────────────────────────────────────────────

router.post('/', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    const resource = await resourceService.create(tutor.publicId, req.body);
    sendCreated(res, resource, 'Resource created');
  } catch (e) { next(e); }
});

// ─── Tutor: list own resources ────────────────────────────────────────────────

router.get('/my', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    const result = await resourceService.getByTutor(tutor.publicId, req.query as Record<string, string>);
    sendPaginated(res, result, 'Resources fetched');
  } catch (e) { next(e); }
});

// ─── Tutor: update resource ───────────────────────────────────────────────────

router.patch('/:resourceId', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    const updated = await resourceService.update(req.params.resourceId, tutor.publicId, req.body);
    sendSuccess(res, updated, 'Resource updated');
  } catch (e) { next(e); }
});

// ─── Tutor: delete resource ───────────────────────────────────────────────────

router.delete('/:resourceId', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    await resourceService.softDelete(req.params.resourceId, tutor.publicId);
    sendSuccess(res, null, 'Resource deleted');
  } catch (e) { next(e); }
});

// ─── Student: list resources (from their tutor) ───────────────────────────────

router.get('/student/me', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const student = await studentService.getByUserPublicId(req.user!.publicId);
    if (!student.tutorPublicId) {
      const empty = { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
      sendPaginated(res, empty, 'Resources fetched');
      return;
    }
    const result = await resourceService.getForStudent(
      student.publicId,
      student.tutorPublicId,
      req.query as Record<string, string>,
    );
    sendPaginated(res, result, 'Resources fetched');
  } catch (e) { next(e); }
});

// ─── Shared: get read URL for a resource file ─────────────────────────────────

router.get('/:resourceId/read-url', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const url = await resourceService.getReadUrl(req.params.resourceId, req.user!.publicId);
    sendSuccess(res, { url }, 'Read URL generated');
  } catch (e) { next(e); }
});

// ─── Shared: get single resource ─────────────────────────────────────────────

router.get('/:resourceId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const resource = await resourceService.getByPublicId(req.params.resourceId);
    sendSuccess(res, resource, 'Resource fetched');
  } catch (e) { next(e); }
});

export default router;
