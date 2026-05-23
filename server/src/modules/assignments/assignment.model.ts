import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { AssignmentStatus, SubmissionStatus } from './assignment.types';
import type { IAssignment, ISubmission } from './assignment.types';

const assignmentSchema = new Schema<IAssignment>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    classPublicId: { type: String, required: true, index: true },
    tutorPublicId: { type: String, required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 5000 },
    dueDate: { type: Date, required: true },
    maxScore: { type: Number, default: 100, min: 1 },
    attachmentPublicIds: [{ type: String }],
    status: {
      type: String,
      enum: Object.values(AssignmentStatus),
      default: AssignmentStatus.DRAFT,
    },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret: Record<string, unknown>) => { delete ret.__v; return ret; } },
  },
);

assignmentSchema.index({ classPublicId: 1, status: 1 });
assignmentSchema.index({ tutorPublicId: 1, createdAt: -1 });

const submissionSchema = new Schema<ISubmission>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    assignmentPublicId: { type: String, required: true, index: true },
    studentPublicId: { type: String, required: true, index: true },
    content: { type: String, maxlength: 10000 },
    attachmentPublicIds: [{ type: String }],
    submittedAt: { type: Date },
    score: { type: Number, min: 0 },
    feedback: { type: String, maxlength: 2000 },
    gradedBy: { type: String },
    gradedAt: { type: Date },
    status: {
      type: String,
      enum: Object.values(SubmissionStatus),
      default: SubmissionStatus.NOT_SUBMITTED,
    },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret: Record<string, unknown>) => { delete ret.__v; return ret; } },
  },
);

submissionSchema.index({ assignmentPublicId: 1, studentPublicId: 1 }, { unique: true });

export const AssignmentModel = mongoose.model<IAssignment>('Assignment', assignmentSchema);
export const SubmissionModel = mongoose.model<ISubmission>('Submission', submissionSchema);

