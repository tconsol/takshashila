import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import type { IParentProfile } from './parent.types';

const parentProfileSchema = new Schema<IParentProfile>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    userPublicId: { type: String, required: true, unique: true, index: true },
    childStudentPublicIds: [{ type: String }],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const ParentProfileModel = mongoose.model<IParentProfile>('ParentProfile', parentProfileSchema);
