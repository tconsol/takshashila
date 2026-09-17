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
import { ScheduledClassModel } from '../schedules/schedule.model';
import { ClassStatus } from '../schedules/schedule.types';
import { AssignmentModel, SubmissionModel } from '../assignments/assignment.model';
import { AssignmentStatus, SubmissionStatus } from '../assignments/assignment.types';
import { ResourceModel } from '../resources/resource.model';

const router = Router();
router.use(authMiddleware);

/** Classes still ahead of the viewer — the "something landed on my calendar"
 *  signal for both sides of a booking. */
const OPEN_CLASS_FILTER = {
  status: { $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] },
  isDeleted: false,
};

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { publicId, role } = req.user!;
    const badges: Record<string, number> = {};

    // Unread chat messages all roles
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

        const openClasses = await ScheduledClassModel.countDocuments({
          tutorPublicId: { $in: tutorPublicIds },
          ...OPEN_CLASS_FILTER,
        });
        if (openClasses > 0) badges['classes'] = openClasses;
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
        const [newSubmissions, pendingStudents, openClasses, tutorAssignmentIds] = await Promise.all([
          WorksheetSubmissionModel.countDocuments({
            worksheetPublicId: { $in: tutorWorksheetIds },
            isDeleted: false,
          }),
          StudentProfileModel.countDocuments({
            tutorPublicId: tutorProfile.publicId,
            status: StudentStatus.PENDING_APPROVAL,
            isDeleted: false,
          }),
          ScheduledClassModel.countDocuments({
            tutorPublicId: tutorProfile.publicId,
            ...OPEN_CLASS_FILTER,
          }),
          AssignmentModel.distinct('publicId', {
            tutorPublicId: tutorProfile.publicId,
            status: AssignmentStatus.PUBLISHED,
            isDeleted: false,
          }),
        ]);
        if (newSubmissions > 0) badges['worksheets'] = newSubmissions;
        if (pendingStudents > 0) badges['students'] = pendingStudents;
        if (openClasses > 0) badges['classes'] = openClasses;

        // Work handed back by students that nobody has graded yet.
        const ungraded = await SubmissionModel.countDocuments({
          assignmentPublicId: { $in: tutorAssignmentIds },
          status: { $in: [SubmissionStatus.SUBMITTED, SubmissionStatus.LATE] },
          isDeleted: false,
        });
        if (ungraded > 0) badges['assignments'] = ungraded;
      }
    }

    if (role === 'STUDENT') {
      const studentProfile = await StudentProfileModel.findOne(
        { userPublicId: publicId, isDeleted: false },
        { publicId: 1, tutorPublicId: 1 },
      ).lean();
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

        const openClasses = await ScheduledClassModel.countDocuments({
          studentPublicId: studentProfile.publicId,
          ...OPEN_CLASS_FILTER,
        });
        if (openClasses > 0) badges['classes'] = openClasses;

        // Material the tutor has shared. Only meaningful once a tutor is linked.
        if (studentProfile.tutorPublicId) {
          const sharedResources = await ResourceModel.countDocuments({
            tutorPublicId: studentProfile.tutorPublicId,
            isDeleted: false,
          });
          if (sharedResources > 0) badges['resources'] = sharedResources;
        }
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
