import { Router } from 'express';
import { courseController } from './course.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { Role } from '../../constants/roles';
import { createCourseSchema, updateCourseSchema } from './course.validators';

const router = Router();
router.use(authMiddleware);

router.get('/', courseController.list.bind(courseController));
router.get('/:coursePublicId/tutors', courseController.listTutors.bind(courseController));
router.get('/:coursePublicId', courseController.getByPublicId.bind(courseController));
router.post('/', requireRole(Role.SUPER_ADMIN, Role.ADMIN), validate(createCourseSchema), courseController.create.bind(courseController));
router.put('/:coursePublicId', requireRole(Role.SUPER_ADMIN, Role.ADMIN), validate(updateCourseSchema), courseController.update.bind(courseController));
router.delete('/:coursePublicId', requireRole(Role.SUPER_ADMIN, Role.ADMIN), courseController.remove.bind(courseController));
router.post('/:coursePublicId/publish', requireRole(Role.SUPER_ADMIN, Role.ADMIN), courseController.publish.bind(courseController));
router.post('/:coursePublicId/unpublish', requireRole(Role.SUPER_ADMIN, Role.ADMIN), courseController.unpublish.bind(courseController));

export default router;
