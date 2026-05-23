import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { PrincipalStatus } from './principal.types';
import type { IPrincipalProfile } from './principal.types';

const principalProfileSchema = new Schema<IPrincipalProfile>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    userPublicId: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: Object.values(PrincipalStatus),
      default: PrincipalStatus.PENDING_APPROVAL,
      index: true,
    },
    organizationName: { type: String },
    organizationWebsite: { type: String },
    bio: { type: String, maxlength: 1000 },
    commissionRatePercent: { type: Number, default: 15, min: 0, max: 100 },
    totalTutors: { type: Number, default: 0, min: 0 },
    totalStudents: { type: Number, default: 0, min: 0 },
    totalRevenueCents: { type: Number, default: 0, min: 0 },
    trustScore: { type: Number, default: 50, min: 0, max: 100 },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
  },
  { timestamps: true },
);

export const PrincipalProfileModel = mongoose.model<IPrincipalProfile>(
  'PrincipalProfile',
  principalProfileSchema,
);
