import mongoose, { Schema } from 'mongoose';
import type { IDemoRequest } from './demo-request.types';

const demoRequestSchema = new Schema<IDemoRequest>(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    studentPublicId: { type: String, required: true, index: true },
    tutorPublicId: { type: String, required: true, index: true },
    availabilitySlotPublicId: { type: String, required: true },
    preferredSubject: { type: String, required: true },
    message: { type: String },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
      default: 'PENDING',
    },
    classPublicId: { type: String },
    rejectionReason: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const DemoRequestModel = mongoose.model<IDemoRequest>('DemoRequest', demoRequestSchema);
