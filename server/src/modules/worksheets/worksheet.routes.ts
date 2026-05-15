import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { Role } from '../../constants/roles';
import { worksheetService } from './worksheet.service';
import { tutorService } from '../tutors/tutor.service';
import { studentService } from '../students/student.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';
import { getIO } from '../../sockets/socket.handler';
import { StudentProfileModel } from '../students/student.model';

const router = Router();
router.use(authMiddleware);

// ─── Tutor: create worksheet/assignment ──────────────────────────────────────

router.post('/', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    const worksheet = await worksheetService.create(tutor.publicId, req.body);

    // Notify assigned students (or all students of this tutor) via socket
    try {
      const io = getIO();
      const studentPublicIds = worksheet.assignedToStudentPublicIds.length > 0
        ? worksheet.assignedToStudentPublicIds
        : (await StudentProfileModel.find({ tutorPublicId: tutor.publicId, isDeleted: false }, { userPublicId: 1 }).lean()).map((s) => s.userPublicId);

      for (const spid of studentPublicIds) {
        io.to(`user:${spid}`).emit('worksheet:new', {
          worksheetPublicId: worksheet.publicId,
          title: worksheet.title,
          type: worksheet.type,
          subject: worksheet.subject,
        });
      }
    } catch { /* socket notify is best-effort */ }

    sendCreated(res, worksheet, `${worksheet.type === 'ASSIGNMENT' ? 'Assignment' : 'Worksheet'} created`);
  } catch (e) { next(e); }
});

// ─── Tutor: list own worksheets ───────────────────────────────────────────────

router.get('/my', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    const result = await worksheetService.getByTutor(tutor.publicId, req.query as Record<string, string>);
    sendPaginated(res, result, 'Worksheets fetched');
  } catch (e) { next(e); }
});

// ─── Tutor: delete worksheet ──────────────────────────────────────────────────

router.delete('/:worksheetId', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    await worksheetService.softDelete(req.params.worksheetId, tutor.publicId);
    sendSuccess(res, null, 'Worksheet deleted');
  } catch (e) { next(e); }
});

// ─── Tutor: get submissions for a worksheet ───────────────────────────────────

router.get('/:worksheetId/submissions', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    const submissions = await worksheetService.getSubmissionsForWorksheet(req.params.worksheetId, tutor.publicId);
    sendSuccess(res, submissions, 'Submissions fetched');
  } catch (e) { next(e); }
});

// ─── Student: list own worksheets (with submission status) ───────────────────

router.get('/student/me', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const student = await studentService.getByUserPublicId(req.user!.publicId);
    const result = await worksheetService.getForStudent(student.publicId, req.query as Record<string, string>);
    sendPaginated(res, result, 'Worksheets fetched');
  } catch (e) { next(e); }
});

// ─── Student: submit answers ──────────────────────────────────────────────────

router.post('/:worksheetId/submit', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const student = await studentService.getByUserPublicId(req.user!.publicId);
    const submission = await worksheetService.submitAnswers(
      req.params.worksheetId,
      student.publicId,
      req.body,
    );

    // Notify tutor via socket
    try {
      const worksheet = await worksheetService.getByPublicId(req.params.worksheetId);
      const io = getIO();
      const { tutorRepository } = await import('../tutors/tutor.repository');
      const tutorProfile = await tutorRepository.findByPublicId(worksheet.tutorPublicId).catch(() => null);
      if (tutorProfile) {
        io.to(`user:${tutorProfile.userPublicId}`).emit('worksheet:submitted', {
          worksheetPublicId: worksheet.publicId,
          worksheetTitle: worksheet.title,
          studentPublicId: student.publicId,
          score: submission.score,
        });
      }
    } catch { /* best-effort */ }

    sendCreated(res, submission, 'Answers submitted');
  } catch (e) { next(e); }
});

// ─── Student: get own submission ──────────────────────────────────────────────

router.get('/:worksheetId/my-submission', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const student = await studentService.getByUserPublicId(req.user!.publicId);
    const submission = await worksheetService.getMySubmission(req.params.worksheetId, student.publicId);
    sendSuccess(res, submission, 'Submission fetched');
  } catch (e) { next(e); }
});

// ─── Shared: get single worksheet ────────────────────────────────────────────

router.get('/:worksheetId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const worksheet = await worksheetService.getByPublicId(req.params.worksheetId);
    sendSuccess(res, worksheet, 'Worksheet fetched');
  } catch (e) { next(e); }
});

export default router;
