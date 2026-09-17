import { Router } from 'express';
import { demoRequestService } from './demo-request.service';
import { demoRequestController } from './demo-request.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { Role } from '../../constants/roles';
import { createDemoRequestSchema, rejectDemoRequestSchema } from './demo-request.validators';

const router = Router();
router.use(authMiddleware);

router.post('/', requireRole(Role.STUDENT), validate(createDemoRequestSchema), demoRequestController.create.bind(demoRequestController));
router.get('/my/tutor', requireRole(Role.TUTOR), demoRequestController.getForTutor.bind(demoRequestController));
router.get('/my/student', requireRole(Role.STUDENT), demoRequestController.getForStudent.bind(demoRequestController));
// Platform-wide oversight for admins.
router.get('/admin/list', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req, res, next) => {
  try {
    const { status, ...pagination } = req.query as Record<string, string>;
    const result = await demoRequestService.listForAdmin({ status, ...pagination });
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.get('/admin/counts', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await demoRequestService.statusCounts() });
  } catch (e) { next(e); }
});

router.post('/:requestId/accept', requireRole(Role.TUTOR), demoRequestController.accept.bind(demoRequestController));
router.post('/:requestId/reject', requireRole(Role.TUTOR), validate(rejectDemoRequestSchema), demoRequestController.reject.bind(demoRequestController));

export default router;
