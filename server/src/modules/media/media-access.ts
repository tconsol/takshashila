// server/src/modules/media/media-access.ts
//
// Who may get a signed read URL for an uploaded file. A file is readable by its uploader,
// admins, and anyone who can see the thing it is attached to: a chat message (conversation
// participants), a resource / assignment / worksheet (material rules), or an assignment
// submission (the submitting student, their parents, and the tutor who grades it).
import { MediaFileModel } from './media.model';
import { MessageModel, ConversationModel } from '../chat/chat.model';
import { ResourceModel } from '../resources/resource.model';
import { AssignmentModel, SubmissionModel } from '../assignments/assignment.model';
import { WorksheetModel } from '../worksheets/worksheet.model';
import { StudentProfileModel } from '../students/student.model';
import { ParentProfileModel } from '../parents/parent.model';
import { TutorProfileModel } from '../tutors/tutor.model';
import * as access from '../courses/material-access';
import type { Viewer } from '../courses/material-access';

export async function canReadMedia(viewer: Viewer, mediaPublicId: string): Promise<boolean> {
  const media = await MediaFileModel.findOne({ publicId: mediaPublicId, isDeleted: false }).lean();
  if (!media) return false;
  if (viewer.role === 'ADMIN' || viewer.role === 'SUPER_ADMIN') return true;
  if (media.uploaderPublicId === viewer.userPublicId) return true;

  const message = await MessageModel.findOne({ mediaPublicId }, { conversationPublicId: 1 }).lean();
  if (message) {
    const conversation = await ConversationModel.findOne({ publicId: message.conversationPublicId }, { participantPublicIds: 1 }).lean();
    return !!conversation?.participantPublicIds.includes(viewer.userPublicId);
  }

  const resource = await ResourceModel.findOne({ mediaPublicId, isDeleted: false }).lean();
  if (resource) return access.canViewMaterial(viewer, resource, 'resource');

  const assignment = await AssignmentModel.findOne({
    $or: [{ filePublicId: mediaPublicId }, { attachmentPublicIds: mediaPublicId }],
    isDeleted: false,
  }).lean();
  if (assignment) return access.canViewMaterial(viewer, assignment, 'assignment');

  const worksheet = await WorksheetModel.findOne({ filePublicId: mediaPublicId, isDeleted: false }).lean();
  if (worksheet) return access.canViewMaterial(viewer, worksheet, 'worksheet');

  const submission = await SubmissionModel.findOne({ attachmentPublicIds: mediaPublicId, isDeleted: false }).lean();
  if (submission) return canReadSubmission(viewer, submission);

  return false;
}

async function canReadSubmission(
  viewer: Viewer,
  submission: { studentPublicId: string; assignmentPublicId: string; graderTutorPublicId?: string },
): Promise<boolean> {
  if (viewer.role === 'STUDENT') {
    const s = await StudentProfileModel.findOne({ userPublicId: viewer.userPublicId, isDeleted: false }).lean();
    return s?.publicId === submission.studentPublicId;
  }
  if (viewer.role === 'PARENT') {
    const p = await ParentProfileModel.findOne({ userPublicId: viewer.userPublicId, isDeleted: false }).lean();
    return !!p?.childStudentPublicIds?.includes(submission.studentPublicId);
  }
  if (viewer.role === 'TUTOR' || viewer.role === 'PRINCIPAL') {
    const tutor = await TutorProfileModel.findOne({ userPublicId: viewer.userPublicId, isDeleted: false }).lean();
    if (!tutor) return false;
    if (submission.graderTutorPublicId === tutor.publicId) return true;
    const assignment = await AssignmentModel.findOne({ publicId: submission.assignmentPublicId }).lean();
    return assignment?.tutorPublicId === tutor.publicId;
  }
  return false;
}
