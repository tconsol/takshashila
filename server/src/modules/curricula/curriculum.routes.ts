import { Router } from 'express';
import { curriculumController } from './curriculum.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { Role } from '../../constants/roles';
import { createCurriculumSchema, updateCurriculumSchema } from './curriculum.validators';

const router = Router();
router.use(authMiddleware);

router.get('/', curriculumController.list.bind(curriculumController));
router.get('/attachable', requireRole(Role.TUTOR, Role.PRINCIPAL), curriculumController.listAttachable.bind(curriculumController));
router.get('/:curriculumPublicId/structure', requireRole(Role.SUPER_ADMIN, Role.ADMIN), curriculumController.getStructure.bind(curriculumController));
router.get('/:curriculumPublicId/tutors', curriculumController.listTutors.bind(curriculumController));
router.get('/:curriculumPublicId', curriculumController.getByPublicId.bind(curriculumController));
router.post('/', requireRole(Role.SUPER_ADMIN, Role.ADMIN), validate(createCurriculumSchema), curriculumController.create.bind(curriculumController));
router.put('/:curriculumPublicId', requireRole(Role.SUPER_ADMIN, Role.ADMIN), validate(updateCurriculumSchema), curriculumController.update.bind(curriculumController));
router.delete('/:curriculumPublicId', requireRole(Role.SUPER_ADMIN, Role.ADMIN), curriculumController.remove.bind(curriculumController));
router.post('/:curriculumPublicId/publish', requireRole(Role.SUPER_ADMIN, Role.ADMIN), curriculumController.publish.bind(curriculumController));
router.post('/:curriculumPublicId/unpublish', requireRole(Role.SUPER_ADMIN, Role.ADMIN), curriculumController.unpublish.bind(curriculumController));

const ADMINS = requireRole(Role.SUPER_ADMIN, Role.ADMIN);
router.post('/:curriculumPublicId/resources', ADMINS, curriculumController.createResource.bind(curriculumController));
router.post('/:curriculumPublicId/assignments', ADMINS, curriculumController.createAssignment.bind(curriculumController));
router.post('/:curriculumPublicId/worksheets', ADMINS, curriculumController.createWorksheet.bind(curriculumController));
router.delete('/:curriculumPublicId/materials/:kind/:materialPublicId', ADMINS, curriculumController.deleteMaterial.bind(curriculumController));

export default router;
