import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type LinkRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface IParentLinkRequest {
  publicId: string;
  parentUserPublicId: string;
  studentPublicId: string;
  status: LinkRequestStatus;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IParentLinkRequest>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    parentUserPublicId: { type: String, required: true, index: true },
    studentPublicId: { type: String, required: true, index: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

schema.index({ parentUserPublicId: 1, studentPublicId: 1, status: 1 });

export const ParentLinkRequestModel = mongoose.model<IParentLinkRequest>('ParentLinkRequest', schema);
