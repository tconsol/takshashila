import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { WorksheetStatus, WorksheetType } from './worksheet.types';
import type { IWorksheet, IWorksheetSubmission } from './worksheet.types';

const questionSchema = new Schema(
  {
    questionText: { type: String, required: true, maxlength: 2000 },
    options: {
      type: [{ type: String, maxlength: 500 }],
      validate: { validator: (v: string[]) => v.length === 4, message: 'Exactly 4 options required' },
    },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    explanation: { type: String, default: '', maxlength: 2000 },
  },
  { _id: false },
);

const worksheetSchema = new Schema<IWorksheet>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    tutorPublicId: { type: String, required: true, index: true },
    classPublicId: { type: String, index: true },
    title: { type: String, required: true, maxlength: 200 },
    subject: { type: String, maxlength: 100 },
    type: {
      type: String,
      enum: Object.values(WorksheetType),
      default: WorksheetType.WORKSHEET,
      index: true,
    },
    dueDate: { type: Date },
    questions: { type: [questionSchema], default: [] },
    isFileAttachment: { type: Boolean, default: false },
    filePublicId: { type: String },
    fileMimeType: { type: String },
    fileOriginalName: { type: String },
    assignedToStudentPublicIds: [{ type: String }],
    status: {
      type: String,
      enum: Object.values(WorksheetStatus),
      default: WorksheetStatus.DRAFT,
      index: true,
    },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret: Record<string, unknown>) => { delete ret.__v; return ret; } },
  },
);

worksheetSchema.index({ tutorPublicId: 1, type: 1, createdAt: -1 });
worksheetSchema.index({ assignedToStudentPublicIds: 1, status: 1 });
worksheetSchema.index({ classPublicId: 1 });

const submissionSchema = new Schema<IWorksheetSubmission>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    worksheetPublicId: { type: String, required: true, index: true },
    studentPublicId: { type: String, required: true, index: true },
    answers: [{ type: Number }],
    score: { type: Number, required: true, min: 0, max: 100 },
    correctCount: { type: Number, required: true, min: 0 },
    totalQuestions: { type: Number, required: true, min: 0 },
    timeTakenSeconds: { type: Number },
    submittedAt: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret: Record<string, unknown>) => { delete ret.__v; return ret; } },
  },
);

submissionSchema.index({ worksheetPublicId: 1, studentPublicId: 1 }, { unique: true });

export const WorksheetModel = mongoose.model<IWorksheet>('Worksheet', worksheetSchema);
export const WorksheetSubmissionModel = mongoose.model<IWorksheetSubmission>('WorksheetSubmission', submissionSchema);
