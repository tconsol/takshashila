import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import type { ICurriculum, ICurriculumTopic } from './curriculum.types';

const curriculumTopicSchema = new Schema<ICurriculumTopic>(
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

const curriculumSchema = new Schema<ICurriculum>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    country: { type: String, required: true, default: 'US' },
    state: { type: String, required: true, index: true },
    countyFips: { type: String, required: true, index: true },
    county: { type: String, required: true }, // display name, derived from countyFips
    districtId: { type: String, required: true, index: true },
    district: { type: String, required: true }, // display name, derived from districtId
    grade: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    topics: [curriculumTopicSchema],
    createdByAdminPublicId: { type: String, required: true },
    isPublished: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

curriculumSchema.index({ districtId: 1, grade: 1, isPublished: 1 });

export const CurriculumModel = mongoose.model<ICurriculum>('Curriculum', curriculumSchema, 'curricula');
