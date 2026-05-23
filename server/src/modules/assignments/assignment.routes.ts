import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { Role } from '../../constants/roles';
import { assignmentService } from './assignment.service';
import { tutorService } from '../tutors/tutor.service';
import { studentService } from '../students/student.service';
import { sendSuccess, sendCreated } from '../../utils/response';

const router = Router();
router.use(authMiddleware);

// Tutor: create assignment
router.post('/', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    const assignment = await assignmentService.create(req.body, tutor.publicId);
    sendCreated(res, assignment, 'Assignment created');
  } catch (e) { next(e); }
});

// Tutor: list own assignments
router.get('/my', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    const assignments = await assignmentService.getByTutor(tutor.publicId);
    sendSuccess(res, assignments, 'Assignments fetched');
  } catch (e) { next(e); }
});

// Tutor: publish assignment
router.post('/:assignmentId/publish', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    const updated = await assignmentService.publish(req.params.assignmentId, tutor.publicId);
    sendSuccess(res, updated, 'Assignment published');
  } catch (e) { next(e); }
});

// Tutor: close assignment
router.post('/:assignmentId/close', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    const updated = await assignmentService.close(req.params.assignmentId, tutor.publicId);
    sendSuccess(res, updated, 'Assignment closed');
  } catch (e) { next(e); }
});

// Tutor: view submissions for an assignment
router.get('/:assignmentId/submissions', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const submissions = await assignmentService.getSubmissionsForAssignment(req.params.assignmentId);
    sendSuccess(res, submissions, 'Submissions fetched');
  } catch (e) { next(e); }
});

// Tutor: grade a submission
router.patch('/submissions/:submissionId/grade', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    const updated = await assignmentService.gradeSubmission(req.params.submissionId, tutor.publicId, req.body);
    sendSuccess(res, updated, 'Submission graded');
  } catch (e) { next(e); }
});

// Tutor: delete assignment
router.delete('/:assignmentId', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    await assignmentService.softDelete(req.params.assignmentId, tutor.publicId);
    sendSuccess(res, null, 'Assignment deleted');
  } catch (e) { next(e); }
});

// By class (tutor or student)
router.get('/class/:classId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const assignments = await assignmentService.getByClass(req.params.classId);
    sendSuccess(res, assignments, 'Assignments fetched');
  } catch (e) { next(e); }
});

// Student: submit
router.post('/:assignmentId/submit', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const student = await studentService.getByUserPublicId(req.user!.publicId);
    const submission = await assignmentService.submit(req.params.assignmentId, student.publicId, req.body);
    sendCreated(res, submission, 'Assignment submitted');
  } catch (e) { next(e); }
});

// Student: view own submission
router.get('/:assignmentId/my-submission', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const student = await studentService.getByUserPublicId(req.user!.publicId);
    const submission = await assignmentService.getMySubmission(req.params.assignmentId, student.publicId);
    sendSuccess(res, submission, 'Submission fetched');
  } catch (e) { next(e); }
});

// Get single assignment
router.get('/:assignmentId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const assignment = await assignmentService.getByPublicId(req.params.assignmentId);
    sendSuccess(res, assignment, 'Assignment fetched');
  } catch (e) { next(e); }
});

export default router;
