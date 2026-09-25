import mongoose, { Schema } from 'mongoose';
import type { ICourse, IAvailabilityWindow } from './course.types';
import { CourseStatus } from './course.types';

const availabilityWindowSchema = new Schema<IAvailabilityWindow>(
  {
    daysOfWeek: [{ type: Number, min: 0, max: 6 }],
    startLocalTime: { type: String, required: true },
    endLocalTime: { type: String, required: true },
    ianaTimezone: { type: String, required: true },
  },
  { _id: false },
);

const courseSchema = new Schema<ICourse>(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    studentPublicId: { type: String, required: true, index: true },
    tutorPublicId: { type: String, required: true, index: true },
    curriculumPublicId: { type: String, required: true, index: true },
    topicPublicIds: [{ type: String }],
    availabilityWindow: { type: availabilityWindowSchema, required: true },
    status: {
      type: String,
      enum: Object.values(CourseStatus),
      default: CourseStatus.PENDING,
      index: true,
    },
    classesRequired: { type: Number, min: 1 },
    classesScheduledCount: { type: Number, default: 0, min: 0 },
    classesCompletedCount: { type: Number, default: 0, min: 0 },
    costCentsPerClass: { type: Number, min: 0 },
    totalCostCentsCharged: { type: Number, min: 0 },
    rejectionReason: { type: String },
    acceptedAt: { type: Date }, // when the tutor accepted; picks the grader for admin items
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

courseSchema.index({ studentPublicId: 1, status: 1 });
courseSchema.index({ tutorPublicId: 1, status: 1 });

export const CourseModel = mongoose.model<ICourse>('Course', courseSchema);
