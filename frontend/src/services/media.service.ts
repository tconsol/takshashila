import { api } from '../lib/axios';

export interface MediaFile {
  publicId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  mediaType: string;
  status: 'PENDING' | 'UPLOADED' | 'DELETED';
  gcsObjectKey: string;
  entityPublicId?: string;
  entityType?: string;
  createdAt: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  gcsObjectKey: string;
  expiresInSeconds: number;
}

export const mediaService = {
  requestUploadUrl: (dto: {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    mediaType: string;
    entityPublicId?: string;
    entityType?: string;
  }) =>
    api.post<{ data: UploadUrlResponse }>('/media/upload-url', dto).then((r) => r.data.data),

  uploadToGcs: async (uploadUrl: string, file: File): Promise<void> => {
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    }).then((res) => {
      if (!res.ok) throw new Error(`GCS upload failed: ${res.status}`);
    });
  },

  confirmUpload: (dto: {
    gcsObjectKey: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    mediaType: string;
    entityPublicId?: string;
    entityType?: string;
  }) =>
    api.post<{ data: MediaFile }>('/media/confirm', dto).then((r) => r.data.data),

  getReadUrl: (fileId: string) =>
    api.get<{ data: { url: string } }>(`/media/${fileId}/read-url`).then((r) => r.data.data.url),

  getByEntity: (entityId: string) =>
    api.get<{ data: MediaFile[] }>(`/media/entity/${entityId}`).then((r) => r.data.data),

  deleteFile: (fileId: string) =>
    api.delete(`/media/${fileId}`),

  uploadFile: async (
    file: File,
    mediaType: string,
    entityPublicId?: string,
    entityType?: string,
  ): Promise<MediaFile> => {
    const { uploadUrl, gcsObjectKey } = await mediaService.requestUploadUrl({
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      mediaType,
      entityPublicId,
      entityType,
    });
    await mediaService.uploadToGcs(uploadUrl, file);
    return mediaService.confirmUpload({
      gcsObjectKey,
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      mediaType,
      entityPublicId,
      entityType,
    });
  },
};

