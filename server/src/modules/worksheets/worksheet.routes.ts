import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { Role } from '../../constants/roles';
import { worksheetService } from './worksheet.service';
import { tutorService } from '../tutors/tutor.service';
import { studentService } from '../students/student.service';
import { assertCanViewMaterial } from '../courses/assert-material-access';
import { canViewMaterial } from '../courses/material-access';
import { notificationService } from '../notifications/notification.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';
import { NotFoundError } from '../../utils/error';
import { getIO } from '../../sockets/socket.handler';
import { realtime } from '../realtime/realtime.service';
import { StudentProfileModel } from '../students/student.model';
import { UserModel } from '../users/user.model';

const router = Router();
router.use(authMiddleware);

// ─── Tutor: create worksheet/assignment ──────────────────────────────────────

router.post('/', requireRole(Role.TUTOR, Role.PRINCIPAL), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    const worksheet = await worksheetService.create(tutor, req.body);

    // Tell the students it was given to: a live alert plus a saved notification.
    // Assignments hold student profile ids; notifications and sockets are addressed by user id.
    // Only students who can actually open it are told, so an alert never leads to an empty list.
    try {
      const studentUserPublicIds = [...new Set((await StudentProfileModel.find(
        worksheet.assignedToStudentPublicIds.length > 0
          ? { publicId: { $in: worksheet.assignedToStudentPublicIds }, isDeleted: false }
          : { tutorPublicId: tutor.publicId, isDeleted: false },
        { userPublicId: 1 },
      ).lean()).map((s) => s.userPublicId))];

      const recipients: string[] = [];
      for (const uid of studentUserPublicIds) {
        if (await canViewMaterial({ role: 'STUDENT', userPublicId: uid }, worksheet, 'worksheet')) recipients.push(uid);
      }

      const label = worksheet.type === 'ASSIGNMENT' ? 'assignment' : 'worksheet';
      await Promise.all(recipients.map((uid) => notificationService.create({
        recipientPublicId: uid,
        type: 'ASSIGNMENT_PUBLISHED',
        title: `New ${label}: ${worksheet.title}`,
        body: `Your tutor assigned you a new ${label}${worksheet.subject ? ` in ${worksheet.subject}` : ''}.${worksheet.dueDate ? ` Due ${new Date(worksheet.dueDate).toDateString()}.` : ''}`,
        data: { worksheetPublicId: worksheet.publicId, link: '/dashboard/student/worksheets' },
      }).catch(() => undefined)));

      for (const uid of recipients) {
        void realtime.emitTo(`user:${uid}`, 'worksheet:new', {
          worksheetPublicId: worksheet.publicId,
          title: worksheet.title,
          type: worksheet.type,
          subject: worksheet.subject,
        });
      }
    } catch { /* notifying is best-effort */ }

    sendCreated(res, worksheet, `${worksheet.type === 'ASSIGNMENT' ? 'Assignment' : 'Worksheet'} created`);
  } catch (e) { next(e); }
});

// ─── Tutor: list own worksheets ───────────────────────────────────────────────

router.get('/my', requireRole(Role.TUTOR, Role.PRINCIPAL), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    const result = await worksheetService.getByTutor(tutor.publicId, req.query as Record<string, string>);
    sendPaginated(res, result, 'Worksheets fetched');
  } catch (e) { next(e); }
});

// ─── Tutor: delete worksheet ──────────────────────────────────────────────────

router.delete('/:worksheetId', requireRole(Role.TUTOR, Role.PRINCIPAL), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    await worksheetService.softDelete(req.params.worksheetId, tutor.publicId);
    sendSuccess(res, null, 'Worksheet deleted');
  } catch (e) { next(e); }
});

// ─── Tutor: get submissions for a worksheet ───────────────────────────────────

