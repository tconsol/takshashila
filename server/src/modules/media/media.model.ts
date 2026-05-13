import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { MediaType, MediaStatus } from './media.types';
import type { IMediaFile } from './media.types';

const mediaFileSchema = new Schema<IMediaFile>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    uploaderPublicId: { type: String, required: true, index: true },
    mediaType: { type: String, enum: Object.values(MediaType), required: true },
    status: { type: String, enum: Object.values(MediaStatus), default: MediaStatus.PENDING },
    originalName: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true, maxlength: 100 },
    sizeBytes: { type: Number, required: true, min: 1 },
    gcsBucket: { type: String, required: true },
    gcsObjectKey: { type: String, required: true, unique: true, index: true },
    entityPublicId: { type: String, index: true },
    entityType: { type: String, maxlength: 50 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret: Record<string, unknown>) => { delete ret.__v; return ret; } },
  },
);

mediaFileSchema.index({ uploaderPublicId: 1, createdAt: -1 });
mediaFileSchema.index({ entityPublicId: 1, mediaType: 1, isDeleted: 1 });
mediaFileSchema.index({ status: 1, createdAt: 1 });

export const MediaFileModel = mongoose.model<IMediaFile>('MediaFile', mediaFileSchema);

