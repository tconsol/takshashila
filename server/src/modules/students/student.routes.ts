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
import { createStudentByTutorSchema, inviteExistingStudentSchema, createStudentByPrincipalSchema, inviteStudentByPrincipalSchema, updateMyStudentProfileSchema, setStudentLocationSchema } from './student.validators';
import { parentService } from '../parents/parent.service';
import { StudentProfileModel } from './student.model';
import { NotFoundError } from '../../utils/error';
import { sendSuccess } from '../../utils/response';

const router = Router();
router.use(authMiddleware);

router.post('/', requireRole(Role.TUTOR, Role.PRINCIPAL), validate(createStudentByTutorSchema), studentController.createStudent.bind(studentController));
router.post('/principal/create', requireRole(Role.PRINCIPAL), validate(createStudentByPrincipalSchema), studentController.createStudentByPrincipal.bind(studentController));
router.post('/principal/invite', requireRole(Role.PRINCIPAL), validate(inviteStudentByPrincipalSchema), studentController.inviteExistingByPrincipal.bind(studentController));
router.get('/principal/my-students', requireRole(Role.PRINCIPAL), studentController.getMyStudentsAsPrincipal.bind(studentController));
router.get('/principal/search-parent', requireRole(Role.PRINCIPAL), studentController.searchParentByEmail.bind(studentController));
router.get('/lookup', requireRole(Role.TUTOR, Role.PRINCIPAL), validate(inviteExistingStudentSchema, 'query'), studentController.lookupStudent.bind(studentController));
router.post('/invite-existing', requireRole(Role.TUTOR, Role.PRINCIPAL), validate(inviteExistingStudentSchema), studentController.inviteExistingStudent.bind(studentController));
router.get('/me/principal', requireRole(Role.STUDENT), studentController.getMyPrincipal.bind(studentController));
router.get('/me', requireRole(Role.STUDENT), studentController.getMyProfile.bind(studentController));
router.patch('/me', requireRole(Role.STUDENT), validate(updateMyStudentProfileSchema), studentController.updateMyProfile.bind(studentController));
// Tutor links (see StudentTutorLink on the frontend). A link is addressed by the student profile id.
router.get('/me/tutor-links', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await studentService.getMyTutorLinks(req.user!.publicId), 'Tutor links fetched');
  } catch (e) { next(e); }
});
router.post('/me/tutor-links/:linkId/accept', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await studentService.acceptInvite(req.user!.publicId, req.params.linkId), 'Invite accepted');
  } catch (e) { next(e); }
});
router.post('/me/tutor-links/:linkId/decline', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await studentService.declineInvite(req.user!.publicId, req.params.linkId);
    sendSuccess(res, null, 'Invite declined');
  } catch (e) { next(e); }
});
router.delete('/me/tutor-links/:linkId', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await studentService.unlinkOwnTutor(req.user!.publicId, req.params.linkId);
    sendSuccess(res, null, 'Tutor unlinked');
  } catch (e) { next(e); }
});
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

router.get('/me/parents', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const studentProfile = await StudentProfileModel.findOne({ userPublicId: req.user!.publicId, isDeleted: false }).lean();
    if (!studentProfile) throw new NotFoundError('Student profile not found');
    sendSuccess(res, await parentService.getLinkedParents(studentProfile.publicId), 'Linked parents fetched');
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
router.get('/my-students', requireRole(Role.TUTOR, Role.PRINCIPAL), studentController.getMyStudents.bind(studentController));
router.get('/:studentId', requirePermission(Permission.MANAGE_STUDENTS), studentController.getByPublicId.bind(studentController));
router.post('/:studentId/approve', requirePermission(Permission.MANAGE_STUDENTS), studentController.approveStudent.bind(studentController));
router.post('/:studentId/reject', requirePermission(Permission.MANAGE_STUDENTS), studentController.rejectStudent.bind(studentController));
router.post('/:studentId/suspend', requirePermission(Permission.MANAGE_STUDENTS), studentController.suspendStudent.bind(studentController));
router.post('/:studentId/transfer', requirePermission(Permission.MANAGE_STUDENTS), studentController.transferStudent.bind(studentController));
router.delete('/:studentId/unlink', requireRole(Role.TUTOR, Role.PRINCIPAL), studentController.unlinkStudent.bind(studentController));

router.patch('/:studentId/location', requireRole(Role.TUTOR, Role.PRINCIPAL), validate(setStudentLocationSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await studentService.setStudentLocation(req.params.studentId, { userPublicId: req.user!.publicId, role: req.user!.role }, req.body);
    sendSuccess(res, updated, 'Student location updated');
  } catch (e) { next(e); }
});

router.patch('/:studentId/status', requireRole(Role.TUTOR, Role.PRINCIPAL), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body as { status: 'ACTIVE' | 'INACTIVE' };
    if (status !== 'ACTIVE' && status !== 'INACTIVE') {
      return next(new (await import('../../utils/error')).AppError('status must be ACTIVE or INACTIVE', 400));
    }
    const updated = await studentService.setStudentStatus(req.params.studentId, { userPublicId: req.user!.publicId, role: req.user!.role }, status);
    sendSuccess(res, updated, `Student ${status.toLowerCase()}`);
  } catch (e) { next(e); }
});

export default router;
