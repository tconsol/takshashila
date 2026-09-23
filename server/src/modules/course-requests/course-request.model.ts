import mongoose, { Schema } from 'mongoose';
import type { ICourseRequest, IAvailabilityWindow } from './course-request.types';
import { CourseRequestStatus } from './course-request.types';

const availabilityWindowSchema = new Schema<IAvailabilityWindow>(
  {
    daysOfWeek: [{ type: Number, min: 0, max: 6 }],
    startLocalTime: { type: String, required: true },
    endLocalTime: { type: String, required: true },
    ianaTimezone: { type: String, required: true },
  },
  { _id: false },
);

const courseRequestSchema = new Schema<ICourseRequest>(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    studentPublicId: { type: String, required: true, index: true },
    tutorPublicId: { type: String, required: true, index: true },
    coursePublicId: { type: String, required: true, index: true },
    selectedTopicPublicIds: [{ type: String }],
    availabilityWindow: { type: availabilityWindowSchema, required: true },
    status: {
      type: String,
      enum: Object.values(CourseRequestStatus),
      default: CourseRequestStatus.PENDING,
      index: true,
    },
    classesRequired: { type: Number, min: 1 },
    classesScheduledCount: { type: Number, default: 0, min: 0 },
    classesCompletedCount: { type: Number, default: 0, min: 0 },
    costCentsPerClass: { type: Number, min: 0 },
    totalCostCentsCharged: { type: Number, min: 0 },
    rejectionReason: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

courseRequestSchema.index({ studentPublicId: 1, status: 1 });
courseRequestSchema.index({ tutorPublicId: 1, status: 1 });

export const CourseRequestModel = mongoose.model<ICourseRequest>('CourseRequest', courseRequestSchema);
