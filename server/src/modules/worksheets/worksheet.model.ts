import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { WorksheetStatus } from './worksheet.types';
import type { IWorksheet } from './worksheet.types';

const worksheetSchema = new Schema<IWorksheet>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    tutorPublicId: { type: String, required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 2000 },
    content: { type: String, default: '', maxlength: 50000 },
    fileUrl: { type: String },
    subject: { type: String },
    sharedWithStudentPublicIds: [{ type: String }],
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

worksheetSchema.index({ tutorPublicId: 1, createdAt: -1 });
worksheetSchema.index({ sharedWithStudentPublicIds: 1, status: 1 });

export const WorksheetModel = mongoose.model<IWorksheet>('Worksheet', worksheetSchema);
