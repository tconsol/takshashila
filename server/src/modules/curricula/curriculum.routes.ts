import express, { Router } from 'express';
import { curriculumController } from './curriculum.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { Role } from '../../constants/roles';
import { createCurriculumSchema, updateCurriculumSchema, publishStateSchema, adminResourceSchema, adminAssignmentSchema, adminWorksheetSchema } from './curriculum.validators';

const router = Router();
router.use(authMiddleware);

router.get('/admin/states', requireRole(Role.SUPER_ADMIN, Role.ADMIN), curriculumController.adminStates.bind(curriculumController));
router.get('/admin/overview', requireRole(Role.SUPER_ADMIN, Role.ADMIN), curriculumController.adminOverview.bind(curriculumController));
// The Word file is the raw request body (no multipart library needed).
router.post('/admin/import', requireRole(Role.SUPER_ADMIN, Role.ADMIN), express.raw({ type: () => true, limit: '25mb' }), curriculumController.importDocx.bind(curriculumController));
router.post('/admin/publish-state', requireRole(Role.SUPER_ADMIN, Role.ADMIN), validate(publishStateSchema), curriculumController.publishState.bind(curriculumController));
router.get('/catalog/state', curriculumController.listByState.bind(curriculumController));
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
router.post('/:curriculumPublicId/resources', ADMINS, validate(adminResourceSchema), curriculumController.createResource.bind(curriculumController));
router.post('/:curriculumPublicId/assignments', ADMINS, validate(adminAssignmentSchema), curriculumController.createAssignment.bind(curriculumController));
router.post('/:curriculumPublicId/worksheets', ADMINS, validate(adminWorksheetSchema), curriculumController.createWorksheet.bind(curriculumController));
router.delete('/:curriculumPublicId/materials/:kind/:materialPublicId', ADMINS, curriculumController.deleteMaterial.bind(curriculumController));

export default router;
