import { Router } from 'express';
import { courseController } from './course.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { Role } from '../../constants/roles';
import {
  createCourseSchema,
  acceptCourseSchema,
  rejectCourseSchema,
  scheduleCourseClassSchema,
} from './course.validators';

const router = Router();
router.use(authMiddleware);

router.post('/', requireRole(Role.STUDENT), validate(createCourseSchema), courseController.create.bind(courseController));
router.get('/mine', requireRole(Role.STUDENT), courseController.getMine.bind(courseController));
const STRUCTURE_ROLES = [Role.STUDENT, Role.PARENT, Role.TUTOR, Role.ADMIN, Role.SUPER_ADMIN];
router.get('/:coursePublicId/materials/:kind/:materialPublicId/submissions', requireRole(Role.TUTOR), courseController.getMaterialSubmissions.bind(courseController));
router.get('/children', requireRole(Role.PARENT), courseController.getForParent.bind(courseController));
router.get('/:coursePublicId/structure', requireRole(...STRUCTURE_ROLES), courseController.getStructure.bind(courseController));
// Kept for the student progress page until the frontend moves to /structure.
router.get('/:coursePublicId/progress', requireRole(...STRUCTURE_ROLES), courseController.getStructure.bind(courseController));
router.get('/incoming', requireRole(Role.TUTOR), courseController.getIncoming.bind(courseController));
router.post('/:coursePublicId/accept', requireRole(Role.TUTOR), validate(acceptCourseSchema), courseController.accept.bind(courseController));
router.post('/:coursePublicId/reject', requireRole(Role.TUTOR), validate(rejectCourseSchema), courseController.reject.bind(courseController));
router.post('/:coursePublicId/schedule-class', requireRole(Role.TUTOR), validate(scheduleCourseClassSchema), courseController.scheduleClass.bind(courseController));
router.post('/:coursePublicId/cancel', requireRole(Role.STUDENT, Role.TUTOR), courseController.cancel.bind(courseController));

export default router;
