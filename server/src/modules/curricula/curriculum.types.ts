export interface ICurriculumTopic {
  publicId: string;
  title: string;
  order: number;
}

export interface ICurriculum {
  _id: string;
  publicId: string;
  country: string;
  state: string;
  countyFips: string;
  county: string;
  districtId: string; // NCES LEAID; state/countyFips/county/district are derived from it
  district: string;
  grade: string;
  subject: string;
  title: string;
  description?: string;
  topics: ICurriculumTopic[];
  createdByAdminPublicId: string;
  isPublished: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
