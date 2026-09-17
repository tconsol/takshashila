import { api } from '../lib/api';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';

export interface UploadResult {
  mediaPublicId: string;
  mediaMimeType: string;
  mediaName: string;
  mediaSizeBytes: number;
}

export interface ValidateFileResult {
  valid: boolean;
  error?: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'audio/mp4', 'audio/mpeg', 'audio/webm', 'audio/wav', 'audio/x-m4a',
];

export async function validateChatFile(file: { mimeType: string; size: number; name: string }): Promise<ValidateFileResult> {
  if (!ALLOWED_MIME_TYPES.includes(file.mimeType)) {
    return { valid: false, error: 'File type not supported. Allowed: images, videos, PDFs, Word docs, PowerPoint.' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File too large. Maximum size is 50MB.' };
  }
  return { valid: true };
}

export async function uploadChatMedia(
  file: { uri: string; mimeType: string; name: string; size: number },
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  // Resolve the real byte size (pickers/voice notes often report 0).
  let sizeBytes = file.size;
  if (!sizeBytes || sizeBytes <= 0) {
    try {
      const info = await FileSystem.getInfoAsync(file.uri);
      if (info.exists && typeof info.size === 'number') sizeBytes = info.size;
    } catch {
      // keep whatever we had
    }
  }

  // 1. Request a signed upload URL. Chat attachments all use the CHAT media type.
  const { data: urlRes } = await api.post('/media/upload-url', {
    originalName: file.name,
    mimeType: file.mimeType,
    sizeBytes,
    mediaType: 'CHAT',
  });
  const { uploadUrl, gcsObjectKey } = urlRes.data;

  // 2. PUT the RAW file bytes to GCS. The v4 signed URL signs Content-Type,
  //    so we must send the exact mime and raw bytes (NOT multipart/form-data).
  await uploadToGCS(uploadUrl, file.uri, file.mimeType, onProgress);

  // 3. Confirm the upload.
  const { data: confirmRes } = await api.post('/media/confirm', {
    gcsObjectKey,
    originalName: file.name,
    mimeType: file.mimeType,
    sizeBytes,
    mediaType: 'CHAT',
  });

  const mediaPublicId = confirmRes.data?.publicId ?? confirmRes.publicId;

  return {
    mediaPublicId,
    mediaMimeType: file.mimeType,
    mediaName: file.name,
    mediaSizeBytes: sizeBytes,
  };
}

async function uploadToGCS(
  uploadUrl: string,
  uri: string,
  mimeType: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const task = FileSystem.createUploadTask(
    uploadUrl,
    uri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': mimeType },
    },
    (data) => {
      if (onProgress && data.totalBytesExpectedToSend > 0) {
        onProgress(Math.round((data.totalBytesSent / data.totalBytesExpectedToSend) * 100));
      }
    },
  );

  const res = await task.uploadAsync();
  if (!res || res.status < 200 || res.status >= 300) {
    throw new Error(`Upload failed with status ${res?.status ?? 'unknown'}`);
  }
}

export async function pickImage(): Promise<{ uri: string; mimeType: string; name: string; size: number } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.9,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType || 'image/jpeg',
    name: asset.fileName || `image_${Date.now()}.jpg`,
    size: asset.fileSize || 0,
  };
}

export async function pickVideo(): Promise<{ uri: string; mimeType: string; name: string; size: number } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsEditing: false,
    quality: 0.9,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType || 'video/mp4',
    name: asset.fileName || `video_${Date.now()}.mp4`,
    size: asset.fileSize || 0,
  };
}

export async function pickDocument(): Promise<{ uri: string; mimeType: string; name: string; size: number } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/*',
      'video/*',
    ],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType || 'application/octet-stream',
    name: asset.name || `document_${Date.now()}`,
    size: asset.size || 0,
  };
}

// ── Voice recording (expo-av) ────────────────────────────────────────────────
let activeRecording: Audio.Recording | null = null;

export async function startVoiceRecording(): Promise<boolean> {
  try {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) return false;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await rec.startAsync();
    activeRecording = rec;
    return true;
  } catch {
    activeRecording = null;
    return false;
  }
}

export async function stopVoiceRecording(): Promise<{ uri: string; mimeType: string; name: string; size: number } | null> {
  if (!activeRecording) return null;
  try {
    await activeRecording.stopAndUnloadAsync();
    const uri = activeRecording.getURI();
    activeRecording = null;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    if (!uri) return null;
    return { uri, mimeType: 'audio/mp4', name: `voice_${Date.now()}.m4a`, size: 0 };
  } catch {
    activeRecording = null;
    return null;
  }
}

export async function cancelVoiceRecording(): Promise<void> {
  try { await activeRecording?.stopAndUnloadAsync(); } catch {}
  activeRecording = null;
}

export function getMediaReadUrl(mediaPublicId: string): Promise<string> {
  return api.get(`/media/${mediaPublicId}/read-url`).then((r) => r.data.data.url);
}