router.get('/:worksheetId/submissions', requireRole(Role.TUTOR, Role.PRINCIPAL), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
    const submissions = await worksheetService.getSubmissionsForWorksheet(req.params.worksheetId, tutor.publicId);

    // Enrich with student names
    const studentPublicIds = [...new Set(submissions.map((s) => s.studentPublicId))];
    const studentProfiles = await StudentProfileModel.find(
      { publicId: { $in: studentPublicIds }, isDeleted: false },
      { publicId: 1, userPublicId: 1 },
    ).lean();
    const userPublicIds = studentProfiles.map((sp) => sp.userPublicId);
    const users = await UserModel.find(
      { publicId: { $in: userPublicIds } },
      { publicId: 1, firstName: 1, lastName: 1 },
    ).lean();

    const spMap = new Map(studentProfiles.map((sp) => [sp.publicId, sp.userPublicId]));
    const userMap = new Map(users.map((u) => [u.publicId, `${u.firstName} ${u.lastName}`.trim()]));

    const enriched = submissions.map((s) => ({
      ...s,
      studentName: userMap.get(spMap.get(s.studentPublicId) ?? '') ?? 'Unknown Student',
    }));

    sendSuccess(res, enriched, 'Submissions fetched');
  } catch (e) { next(e); }
});

// ─── Student: list own worksheets (with submission status) ───────────────────

router.get('/student/me', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // A student has one profile per tutor link: list worksheets from every linked tutor.
    const profileIds = await studentService.getProfileIdsByUser(req.user!.publicId);
    if (profileIds.length === 0) throw new NotFoundError('Student profile');
    const result = await worksheetService.getForStudent(profileIds, req.query as Record<string, string>);
    sendPaginated(res, result, 'Worksheets fetched');
  } catch (e) { next(e); }
});

// ─── Student: submit answers ──────────────────────────────────────────────────

router.post('/:worksheetId/submit', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const target = await worksheetService.getByPublicId(req.params.worksheetId);
    await assertCanViewMaterial(req.user!, target, 'worksheet');
    // Record the submission on the profile linked to this worksheet's tutor, so it shows in their list.
    const profiles = await StudentProfileModel.find(
      { userPublicId: req.user!.publicId, isDeleted: false },
      { publicId: 1, tutorPublicId: 1 },
    ).lean();
    const studentPublicId = await worksheetService.pickStudentProfileFor(target, profiles);
    if (!studentPublicId) throw new NotFoundError('Student profile');
    const student = { publicId: studentPublicId };
    const submission = await worksheetService.submitAnswers(
      req.params.worksheetId,
      student.publicId,
      req.body,
      profiles.map((p) => p.publicId),
    );

    // Notify tutor via socket
    try {
      const worksheet = await worksheetService.getByPublicId(req.params.worksheetId);
      const { tutorRepository } = await import('../tutors/tutor.repository');
      // Curriculum (admin) worksheets have no owner — notify the tutor who grades this student.
      const notifyTutorId = worksheet.tutorPublicId ?? submission.graderTutorPublicId;
      const tutorProfile = notifyTutorId
        ? await tutorRepository.findByPublicId(notifyTutorId).catch(() => null)
        : null;
      if (tutorProfile) {
        void realtime.emitTo(`user:${tutorProfile.userPublicId}`, 'worksheet:submitted', {
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
    const profileIds = await studentService.getProfileIdsByUser(req.user!.publicId);
    if (profileIds.length === 0) throw new NotFoundError('Student profile');
    const submission = await worksheetService.getMySubmission(req.params.worksheetId, profileIds);
    sendSuccess(res, submission, 'Submission fetched');
  } catch (e) { next(e); }
});

// ─── Principal: list worksheets across all their tutors ──────────────────────

router.get('/principal/all', requireRole(Role.PRINCIPAL), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await worksheetService.getByPrincipal(req.user!.publicId, req.query as Record<string, string>);
    sendPaginated(res, result, 'Worksheets fetched');
  } catch (e) { next(e); }
});

// ─── Shared: get single worksheet ────────────────────────────────────────────

router.get('/:worksheetId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const worksheet = await worksheetService.getByPublicId(req.params.worksheetId);
    await assertCanViewMaterial(req.user!, worksheet, 'worksheet');
    sendSuccess(res, worksheet, 'Worksheet fetched');
  } catch (e) { next(e); }
});

export default router;
