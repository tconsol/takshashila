import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import type { ICurriculum, ICurriculumChapter, ICurriculumTopic } from './curriculum.types';

const curriculumTopicSchema = new Schema<ICurriculumTopic>(
  {
    publicId: { type: String, default: uuidv4 },
    title: { type: String, required: true },
    order: { type: Number, required: true },
  },
  { _id: false },
);

const curriculumChapterSchema = new Schema<ICurriculumChapter>(
  {
    publicId: { type: String, default: uuidv4 },
    title: { type: String, required: true },
    order: { type: Number, required: true },
    topics: [curriculumTopicSchema],
  },
  { _id: false },
);

const curriculumSchema = new Schema<ICurriculum>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    country: { type: String, required: true, default: 'US' },
    stateCode: { type: String, required: true, index: true, uppercase: true },
    grade: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    topics: [curriculumTopicSchema],
    level: { type: String, enum: ['KINDERGARTEN', 'GRADE', 'HIGH_SCHOOL'], required: true },
    courseName: { type: String },
    usualGrade: { type: String },
    source: {
      type: new Schema({ name: String, year: Number, url: String }, { _id: false }),
    },
    sourceKind: { type: String, enum: ['revised', 'master'] },
    chapters: {
      type: [curriculumChapterSchema],
      validate: {
        // Keeps `topics` mirrored from `chapters` under validateSync() as well as validate().
        validator: function (this: { chapters?: ICurriculumChapter[]; topics: unknown }, chapters: ICurriculumChapter[]) {
          if (chapters && chapters.length > 0) {
            this.topics = chapters.map((c) => ({ publicId: c.publicId, title: c.title, order: c.order }));
          }
          return true;
        },
      },
    },
    createdByAdminPublicId: { type: String, required: true },
    isPublished: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

curriculumSchema.pre('validate', function (next) {
  if (this.chapters && this.chapters.length > 0) {
    this.topics = this.chapters.map((c) => ({ publicId: c.publicId, title: c.title, order: c.order })) as never;
  }
  next();
});

curriculumSchema.index({ stateCode: 1, grade: 1, subject: 1, isPublished: 1 });

export const CurriculumModel = mongoose.model<ICurriculum>('Curriculum', curriculumSchema, 'curricula');
