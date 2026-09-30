import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface ICountyAddition {
  publicId: string;
  stateCode: string;
  county: string;
  district: string;
  gradeFrom: number;
  gradeTo: number;
  category: string;
  subjectName?: string;
  description: string;
  topics: string[];
  isPublished: boolean;
  isDeleted: boolean;
}

const countyAdditionSchema = new Schema<ICountyAddition>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    stateCode: { type: String, required: true, uppercase: true, index: true },
    county: { type: String, required: true },
    district: { type: String, default: '' },
    gradeFrom: { type: Number, required: true, min: 0, max: 12 },
    gradeTo: { type: Number, required: true, min: 0, max: 12 },
    category: { type: String, required: true },
    subjectName: { type: String },
    description: { type: String, default: '' },
    topics: { type: [String], default: [] },
    isPublished: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'countyadditions' },
);

countyAdditionSchema.index({ stateCode: 1, county: 1, district: 1, gradeFrom: 1, gradeTo: 1, category: 1 }, { unique: true });

export const CountyAdditionModel = mongoose.model<ICountyAddition>('CountyAddition', countyAdditionSchema);
