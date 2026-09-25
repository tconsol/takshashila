import { v4 as uuidv4 } from 'uuid';
import { AssignmentModel, SubmissionModel } from './assignment.model';
import { AssignmentStatus, SubmissionStatus } from './assignment.types';
import type {
  IAssignment,
  ISubmission,
  CreateAssignmentDto,
  SubmitAssignmentDto,
  GradeSubmissionDto,
} from './assignment.types';
import { NotFoundError, ConflictError, AppError, ValidationError } from '../../utils/error';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { resolveTutorAttachment } from '../curricula/curriculum-attachment';
import { resolveAdminAttachment } from '../curricula/curriculum-attachment';
import * as access from '../courses/material-access';
import type { TutorAuthor } from '../../shared/material.types';

/** Curriculum assignments may have no due date — those are never late. */
const isLate = (dueDate?: Date) => !!dueDate && new Date() > dueDate;

export class AssignmentService {
  async create(dto: CreateAssignmentDto, tutor: TutorAuthor): Promise<IAssignment> {
    const attachment = await resolveTutorAttachment(tutor, dto);
    const assignment = await AssignmentModel.create({
      publicId: uuidv4(),
      classPublicId: dto.classPublicId,
      tutorPublicId: tutor.publicId,
      title: dto.title,
      description: dto.description,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      maxScore: dto.maxScore ?? 100,
      attachmentPublicIds: dto.attachmentPublicIds ?? [],
      isFileAttachment: dto.isFileAttachment ?? false,
      filePublicId: dto.filePublicId,
      fileMimeType: dto.fileMimeType,
      fileOriginalName: dto.fileOriginalName,
      status: AssignmentStatus.DRAFT,
      isDeleted: false,
      ...attachment,
      authorRole: 'TUTOR',
      authorUserPublicId: tutor.userPublicId,
    });
    return assignment.toObject();
  }

  async createForCurriculum(adminUserPublicId: string, curriculumPublicId: string, dto: CreateAssignmentDto): Promise<IAssignment> {
    const attachment = await resolveAdminAttachment(curriculumPublicId, dto.topicPublicIds);
    if (!dto.title?.trim() || !dto.description?.trim()) throw new ValidationError({ title: ['Title and description are required'] });
    const assignment = await AssignmentModel.create({
      publicId: uuidv4(),
      title: dto.title,
      description: dto.description,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      maxScore: dto.maxScore ?? 100,
      attachmentPublicIds: dto.attachmentPublicIds ?? [],
      isFileAttachment: dto.isFileAttachment ?? false,
      filePublicId: dto.filePublicId,
      fileMimeType: dto.fileMimeType,
      fileOriginalName: dto.fileOriginalName,
      status: AssignmentStatus.PUBLISHED,
      isDeleted: false,
      ...attachment,
      authorRole: 'ADMIN',
      authorUserPublicId: adminUserPublicId,
    });
    return assignment.toObject();
  }

  async publish(publicId: string, tutorPublicId: string): Promise<IAssignment> {
    const assignment = await AssignmentModel.findOne({ publicId, tutorPublicId, isDeleted: false });
    if (!assignment) throw new NotFoundError('Assignment');
    if (assignment.status !== AssignmentStatus.DRAFT) {
      throw new AppError('Only draft assignments can be published', 409);
    }
    const updated = await AssignmentModel.findOneAndUpdate(
      { publicId },
      { $set: { status: AssignmentStatus.PUBLISHED } },
      { new: true },
    ).lean();
    return updated!;
  }

  async close(publicId: string, tutorPublicId: string): Promise<IAssignment> {
    const updated = await AssignmentModel.findOneAndUpdate(
      { publicId, tutorPublicId, isDeleted: false },
      { $set: { status: AssignmentStatus.CLOSED } },
      { new: true },
    ).lean();
    if (!updated) throw new NotFoundError('Assignment');
    return updated;
  }

  async getByClass(classPublicId: string): Promise<IAssignment[]> {
    return AssignmentModel.find({
      classPublicId,
      isDeleted: false,
      status: { $ne: AssignmentStatus.DRAFT },
    }).sort({ createdAt: -1 }).lean();
  }

  async getByTutor(tutorPublicId: string): Promise<IAssignment[]> {
    return AssignmentModel.find({ tutorPublicId, isDeleted: false })
      .sort({ createdAt: -1 })
      .lean();
  }

  async getByPrincipal(
    principalUserPublicId: string,
    query: { tutorPublicId?: string } = {},
  ): Promise<Array<IAssignment & { tutorName: string; submissionCount: number }>> {
    const { tutorRepository } = await import('../tutors/tutor.repository');
    const { UserModel } = await import('../users/user.model');
    const tutorsResult = await tutorRepository.findByPrincipal(principalUserPublicId, { page: 1, limit: 500 } as never);
    const tutorPublicIds = tutorsResult.items.map((t) => t.publicId);
    if (tutorPublicIds.length === 0) return [];

    const filter: Record<string, unknown> = {
      tutorPublicId: query.tutorPublicId ? query.tutorPublicId : { $in: tutorPublicIds },
      isDeleted: false,
    };
    const items = await AssignmentModel.find(filter).sort({ createdAt: -1 }).lean();

    // Enrich
    const tutorUserMap = new Map(tutorsResult.items.map((t) => [t.publicId, t.userPublicId]));
    const userPublicIds = [...new Set(tutorsResult.items.map((t) => t.userPublicId))];
    const users = await UserModel.find({ publicId: { $in: userPublicIds } }, { publicId: 1, firstName: 1, lastName: 1 }).lean();
    const userNameMap = new Map(users.map((u) => [u.publicId, `${u.firstName} ${u.lastName}`.trim()]));

    const assignmentIds = items.map((a) => a.publicId);
    const subAgg = await SubmissionModel.aggregate([
      { $match: { assignmentPublicId: { $in: assignmentIds }, isDeleted: false, submittedAt: { $ne: null } } },
      { $group: { _id: '$assignmentPublicId', count: { $sum: 1 } } },
    ]);
    const subMap = new Map(subAgg.map((s) => [s._id as string, s.count as number]));

    return items.map((a) => ({
      ...a,
      tutorName: userNameMap.get(tutorUserMap.get(a.tutorPublicId ?? '') ?? '') ?? 'Unknown Tutor',
      submissionCount: subMap.get(a.publicId) ?? 0,
    }));
  }

