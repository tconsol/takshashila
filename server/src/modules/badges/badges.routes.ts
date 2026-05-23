import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import type { AuthRequest } from '../../shared/types';
import { JoinRequestModel } from '../join-requests/join-request.model';
import { JoinRequestStatus, JoinRequestInitiator } from '../join-requests/join-request.types';
import { TutorProfileModel } from '../tutors/tutor.model';
import { TutorStatus } from '../tutors/tutor.types';
import { PrincipalProfileModel } from '../principals/principal.model';
import { PrincipalStatus } from '../principals/principal.types';
import { StudentProfileModel } from '../students/student.model';
import { StudentStatus } from '../students/student.types';
import { TicketModel } from '../support/support.model';
import { TicketStatus } from '../support/support.types';
import { chatService } from '../chat/chat.service';
import { WorksheetModel, WorksheetSubmissionModel } from '../worksheets/worksheet.model';
import { WorksheetStatus } from '../worksheets/worksheet.types';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { publicId, role } = req.user!;
    const badges: Record<string, number> = {};

    // Unread chat messages — all roles
    const unreadMessages = await chatService.getTotalUnread(publicId).catch(() => 0);
    if (unreadMessages > 0) badges['messages'] = unreadMessages;

    if (role === 'PRINCIPAL') {
      const [joinRequests, pendingTutors] = await Promise.all([
        JoinRequestModel.countDocuments({
          principalUserPublicId: publicId,
          initiatedBy: JoinRequestInitiator.TUTOR,
          status: JoinRequestStatus.PENDING,
          isDeleted: false,
        }),
        TutorProfileModel.countDocuments({
          principalPublicId: publicId,
          status: TutorStatus.UNDER_VERIFICATION,
          isDeleted: false,
        }),
      ]);
      const tutorTotal = joinRequests + pendingTutors;
      if (tutorTotal > 0) badges['tutors'] = tutorTotal;

      // Count pending students via tutors under this principal
      const myTutorProfiles = await TutorProfileModel.find(
        { principalPublicId: publicId, isDeleted: false },
        { publicId: 1 },
      ).lean();
      if (myTutorProfiles.length > 0) {
        const tutorPublicIds = myTutorProfiles.map((t) => t.publicId);
        const pendingStudents = await StudentProfileModel.countDocuments({
          tutorPublicId: { $in: tutorPublicIds },
          status: StudentStatus.PENDING_APPROVAL,
          isDeleted: false,
        });
        if (pendingStudents > 0) badges['students'] = pendingStudents;
      }
    }

    if (role === 'TUTOR') {
      const tutorProfile = await TutorProfileModel.findOne({ userPublicId: publicId, isDeleted: false }, { publicId: 1 }).lean();
      const joinRequests = await JoinRequestModel.countDocuments({
        tutorUserPublicId: publicId,
        initiatedBy: JoinRequestInitiator.PRINCIPAL,
        status: JoinRequestStatus.PENDING,
        isDeleted: false,
      });
      if (joinRequests > 0) badges['principals'] = joinRequests;

      // New worksheet submissions for this tutor
      if (tutorProfile) {
        const tutorWorksheetIds = await WorksheetModel.distinct('publicId', {
          tutorPublicId: tutorProfile.publicId,
          status: WorksheetStatus.PUBLISHED,
          isDeleted: false,
        });
        const newSubmissions = await WorksheetSubmissionModel.countDocuments({
          worksheetPublicId: { $in: tutorWorksheetIds },
          isDeleted: false,
        });
        if (newSubmissions > 0) badges['worksheets'] = newSubmissions;
      }
    }

    if (role === 'STUDENT') {
      const studentProfile = await StudentProfileModel.findOne({ userPublicId: publicId, isDeleted: false }, { publicId: 1 }).lean();
      if (studentProfile) {
        const filter = {
          $or: [
            { assignedToStudentPublicIds: studentProfile.publicId },
            { assignedToStudentPublicIds: { $size: 0 } },
          ],
          status: WorksheetStatus.PUBLISHED,
          isDeleted: false,
        };
        const totalAssigned = await WorksheetModel.countDocuments(filter);
        const submitted = await WorksheetSubmissionModel.countDocuments({
          studentPublicId: studentProfile.publicId,
          isDeleted: false,
        });
        const pending = Math.max(0, totalAssigned - submitted);
        if (pending > 0) badges['worksheets'] = pending;
      }
    }

    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      const [pendingPrincipals, pendingTutors, openTickets, pendingStudents] = await Promise.all([
        PrincipalProfileModel.countDocuments({ status: PrincipalStatus.PENDING_APPROVAL, isDeleted: false }),
        TutorProfileModel.countDocuments({ status: TutorStatus.UNDER_VERIFICATION, isDeleted: false }),
        TicketModel.countDocuments({ status: TicketStatus.OPEN, isDeleted: false }),
        StudentProfileModel.countDocuments({ status: StudentStatus.PENDING_APPROVAL, isDeleted: false }),
      ]);
      if (pendingPrincipals > 0) badges['principals'] = pendingPrincipals;
      if (pendingTutors > 0) badges['tutors'] = pendingTutors;
      if (openTickets > 0) badges['support'] = openTickets;
      if (pendingStudents > 0) badges['students'] = pendingStudents;
    }

    if (role === 'SUPPORT') {
      const openTickets = await TicketModel.countDocuments({ status: TicketStatus.OPEN, isDeleted: false });
      if (openTickets > 0) badges['tickets'] = openTickets;
    }

    res.json({ success: true, data: badges });
  } catch (e) { next(e); }
});

export { router as badgesRouter };
