// server/src/modules/programs/program.model.ts
import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ProgramCategory, ProgramLevel, ProgramStatus, EnrollmentStatus } from './program.types';
import type { IProgram, IProgramModule, IProgramEnrollment } from './program.types';

const moduleSchema = new Schema<IProgramModule>(
  {
    publicId: { type: String, default: uuidv4 },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    order: { type: Number, required: true },
  },
  { _id: false },
);

const programSchema = new Schema<IProgram>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    tutorPublicId: { type: String, required: true, index: true },
    title: { type: String, required: true, maxlength: 120 },
    category: { type: String, enum: Object.values(ProgramCategory), required: true },
    description: { type: String, maxlength: 4000 },
    level: { type: String, enum: Object.values(ProgramLevel), required: true },
    ageMin: { type: Number, min: 3, max: 99 },
    ageMax: { type: Number, min: 3, max: 99 },
    sessionCount: { type: Number, required: true, min: 1, max: 100 },
    sessionMinutes: { type: Number, required: true, min: 15, max: 240, default: 60 },
    priceCents: { type: Number, required: true, min: 0 },
    maxEnrollees: { type: Number, min: 1 },
    activeEnrollmentCount: { type: Number, default: 0, min: 0 },
    modules: { type: [moduleSchema], default: [] },
    status: { type: String, enum: Object.values(ProgramStatus), default: ProgramStatus.DRAFT, index: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);
programSchema.index({ status: 1, category: 1, level: 1 });
programSchema.index({ tutorPublicId: 1, createdAt: -1 });

const availabilitySchema = new Schema(
  {
    daysOfWeek: [{ type: Number, min: 0, max: 6 }],
    startLocalTime: { type: String, required: true },
    endLocalTime: { type: String, required: true },
    ianaTimezone: { type: String, required: true },
  },
  { _id: false },
);

const enrollmentSchema = new Schema<IProgramEnrollment>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    programPublicId: { type: String, required: true, index: true },
    tutorPublicId: { type: String, required: true, index: true },
    studentPublicId: { type: String, required: true, index: true },
    availabilityWindow: { type: availabilitySchema, required: true },
    sessionCount: { type: Number, required: true, min: 1 },
    priceCentsPaid: { type: Number, required: true, min: 0 },
    sessionsScheduledCount: { type: Number, default: 0, min: 0 },
    sessionsCompletedCount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: Object.values(EnrollmentStatus), default: EnrollmentStatus.ACTIVE, index: true },
    cancelledBy: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);
// One ACTIVE enrollment per student per program.
enrollmentSchema.index(
  { programPublicId: 1, studentPublicId: 1 },
  { unique: true, partialFilterExpression: { status: EnrollmentStatus.ACTIVE } },
);

export const ProgramModel = mongoose.model<IProgram>('Program', programSchema);
export const ProgramEnrollmentModel = mongoose.model<IProgramEnrollment>('ProgramEnrollment', enrollmentSchema);
