import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import type { ICourse, ICourseTopic } from './course.types';

const courseTopicSchema = new Schema<ICourseTopic>(
  {
    publicId: { type: String, default: uuidv4 },
    title: { type: String, required: true },
    order: { type: Number, required: true },
    resourceIds: [{ type: String }],
    assignmentIds: [{ type: String }],
    worksheetIds: [{ type: String }],
  },
  { _id: false },
);

const courseSchema = new Schema<ICourse>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    county: { type: String, required: true, index: true },
    grade: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    topics: [courseTopicSchema],
    createdByAdminPublicId: { type: String, required: true },
    isPublished: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

courseSchema.index({ county: 1, grade: 1, isPublished: 1 });

export const CourseModel = mongoose.model<ICourse>('Course', courseSchema);
