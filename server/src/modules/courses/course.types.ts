export interface ICourseTopic {
  publicId: string;
  title: string;
  order: number;
  resourceIds: string[];
  assignmentIds: string[];
  worksheetIds: string[];
}

export interface ICourse {
  _id: string;
  publicId: string;
  country: string;
  state: string;
  countyFips: string;
  county: string;
  grade: string;
  subject: string;
  title: string;
  description?: string;
  topics: ICourseTopic[];
  createdByAdminPublicId: string;
  isPublished: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
