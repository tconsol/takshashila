import { Router } from 'express';
import { tutorController } from './tutor.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole, requirePermission } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { Permission } from '../../constants/permissions';
import { Role } from '../../constants/roles';
import { updateTutorProfileSchema, tutorSearchSchema } from './tutor.validators';

const router = Router();

// Public anyone can browse the tutor directory
router.get('/search', validate(tutorSearchSchema, 'query'), tutorController.search.bind(tutorController));

// Everything below requires authentication
router.use(authMiddleware);
router.get('/pending', requireRole(Role.PRINCIPAL, Role.ADMIN, Role.SUPER_ADMIN), tutorController.getPending.bind(tutorController));
router.post('/invite', requireRole(Role.PRINCIPAL, Role.ADMIN, Role.SUPER_ADMIN), tutorController.invite.bind(tutorController));
router.get('/me', requireRole(Role.TUTOR), tutorController.getMyProfile.bind(tutorController));
router.put('/me', requireRole(Role.TUTOR), validate(updateTutorProfileSchema), tutorController.updateMyProfile.bind(tutorController));
router.post('/me/submit-verification', requireRole(Role.TUTOR), tutorController.submitForVerification.bind(tutorController));
router.get('/my-principal', requireRole(Role.TUTOR), tutorController.getMyPrincipal.bind(tutorController));
router.get('/by-principal/:principalId', requirePermission(Permission.VIEW_TUTOR_ANALYTICS), tutorController.getByPrincipal.bind(tutorController));
router.get('/my-tutors', requireRole(Role.PRINCIPAL), tutorController.getByPrincipal.bind(tutorController));
router.get('/:tutorId', tutorController.getByPublicId.bind(tutorController));
router.post('/:tutorId/approve', requirePermission(Permission.MANAGE_TUTORS), tutorController.approveTutor.bind(tutorController));
router.post('/:tutorId/suspend', requirePermission(Permission.MANAGE_TUTORS), tutorController.suspendTutor.bind(tutorController));
router.post('/:tutorId/reactivate', requirePermission(Permission.MANAGE_TUTORS), tutorController.reactivateTutor.bind(tutorController));

export default router;
