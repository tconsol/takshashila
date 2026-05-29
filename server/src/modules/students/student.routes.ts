import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { studentController } from './student.controller';
import { studentService } from './student.service';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole, requirePermission } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { Permission } from '../../constants/permissions';
import { Role } from '../../constants/roles';
import { createStudentByTutorSchema, inviteExistingStudentSchema, createStudentByPrincipalSchema, inviteStudentByPrincipalSchema } from './student.validators';
import { parentService } from '../parents/parent.service';
import { StudentProfileModel } from './student.model';
import { NotFoundError } from '../../utils/error';
import { sendSuccess } from '../../utils/response';

const router = Router();
router.use(authMiddleware);

router.post('/', requireRole(Role.TUTOR), validate(createStudentByTutorSchema), studentController.createStudent.bind(studentController));
router.post('/principal/create', requireRole(Role.PRINCIPAL), validate(createStudentByPrincipalSchema), studentController.createStudentByPrincipal.bind(studentController));
router.post('/principal/invite', requireRole(Role.PRINCIPAL), validate(inviteStudentByPrincipalSchema), studentController.inviteExistingByPrincipal.bind(studentController));
router.get('/principal/my-students', requireRole(Role.PRINCIPAL), studentController.getMyStudentsAsPrincipal.bind(studentController));
router.get('/principal/search-parent', requireRole(Role.PRINCIPAL), studentController.searchParentByEmail.bind(studentController));
router.get('/lookup', requireRole(Role.TUTOR), validate(inviteExistingStudentSchema, 'query'), studentController.lookupStudent.bind(studentController));
router.post('/invite-existing', requireRole(Role.TUTOR), validate(inviteExistingStudentSchema), studentController.inviteExistingStudent.bind(studentController));
router.get('/me/principal', requireRole(Role.STUDENT), studentController.getMyPrincipal.bind(studentController));
router.get('/me', requireRole(Role.STUDENT), studentController.getMyProfile.bind(studentController));
router.post('/me/accept-invite', requireRole(Role.STUDENT), studentController.acceptInvite.bind(studentController));
router.post('/me/decline-invite', requireRole(Role.STUDENT), studentController.declineInvite.bind(studentController));

router.get('/me/parent-requests', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const studentProfile = await StudentProfileModel.findOne({ userPublicId: req.user!.publicId, isDeleted: false }).lean();
    if (!studentProfile) throw new NotFoundError('Student profile not found');
    const requests = await parentService.getParentLinkRequests(studentProfile.publicId);
    sendSuccess(res, requests, 'Parent link requests fetched');
  } catch (e) { next(e); }
});

router.post('/me/parent-requests/:requestPublicId/approve', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const studentProfile = await StudentProfileModel.findOne({ userPublicId: req.user!.publicId, isDeleted: false }).lean();
    if (!studentProfile) throw new NotFoundError('Student profile not found');
    await parentService.approveParentLinkRequest(studentProfile.publicId, req.params.requestPublicId);
    sendSuccess(res, null, 'Parent link request approved');
  } catch (e) { next(e); }
});

router.post('/me/parent-requests/:requestPublicId/reject', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const studentProfile = await StudentProfileModel.findOne({ userPublicId: req.user!.publicId, isDeleted: false }).lean();
    if (!studentProfile) throw new NotFoundError('Student profile not found');
    await parentService.rejectParentLinkRequest(studentProfile.publicId, req.params.requestPublicId);
    sendSuccess(res, null, 'Parent link request rejected');
  } catch (e) { next(e); }
});
router.get('/pending', requirePermission(Permission.MANAGE_STUDENTS), studentController.listPending.bind(studentController));
router.get('/', requirePermission(Permission.MANAGE_STUDENTS), studentController.listAll.bind(studentController));
router.get('/my-students', requireRole(Role.TUTOR), studentController.getMyStudents.bind(studentController));
router.get('/:studentId', requirePermission(Permission.MANAGE_STUDENTS), studentController.getByPublicId.bind(studentController));
router.post('/:studentId/approve', requirePermission(Permission.MANAGE_STUDENTS), studentController.approveStudent.bind(studentController));
router.post('/:studentId/reject', requirePermission(Permission.MANAGE_STUDENTS), studentController.rejectStudent.bind(studentController));
router.post('/:studentId/suspend', requirePermission(Permission.MANAGE_STUDENTS), studentController.suspendStudent.bind(studentController));
router.post('/:studentId/transfer', requirePermission(Permission.MANAGE_STUDENTS), studentController.transferStudent.bind(studentController));
router.delete('/:studentId/unlink', requireRole(Role.TUTOR, Role.PRINCIPAL), studentController.unlinkStudent.bind(studentController));

router.patch('/:studentId/status', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body as { status: 'ACTIVE' | 'INACTIVE' };
    if (status !== 'ACTIVE' && status !== 'INACTIVE') {
      return next(new (await import('../../utils/error')).AppError('status must be ACTIVE or INACTIVE', 400));
    }
    const updated = await studentService.setStudentStatus(req.params.studentId, req.user!.publicId, status);
    sendSuccess(res, updated, `Student ${status.toLowerCase()}`);
  } catch (e) { next(e); }
});

export default router;
