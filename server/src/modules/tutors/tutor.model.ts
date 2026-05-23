import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { TutorStatus } from './tutor.types';
import type { ITutorProfile } from './tutor.types';

const tutorProfileSchema = new Schema<ITutorProfile>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    userPublicId: { type: String, required: true, unique: true, index: true },
    principalPublicId: { type: String, index: true },
    status: {
      type: String,
      enum: Object.values(TutorStatus),
      default: TutorStatus.REGISTERED,
      index: true,
    },
    subjects: [{ type: String, trim: true }],
    languages: [{ type: String, trim: true }],
    hourlyRateCents: { type: Number, default: 0, min: 0 },
    commissionRatePercent: { type: Number, default: 20, min: 0, max: 100 },
    bio: { type: String, maxlength: 1000 },
    qualifications: [{ type: String }],
    timezone: { type: String, default: 'UTC' },
    trustScore: { type: Number, default: 50, min: 0, max: 100 },
    totalStudents: { type: Number, default: 0, min: 0 },
    totalClassesCompleted: { type: Number, default: 0, min: 0 },
    totalClassesCancelled: { type: Number, default: 0, min: 0 },
    totalEarningsCents: { type: Number, default: 0, min: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    verifiedBy: { type: String },
    invitedBy: { type: String },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
  },
  { timestamps: true },
);

tutorProfileSchema.index({ principalPublicId: 1, status: 1 });
tutorProfileSchema.index({ subjects: 1, status: 1 });
tutorProfileSchema.index({ languages: 1, status: 1 });
tutorProfileSchema.index({ rating: -1, trustScore: -1 });

export const TutorProfileModel = mongoose.model<ITutorProfile>('TutorProfile', tutorProfileSchema);
