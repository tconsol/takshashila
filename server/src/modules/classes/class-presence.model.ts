import mongoose, { Schema } from 'mongoose';
import type { PresenceInterval } from './class-presence';

/**
 * When one person was present in one live room. Kept in the database (not in
 * socket memory) because Cloud Run may serve each request on a different
 * instance. `roomKey` is the group's shared id, or the class id for a single class.
 */
export interface IClassPresence {
  roomKey: string;
  userPublicId: string;
  role: 'TUTOR' | 'STUDENT';
  intervals: PresenceInterval[];
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const classPresenceSchema = new Schema<IClassPresence>(
  {
    roomKey: { type: String, required: true },
    userPublicId: { type: String, required: true },
    role: { type: String, enum: ['TUTOR', 'STUDENT'], required: true },
    intervals: { type: [{ _id: false, start: Date, end: Date }], default: [] },
    lastSeenAt: { type: Date, required: true },
  },
  { timestamps: true },
);

classPresenceSchema.index({ roomKey: 1, userPublicId: 1 }, { unique: true });

export const ClassPresenceModel = mongoose.model<IClassPresence>('ClassPresence', classPresenceSchema);
