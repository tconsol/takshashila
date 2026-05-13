export interface IParentProfile {
  _id: string;
  publicId: string;
  userPublicId: string;
  childStudentPublicIds: string[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateParentProfileDto {
  userPublicId: string;
}

export interface LinkChildDto {
  studentPublicId: string;
}
