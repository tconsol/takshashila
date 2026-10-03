export interface ICurriculumTopic {
  publicId: string;
  title: string;
  order: number;
}

export interface ICurriculumChapter {
  publicId: string;
  title: string;
  order: number;
  topics: ICurriculumTopic[];
}

export interface ICurriculumSource {
  name: string;
  year: number | null;
  url: string;
}

/** One master curriculum per state, subject and grade (or high school course). */
export interface ICurriculum {
  _id: string;
  publicId: string;
  country: string;
  /** USPS state code: the anchor of every curriculum. */
  stateCode: string;
  grade: string;
  subject: string;
  title: string;
  description?: string;
  /** Flat mirror of `chapters` (chapter ids); courses and materials still reference chapters through it. */
  topics: ICurriculumTopic[];
  level: 'KINDERGARTEN' | 'GRADE' | 'HIGH_SCHOOL';
  courseName?: string;
  /** High school only: the lowest grade the course appears in ('Grade 9'..'Grade 12'). */
  usualGrade?: string;
  source?: ICurriculumSource;
  sourceKind?: 'revised' | 'master';
  chapters: ICurriculumChapter[];
  createdByAdminPublicId: string;
  isPublished: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Grade value of high school curricula (organised by course, not by grade). */
export const HIGH_SCHOOL_GRADE = 'High School';

export const levelForGrade = (grade: string): ICurriculum['level'] =>
  grade === HIGH_SCHOOL_GRADE ? 'HIGH_SCHOOL' : grade === 'Kindergarten' ? 'KINDERGARTEN' : 'GRADE';
