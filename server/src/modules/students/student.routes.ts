import { Router } from 'express';
import { studentController } from './student.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole, requirePermission } from '../../middlewares/permission.middleware';
import { Permission } from '../../constants/permissions';
import { Role } from '../../constants/roles';

const router = Router();
router.use(authMiddleware);

router.get('/me', requireRole(Role.STUDENT), studentController.getMyProfile.bind(studentController));
router.get('/pending', requirePermission(Permission.MANAGE_STUDENTS), studentController.listPending.bind(studentController));
router.get('/', requirePermission(Permission.MANAGE_STUDENTS), studentController.listAll.bind(studentController));
router.get('/my-students', requireRole(Role.TUTOR), studentController.getMyStudents.bind(studentController));
router.get('/:studentId', requirePermission(Permission.MANAGE_STUDENTS), studentController.getByPublicId.bind(studentController));
router.post('/:studentId/approve', requirePermission(Permission.MANAGE_STUDENTS), studentController.approveStudent.bind(studentController));
router.post('/:studentId/reject', requirePermission(Permission.MANAGE_STUDENTS), studentController.rejectStudent.bind(studentController));
router.post('/:studentId/suspend', requirePermission(Permission.MANAGE_STUDENTS), studentController.suspendStudent.bind(studentController));
router.post('/:studentId/transfer', requirePermission(Permission.MANAGE_STUDENTS), studentController.transferStudent.bind(studentController));

export default router;
