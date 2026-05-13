import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import type { IRating } from './rating.types';

const ratingSchema = new Schema<IRating>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    classPublicId: { type: String, required: true, index: true },
    raterPublicId: { type: String, required: true },
    tutorPublicId: { type: String, required: true, index: true },
    score: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 1000 },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret: Record<string, unknown>) => { delete ret.__v; return ret; } },
  },
);

// One rating per student per class
ratingSchema.index({ classPublicId: 1, raterPublicId: 1 }, { unique: true });
ratingSchema.index({ tutorPublicId: 1, createdAt: -1 });

export const RatingModel = mongoose.model<IRating>('Rating', ratingSchema);