  async getByPublicId(publicId: string): Promise<IAssignment> {
    const assignment = await AssignmentModel.findOne({ publicId, isDeleted: false }).lean();
    if (!assignment) throw new NotFoundError('Assignment');
    return assignment;
  }

  async submit(
    assignmentPublicId: string,
    studentPublicId: string,
    dto: SubmitAssignmentDto,
  ): Promise<ISubmission> {
    const assignment = await AssignmentModel.findOne({ publicId: assignmentPublicId, isDeleted: false });
    if (!assignment) throw new NotFoundError('Assignment');
    if (assignment.status !== AssignmentStatus.PUBLISHED) {
      throw new AppError('Assignment is not open for submissions', 422);
    }

    const existing = await SubmissionModel.findOne({ assignmentPublicId, studentPublicId, isDeleted: false });

    // Admin (curriculum) items are graded by the tutor of the student's course. Keep the
    // first grader on resubmission so a submission never switches tutors mid-grading.
    const graderTutorPublicId = assignment.authorRole === 'ADMIN' && !existing?.graderTutorPublicId
      ? await access.findGraderTutor(studentPublicId, assignment)
      : undefined;
    const grader = graderTutorPublicId ? { graderTutorPublicId } : {};
    if (existing) {
      const updated = await SubmissionModel.findOneAndUpdate(
        { assignmentPublicId, studentPublicId },
        {
          $set: {
            content: dto.content,
            attachmentPublicIds: dto.attachmentPublicIds ?? [],
            submittedAt: new Date(),
            status: isLate(assignment.dueDate) ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED,
            ...grader,
          },
        },
        { new: true },
      ).lean();
      return updated!;
    }

    const submission = await SubmissionModel.create({
      publicId: uuidv4(),
      assignmentPublicId,
      studentPublicId,
      content: dto.content,
      attachmentPublicIds: dto.attachmentPublicIds ?? [],
      submittedAt: new Date(),
      status: isLate(assignment.dueDate) ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED,
      isDeleted: false,
      ...grader,
    });

    domainEvents.emit(DomainEvent.ASSIGNMENT_SUBMITTED, {
      assignmentPublicId,
      studentPublicId,
      ...grader,
    });

    return submission.toObject();
  }

  async gradeSubmission(
    submissionPublicId: string,
    tutorPublicId: string,
    dto: GradeSubmissionDto,
  ): Promise<ISubmission> {
    const submission = await SubmissionModel.findOne({ publicId: submissionPublicId, isDeleted: false });
    if (!submission) throw new NotFoundError('Submission');

    const assignment = await AssignmentModel.findOne({ publicId: submission.assignmentPublicId });
    const allowed = !!assignment && (
      assignment.tutorPublicId === tutorPublicId ||
      (assignment.authorRole === 'ADMIN' && submission.graderTutorPublicId === tutorPublicId)
    );
    if (!assignment || !allowed) {
      throw new AppError('Not authorized to grade this submission', 403);
    }
    if (dto.score > assignment.maxScore) {
      throw new AppError(`Score cannot exceed maximum of ${assignment.maxScore}`, 422);
    }

    const updated = await SubmissionModel.findOneAndUpdate(
      { publicId: submissionPublicId },
      {
        $set: {
          score: dto.score,
          feedback: dto.feedback,
          gradedBy: tutorPublicId,
          gradedAt: new Date(),
          status: SubmissionStatus.GRADED,
        },
      },
      { new: true },
    ).lean();
    return updated!;
  }

  async getSubmissionsForAssignment(assignmentPublicId: string, tutorPublicId: string): Promise<ISubmission[]> {
    const assignment = await AssignmentModel.findOne({ publicId: assignmentPublicId, isDeleted: false }).lean();
    const isAdminItem = assignment?.authorRole === 'ADMIN';
    if (!assignment || (!isAdminItem && assignment.tutorPublicId !== tutorPublicId)) throw new NotFoundError('Assignment');
    // Admin (curriculum) assignments: each tutor sees only the students they grade.
    return SubmissionModel.find({ assignmentPublicId, isDeleted: false, ...(isAdminItem ? { graderTutorPublicId: tutorPublicId } : {}) })
      .sort({ submittedAt: -1 })
      .lean();
  }

  async getMySubmission(assignmentPublicId: string, studentPublicId: string): Promise<ISubmission | null> {
    return SubmissionModel.findOne({ assignmentPublicId, studentPublicId, isDeleted: false }).lean();
  }

  async softDelete(publicId: string, tutorPublicId: string): Promise<void> {
    const result = await AssignmentModel.updateOne(
      { publicId, tutorPublicId, isDeleted: false },
      { $set: { isDeleted: true } },
    );
    if (result.matchedCount === 0) throw new NotFoundError('Assignment');
  }
}

export const assignmentService = new AssignmentService();
