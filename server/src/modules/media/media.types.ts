export const MediaType = {
  AVATAR: 'AVATAR',
  DOCUMENT: 'DOCUMENT',
  VIDEO: 'VIDEO',
  ASSIGNMENT_SUBMISSION: 'ASSIGNMENT_SUBMISSION',
  CLASS_RECORDING: 'CLASS_RECORDING',
} as const;
export type MediaType = (typeof MediaType)[keyof typeof MediaType];

export const MediaStatus = {
  PENDING: 'PENDING',
  UPLOADED: 'UPLOADED',
  DELETED: 'DELETED',
} as const;
export type MediaStatus = (typeof MediaStatus)[keyof typeof MediaStatus];

export interface IMediaFile {
  _id: string;
  publicId: string;
  uploaderPublicId: string;
  mediaType: MediaType;
  status: MediaStatus;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  gcsBucket: string;
  gcsObjectKey: string;
  /** publicId of the entity this file belongs to (class, assignment, user, etc.) */
  entityPublicId?: string;
  entityType?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequestUploadUrlDto {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  mediaType: MediaType;
  entityPublicId?: string;
  entityType?: string;
}

export interface ConfirmUploadDto {
  gcsObjectKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  mediaType: MediaType;
  entityPublicId?: string;
  entityType?: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  gcsObjectKey: string;
  expiresInSeconds: number;
}
