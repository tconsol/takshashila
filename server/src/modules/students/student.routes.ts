import { Router } from 'express';
import { studentController } from './student.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole, requirePermission } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { Permission } from '../../constants/permissions';
import { Role } from '../../constants/roles';
import { createStudentByTutorSchema, inviteExistingStudentSchema, createStudentByPrincipalSchema, inviteStudentByPrincipalSchema } from './student.validators';

const router = Router();
router.use(authMiddleware);

router.post('/', requireRole(Role.TUTOR), validate(createStudentByTutorSchema), studentController.createStudent.bind(studentController));
router.post('/principal/create', requireRole(Role.PRINCIPAL), validate(createStudentByPrincipalSchema), studentController.createStudentByPrincipal.bind(studentController));
router.post('/principal/invite', requireRole(Role.PRINCIPAL), validate(inviteStudentByPrincipalSchema), studentController.inviteExistingByPrincipal.bind(studentController));
router.get('/principal/my-students', requireRole(Role.PRINCIPAL), studentController.getMyStudentsAsPrincipal.bind(studentController));
router.get('/lookup', requireRole(Role.TUTOR), validate(inviteExistingStudentSchema, 'query'), studentController.lookupStudent.bind(studentController));
router.post('/invite-existing', requireRole(Role.TUTOR), validate(inviteExistingStudentSchema), studentController.inviteExistingStudent.bind(studentController));
router.get('/me', requireRole(Role.STUDENT), studentController.getMyProfile.bind(studentController));
router.post('/me/accept-invite', requireRole(Role.STUDENT), studentController.acceptInvite.bind(studentController));
router.post('/me/decline-invite', requireRole(Role.STUDENT), studentController.declineInvite.bind(studentController));
router.get('/pending', requirePermission(Permission.MANAGE_STUDENTS), studentController.listPending.bind(studentController));
router.get('/', requirePermission(Permission.MANAGE_STUDENTS), studentController.listAll.bind(studentController));
router.get('/my-students', requireRole(Role.TUTOR), studentController.getMyStudents.bind(studentController));
router.get('/:studentId', requirePermission(Permission.MANAGE_STUDENTS), studentController.getByPublicId.bind(studentController));
router.post('/:studentId/approve', requirePermission(Permission.MANAGE_STUDENTS), studentController.approveStudent.bind(studentController));
router.post('/:studentId/reject', requirePermission(Permission.MANAGE_STUDENTS), studentController.rejectStudent.bind(studentController));
router.post('/:studentId/suspend', requirePermission(Permission.MANAGE_STUDENTS), studentController.suspendStudent.bind(studentController));
router.post('/:studentId/transfer', requirePermission(Permission.MANAGE_STUDENTS), studentController.transferStudent.bind(studentController));

export default router;
