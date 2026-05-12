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
import { NotFoundError, ConflictError, AppError } from '../../utils/error';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';

export class AssignmentService {
  async create(dto: CreateAssignmentDto, tutorPublicId: string): Promise<IAssignment> {
    const assignment = await AssignmentModel.create({
      publicId: uuidv4(),
      classPublicId: dto.classPublicId,
      tutorPublicId,
      title: dto.title,
      description: dto.description,
      dueDate: new Date(dto.dueDate),
      maxScore: dto.maxScore ?? 100,
      attachmentPublicIds: dto.attachmentPublicIds ?? [],
      status: AssignmentStatus.DRAFT,
      isDeleted: false,
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
    if (existing) {
      const updated = await SubmissionModel.findOneAndUpdate(
        { assignmentPublicId, studentPublicId },
        {
          $set: {
            content: dto.content,
            attachmentPublicIds: dto.attachmentPublicIds ?? [],
            submittedAt: new Date(),
            status: new Date() > assignment.dueDate ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED,
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
      status: new Date() > assignment.dueDate ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED,
      isDeleted: false,
    });

    domainEvents.emit(DomainEvent.ASSIGNMENT_SUBMITTED, {
      assignmentPublicId,
      studentPublicId,
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
    if (!assignment || assignment.tutorPublicId !== tutorPublicId) {
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

  async getSubmissionsForAssignment(assignmentPublicId: string): Promise<ISubmission[]> {
    return SubmissionModel.find({ assignmentPublicId, isDeleted: false })
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
