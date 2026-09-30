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

export interface ICurriculum {
  _id: string;
  publicId: string;
  country: string;
  state?: string;
  countyFips?: string;
  county?: string;
  districtId?: string; // NCES LEAID; state/countyFips/county/district are derived from it
  district?: string;
  grade: string;
  subject: string;
  title: string;
  description?: string;
  topics: ICurriculumTopic[];
  stateCode?: string;
  level?: 'KINDERGARTEN' | 'GRADE' | 'HIGH_SCHOOL';
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

/** Grade value of imported high school curricula (organised by course, not by grade). */
export const HIGH_SCHOOL_GRADE = 'High School';
