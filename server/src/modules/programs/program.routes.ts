// server/src/modules/programs/program.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { Role } from '../../constants/roles';
import { programController as c } from './program.controller';
import { createProgramSchema, updateProgramSchema, enrollSchema, scheduleSessionSchema } from './program.validators';

const router = Router();
router.use(authMiddleware);

const TEACHERS = requireRole(Role.TUTOR, Role.PRINCIPAL);
const ADMINS = requireRole(Role.ADMIN, Role.SUPER_ADMIN);

router.get('/', c.catalog);
router.get('/mine', TEACHERS, c.mine);
router.get('/admin', ADMINS, c.adminList);
router.get('/enrollments/mine', requireRole(Role.STUDENT), c.myEnrollments);
router.get('/enrollments/children', requireRole(Role.PARENT), c.childrenEnrollments);
router.get('/enrollments/:enrollmentPublicId/structure', c.structure);
router.post('/enrollments/:enrollmentPublicId/sessions', TEACHERS, validate(scheduleSessionSchema), c.scheduleSession);
router.post('/enrollments/:enrollmentPublicId/cancel', requireRole(Role.STUDENT, Role.TUTOR, Role.PRINCIPAL), c.cancel);

router.post('/', TEACHERS, validate(createProgramSchema), c.create);
router.get('/:programPublicId', c.get);
router.put('/:programPublicId', TEACHERS, validate(updateProgramSchema), c.update);
router.delete('/:programPublicId', TEACHERS, c.remove);
router.post('/:programPublicId/publish', TEACHERS, c.publish);
router.post('/:programPublicId/archive', TEACHERS, c.archive);
router.post('/:programPublicId/unpublish', ADMINS, c.unpublish);
router.get('/:programPublicId/enrollments', TEACHERS, c.enrollments);
router.post('/:programPublicId/enroll', requireRole(Role.STUDENT), validate(enrollSchema), c.enroll);

export default router;
