import { api } from '../lib/axios';

const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const MAX_VIDEO_BYTES = 5 * 1024 * 1024;   // 5 MB
const MAX_BYTES = 50 * 1024 * 1024;         // 50 MB

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

export function validateChatFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return `${file.type || 'This file type'} is not supported. Allowed: images, videos, PDFs, Word, PowerPoint.`;
  }
  if (VIDEO_TYPES.has(file.type) && file.size > MAX_VIDEO_BYTES) {
    return `Videos must be under 5 MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`;
  }
  if (file.size > MAX_BYTES) {
    return `File must be under 50 MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`;
  }
  return null;
}

export interface UploadedChatMedia {
  mediaPublicId: string;
  mediaMimeType: string;
  mediaName: string;
  mediaSizeBytes: number;
}

export async function uploadChatMedia(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<UploadedChatMedia> {
  // 1. Request signed upload URL
  const { data: urlRes } = await api.post('/media/upload-url', {
    originalName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    mediaType: 'CHAT',
  });
  const { uploadUrl, gcsObjectKey } = urlRes.data as { uploadUrl: string; gcsObjectKey: string };

  // 2. PUT directly to GCS (no auth header)
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`GCS upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });

  // 3. Confirm upload
  const { data: confirmRes } = await api.post('/media/confirm', { gcsObjectKey });
  const mediaFile = confirmRes.data as { publicId: string };

  return {
    mediaPublicId: mediaFile.publicId,
    mediaMimeType: file.type,
    mediaName: file.name,
    mediaSizeBytes: file.size,
  };
}

export async function getMediaReadUrl(mediaPublicId: string): Promise<string> {
  const { data } = await api.get(`/media/${mediaPublicId}/read-url`);
  return (data.data as { url: string }).url;
}
