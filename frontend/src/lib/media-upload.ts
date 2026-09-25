// frontend/src/lib/media-upload.ts
//
// Signed-URL upload flows shared by tutor and admin material forms.
import { api } from './axios';

function getMediaType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'DOCUMENT';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  return 'DOCUMENT';
}

export async function uploadResourceFile(file: File, onProgress: (pct: number) => void): Promise<{ mediaPublicId: string; fileName: string; mimeType: string; sizeBytes: number }> {
  const { data: urlRes } = await api.post('/media/upload-url', {
    originalName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    mediaType: getMediaType(file.type),
  });
  const { uploadUrl, gcsObjectKey } = urlRes.data as { uploadUrl: string; gcsObjectKey: string };

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(file);
  });

  const { data: confirmRes } = await api.post('/media/confirm', {
    gcsObjectKey,
    originalName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    mediaType: getMediaType(file.type),
  });
  return {
    mediaPublicId: (confirmRes.data as { publicId: string }).publicId,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

export async function uploadDocument(file: File): Promise<{ filePublicId: string; fileMimeType: string; fileOriginalName: string }> {
  const { data: urlData } = await api.post('/media/upload-url', {
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    mediaType: 'DOCUMENT',
  });
  const { uploadUrl, gcsObjectKey } = urlData.data;
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  const { data: confirmData } = await api.post('/media/confirm', {
    gcsObjectKey,
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    mediaType: 'DOCUMENT',
  });
  return { filePublicId: confirmData.data.publicId, fileMimeType: file.type || 'application/octet-stream', fileOriginalName: file.name };
}
