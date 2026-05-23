import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { MediaFileModel } from './media.model';
import { MediaStatus } from './media.types';
import type { IMediaFile, ConfirmUploadDto, UploadUrlResponse } from './media.types';
import { env } from '../../config/env';
import { NotFoundError, AppError } from '../../utils/error';
import { logger } from '../../lib/logger';

const SIGNED_URL_UPLOAD_TTL_SECONDS = 15 * 60;
const SIGNED_URL_READ_TTL_SECONDS = 60 * 60;
const ORPHAN_TTL_HOURS = 24;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const MAX_SIZE_BYTES = 50 * 1024 * 1024;      // 50 MB general
const MAX_VIDEO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB for videos

function getStorage(): Storage {
  if (env.GCP_KEY_FILE) {
    return new Storage({ projectId: env.GCP_PROJECT_ID, keyFilename: env.GCP_KEY_FILE });
  }
  return new Storage({ projectId: env.GCP_PROJECT_ID });
}

export class MediaService {
  async requestUploadUrl(
    uploaderPublicId: string,
    dto: {
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      mediaType: string;
      entityPublicId?: string;
      entityType?: string;
    },
  ): Promise<UploadUrlResponse> {
    if (!env.GCP_BUCKET_NAME) throw new AppError('Storage not configured', 503);

    if (!ALLOWED_MIME_TYPES.has(dto.mimeType)) {
      throw new AppError(`File type ${dto.mimeType} is not allowed`, 422);
    }
    if (VIDEO_MIME_TYPES.has(dto.mimeType) && dto.sizeBytes > MAX_VIDEO_SIZE_BYTES) {
      throw new AppError('Video files must be under 5 MB', 422);
    }
    if (dto.sizeBytes > MAX_SIZE_BYTES) {
      throw new AppError(`File size exceeds the 50 MB limit`, 422);
    }

    const ext = path.extname(dto.originalName).toLowerCase();
    const gcsObjectKey = `uploads/${dto.mediaType.toLowerCase()}/${uuidv4()}${ext}`;

    const storage = getStorage();
    const [uploadUrl] = await storage
      .bucket(env.GCP_BUCKET_NAME)
      .file(gcsObjectKey)
      .getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + SIGNED_URL_UPLOAD_TTL_SECONDS * 1000,
        contentType: dto.mimeType,
      });

    await MediaFileModel.create({
      publicId: uuidv4(),
      uploaderPublicId,
      mediaType: dto.mediaType,
      status: MediaStatus.PENDING,
      originalName: dto.originalName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      gcsBucket: env.GCP_BUCKET_NAME,
      gcsObjectKey,
      entityPublicId: dto.entityPublicId,
      entityType: dto.entityType,
      isDeleted: false,
    });

    return { uploadUrl, gcsObjectKey, expiresInSeconds: SIGNED_URL_UPLOAD_TTL_SECONDS };
  }

  async confirmUpload(uploaderPublicId: string, dto: ConfirmUploadDto): Promise<IMediaFile> {
    if (!env.GCP_BUCKET_NAME) throw new AppError('Storage not configured', 503);

    const record = await MediaFileModel.findOne({
      gcsObjectKey: dto.gcsObjectKey,
      uploaderPublicId,
      isDeleted: false,
    });

    if (!record) throw new NotFoundError('Upload record');
    if (record.status === MediaStatus.UPLOADED) return record.toObject();

    const storage = getStorage();
    const [exists] = await storage.bucket(env.GCP_BUCKET_NAME).file(dto.gcsObjectKey).exists();
    if (!exists) throw new AppError('File not found in storage upload may have failed', 422);

    record.status = MediaStatus.UPLOADED;
    await record.save();
    return record.toObject();
  }

  async getReadUrl(publicId: string, requesterPublicId: string): Promise<string> {
    if (!env.GCP_BUCKET_NAME) throw new AppError('Storage not configured', 503);

    const record = await MediaFileModel.findOne({ publicId, isDeleted: false });
    if (!record) throw new NotFoundError('Media file');
    if (record.status !== MediaStatus.UPLOADED) throw new AppError('File not yet uploaded', 422);

    const storage = getStorage();
    const [url] = await storage
      .bucket(env.GCP_BUCKET_NAME)
      .file(record.gcsObjectKey)
      .getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + SIGNED_URL_READ_TTL_SECONDS * 1000,
      });

    logger.debug(`Signed read URL generated for ${publicId} by ${requesterPublicId}`);
    return url;
  }

  async getByEntity(entityPublicId: string): Promise<IMediaFile[]> {
    return MediaFileModel.find({ entityPublicId, isDeleted: false, status: MediaStatus.UPLOADED })
      .sort({ createdAt: -1 })
      .lean();
  }

  async softDelete(publicId: string, deletedBy: string): Promise<void> {
    const record = await MediaFileModel.findOne({ publicId, isDeleted: false });
    if (!record) throw new NotFoundError('Media file');

    await MediaFileModel.findOneAndUpdate(
      { publicId },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy } },
    );
  }

  async purgeOrphanPendingFiles(): Promise<number> {
    const cutoff = new Date(Date.now() - ORPHAN_TTL_HOURS * 60 * 60 * 1000);
    const result = await MediaFileModel.updateMany(
      { status: MediaStatus.PENDING, createdAt: { $lt: cutoff }, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    );
    if (result.modifiedCount > 0) {
      logger.info(`Purged ${result.modifiedCount} orphan pending media files`);
    }
    return result.modifiedCount;
  }
}

export const mediaService = new MediaService();
