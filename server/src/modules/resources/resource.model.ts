import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import type { IResource } from './resource.types';

const resourceSchema = new Schema<IResource>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    tutorPublicId: { type: String, index: true }, // absent on admin-authored curriculum items
    curriculumPublicId: { type: String, index: true },
    topicPublicIds: [{ type: String }],
    authorRole: { type: String, enum: ['TUTOR', 'ADMIN'], default: 'TUTOR' },
    authorUserPublicId: { type: String },
    classPublicId: { type: String, index: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    mediaPublicId: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret: Record<string, unknown>) => { delete ret.__v; return ret; } },
  },
);

resourceSchema.index({ tutorPublicId: 1, createdAt: -1 });
resourceSchema.index({ curriculumPublicId: 1, topicPublicIds: 1, isDeleted: 1 });
// classPublicId already indexed via `index: true` on the field above.

export const ResourceModel = mongoose.model<IResource>('Resource', resourceSchema);
