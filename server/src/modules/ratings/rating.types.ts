export interface IRating {
  _id: string;
  publicId: string;
  classPublicId: string;
  raterPublicId: string;
  tutorPublicId: string;
  score: number;
  comment?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmitRatingDto {
  classPublicId: string;
  score: number;
  comment?: string;
}
