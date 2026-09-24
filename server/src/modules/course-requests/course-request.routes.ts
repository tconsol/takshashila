import { Router } from 'express';
import { courseRequestController } from './course-request.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { Role } from '../../constants/roles';
import {
  createCourseRequestSchema,
  acceptCourseRequestSchema,
  rejectCourseRequestSchema,
  scheduleCourseClassSchema,
} from './course-request.validators';

const router = Router();
router.use(authMiddleware);

router.post('/', requireRole(Role.STUDENT), validate(createCourseRequestSchema), courseRequestController.create.bind(courseRequestController));
router.get('/mine', requireRole(Role.STUDENT), courseRequestController.getMine.bind(courseRequestController));
router.get('/:requestPublicId/progress', requireRole(Role.STUDENT), courseRequestController.getProgress.bind(courseRequestController));
router.get('/incoming', requireRole(Role.TUTOR), courseRequestController.getIncoming.bind(courseRequestController));
router.post('/:requestPublicId/accept', requireRole(Role.TUTOR), validate(acceptCourseRequestSchema), courseRequestController.accept.bind(courseRequestController));
router.post('/:requestPublicId/reject', requireRole(Role.TUTOR), validate(rejectCourseRequestSchema), courseRequestController.reject.bind(courseRequestController));
router.post('/:requestPublicId/schedule-class', requireRole(Role.TUTOR), validate(scheduleCourseClassSchema), courseRequestController.scheduleClass.bind(courseRequestController));
router.post('/:requestPublicId/cancel', requireRole(Role.STUDENT, Role.TUTOR), courseRequestController.cancel.bind(courseRequestController));

export default router;
