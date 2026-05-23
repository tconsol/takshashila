import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { JoinRequestStatus, JoinRequestInitiator } from './join-request.types';
import type { IJoinRequest } from './join-request.types';

const joinRequestSchema = new Schema<IJoinRequest>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    tutorUserPublicId: { type: String, required: true, index: true },
    tutorProfilePublicId: { type: String, required: true },
    principalUserPublicId: { type: String, required: true, index: true },
    principalProfilePublicId: { type: String, required: true },
    initiatedBy: { type: String, enum: Object.values(JoinRequestInitiator), required: true },
    status: {
      type: String,
      enum: Object.values(JoinRequestStatus),
      default: JoinRequestStatus.PENDING,
      index: true,
    },
    message: { type: String, maxlength: 500 },
    rejectionReason: { type: String, maxlength: 500 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

joinRequestSchema.index({ tutorUserPublicId: 1, principalProfilePublicId: 1, status: 1 });
joinRequestSchema.index({ principalUserPublicId: 1, status: 1 });

export const JoinRequestModel = mongoose.model<IJoinRequest>('JoinRequest', joinRequestSchema);
