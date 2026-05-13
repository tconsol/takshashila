import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { StudentStatus } from './student.types';
import type { IStudentProfile } from './student.types';

const studentProfileSchema = new Schema<IStudentProfile>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    userPublicId: { type: String, required: true, index: true },
    tutorPublicId: { type: String, required: true, index: true },
    previousTutorPublicIds: [{ type: String }],
    status: {
      type: String,
      enum: Object.values(StudentStatus),
      default: StudentStatus.PENDING_APPROVAL,
      index: true,
    },
    demoClassesUsed: { type: Number, default: 0, min: 0 },
    demoClassTakenWith: [{ type: String }],
    totalClassesAttended: { type: Number, default: 0, min: 0 },
    totalClassesMissed: { type: Number, default: 0, min: 0 },
    totalClassesBooked: { type: Number, default: 0, min: 0 },
    attendanceRate: { type: Number, default: 0, min: 0, max: 100 },
    grade: { type: String },
    notes: { type: String, maxlength: 2000 },
    invitedBy: { type: String, required: true },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    transferredFrom: { type: String },
    transferredAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
  },
  { timestamps: true },
);

studentProfileSchema.index({ tutorPublicId: 1, status: 1 });
studentProfileSchema.index({ userPublicId: 1, tutorPublicId: 1 }, { unique: true, sparse: true });

export const StudentProfileModel = mongoose.model<IStudentProfile>('StudentProfile', studentProfileSchema);
