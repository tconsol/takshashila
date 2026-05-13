import { Router } from 'express';
import { classController } from './class.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { Role } from '../../constants/roles';
import {
  bookClassSchema,
  cancelClassSchema,
  setMeetingUrlSchema,
  classQuerySchema,
} from './class.validators';

const router = Router();
router.use(authMiddleware);

router.get('/my/tutor', requireRole(Role.TUTOR), validate(classQuerySchema, 'query'), classController.getMyClassesAsTutor.bind(classController));
router.get('/my/student', requireRole(Role.STUDENT), validate(classQuerySchema, 'query'), classController.getMyClassesAsStudent.bind(classController));
router.post('/book', requireRole(Role.STUDENT), validate(bookClassSchema), classController.bookClass.bind(classController));
router.get('/:classId', classController.getByPublicId.bind(classController));
router.post('/:classId/start', requireRole(Role.TUTOR), classController.startClass.bind(classController));
router.post('/:classId/complete', requireRole(Role.TUTOR), classController.completeClass.bind(classController));
router.post('/:classId/cancel', validate(cancelClassSchema), classController.cancelClass.bind(classController));
router.patch('/:classId/meeting-url', requireRole(Role.TUTOR), validate(setMeetingUrlSchema), classController.setMeetingUrl.bind(classController));

export default router;
