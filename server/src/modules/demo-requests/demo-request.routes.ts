import { Router } from 'express';
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
router.post('/:requestId/accept', requireRole(Role.TUTOR), demoRequestController.accept.bind(demoRequestController));
router.post('/:requestId/reject', requireRole(Role.TUTOR), validate(rejectDemoRequestSchema), demoRequestController.reject.bind(demoRequestController));

export default router;
