export interface IResource {
  _id: string;
  publicId: string;
  tutorPublicId: string;
  classPublicId?: string;
  title: string;
  description?: string;
  mediaPublicId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  fileUrl?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateResourceDto {
  classPublicId?: string;
  title: string;
  description?: string;
  mediaPublicId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface UpdateResourceDto {
  title?: string;
  description?: string;
}
