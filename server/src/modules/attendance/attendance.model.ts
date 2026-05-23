import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { AttendanceStatus, AttendanceSource } from './attendance.types';
import type { IAttendance } from './attendance.types';

const attendanceSchema = new Schema<IAttendance>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    classPublicId: { type: String, required: true, index: true },
    studentPublicId: { type: String, required: true, index: true },
    tutorPublicId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: Object.values(AttendanceStatus),
      required: true,
    },
    source: {
      type: String,
      enum: Object.values(AttendanceSource),
      default: AttendanceSource.AUTOMATIC,
    },
    joinedAt: { type: Date },
    leftAt: { type: Date },
    durationPresentMinutes: { type: Number, default: 0, min: 0 },
    overriddenBy: { type: String },
    overriddenAt: { type: Date },
    remarks: { type: String, maxlength: 500 },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret: Record<string, unknown>) => { delete ret.__v; return ret; } },
  },
);

attendanceSchema.index({ classPublicId: 1, studentPublicId: 1 }, { unique: true, sparse: true });
attendanceSchema.index({ studentPublicId: 1, createdAt: -1 });
attendanceSchema.index({ tutorPublicId: 1, createdAt: -1 });

export const AttendanceModel = mongoose.model<IAttendance>('Attendance', attendanceSchema);

