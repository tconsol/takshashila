import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ClassType, ClassStatus, AvailabilityStatus } from './schedule.types';
import type { IAvailabilitySlot, IScheduledClass } from './schedule.types';

const availabilitySlotSchema = new Schema<IAvailabilitySlot>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    tutorPublicId: { type: String, required: true, index: true },
    startUTC: { type: Date, required: true, index: true },
    endUTC: { type: Date, required: true },
    ianaTimezone: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(AvailabilityStatus),
      default: AvailabilityStatus.AVAILABLE,
      index: true,
    },
    isRecurring: { type: Boolean, default: false },
    recurringRuleId: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

availabilitySlotSchema.index({ tutorPublicId: 1, startUTC: 1 });
availabilitySlotSchema.index({ tutorPublicId: 1, status: 1, startUTC: 1 });

const scheduledClassSchema = new Schema<IScheduledClass>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    tutorPublicId: { type: String, required: true, index: true },
    studentPublicId: { type: String, required: true, index: true },
    availabilitySlotPublicId: { type: String },
    classType: { type: String, enum: Object.values(ClassType), required: true },
    status: {
      type: String,
      enum: Object.values(ClassStatus),
      default: ClassStatus.SCHEDULED,
      index: true,
    },
    startUTC: { type: Date, required: true, index: true },
    endUTC: { type: Date, required: true },
    ianaTimezone: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String },
    meetingUrl: { type: String },
    meetingProvider: { type: String, enum: ['zoom', 'google_meet', 'native'] },
    meetingId: { type: String },
    recordingUrl: { type: String },
    recordingGcsKey: { type: String },
    costCents: { type: Number, default: 0 },
    idempotencyKey: { type: String, required: true, unique: true },
    studentJoinedAt: { type: Date },
    cancellationReason: { type: String },
    cancelledBy: { type: String },
    rescheduledFromId: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

scheduledClassSchema.index({ tutorPublicId: 1, startUTC: 1 });
scheduledClassSchema.index({ studentPublicId: 1, startUTC: 1 });
scheduledClassSchema.index({ status: 1, startUTC: 1 });

export const AvailabilitySlotModel = mongoose.model<IAvailabilitySlot>(
  'AvailabilitySlot',
  availabilitySlotSchema,
);

export const ScheduledClassModel = mongoose.model<IScheduledClass>(
  'ScheduledClass',
  scheduledClassSchema,
);
