import { v4 as uuidv4 } from 'uuid';
import { ResourceModel } from './resource.model';
import type { IResource, CreateResourceDto, UpdateResourceDto } from './resource.types';
import { NotFoundError, AppError } from '../../utils/error';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';
import { mediaService } from '../media/media.service';
import { resolveTutorAttachment } from '../curricula/curriculum-attachment';
import { resolveAdminAttachment } from '../curricula/curriculum-attachment';
import { studentMaterialScope } from '../courses/material-access';
import type { TutorAuthor } from '../../shared/material.types';

const pickDefined = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export class ResourceService {
  async create(tutor: TutorAuthor, dto: CreateResourceDto): Promise<IResource> {
    const attachment = await resolveTutorAttachment(tutor, dto);
    const resource = await ResourceModel.create({
      publicId: uuidv4(),
      tutorPublicId: tutor.publicId,
      classPublicId: dto.classPublicId,
      title: dto.title,
      description: dto.description,
      mediaPublicId: dto.mediaPublicId,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      ...attachment,
      authorRole: 'TUTOR',
      authorUserPublicId: tutor.userPublicId,
    });
    return resource.toObject();
  }

  async createForCurriculum(adminUserPublicId: string, curriculumPublicId: string, dto: CreateResourceDto): Promise<IResource> {
    const attachment = await resolveAdminAttachment(curriculumPublicId, dto.topicPublicIds);
    const resource = await ResourceModel.create({
      publicId: uuidv4(),
      title: dto.title,
      description: dto.description,
      mediaPublicId: dto.mediaPublicId,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      ...attachment,
      authorRole: 'ADMIN',
      authorUserPublicId: adminUserPublicId,
    });
    return resource.toObject();
  }

  async getByTutor(
    tutorPublicId: string,
    query: PaginationQuery & { classPublicId?: string },
  ): Promise<PaginatedResult<IResource>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { tutorPublicId, isDeleted: false };
    if (query.classPublicId) filter.classPublicId = query.classPublicId;

    const [items, total] = await Promise.all([
      ResourceModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ResourceModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async getForStudent(
    studentPublicId: string,
    tutorPublicId: string,
    query: PaginationQuery & { classPublicId?: string },
  ): Promise<PaginatedResult<IResource>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { tutorPublicId, isDeleted: false };
    if (query.classPublicId) filter.classPublicId = query.classPublicId;
    filter.$and = [await studentMaterialScope(studentPublicId)];

    const [items, total] = await Promise.all([
      ResourceModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ResourceModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async getByPublicId(publicId: string): Promise<IResource> {
    const resource = await ResourceModel.findOne({ publicId, isDeleted: false }).lean();
    if (!resource) throw new NotFoundError('Resource not found');
    return resource;
  }

  async getReadUrl(publicId: string, requestorPublicId: string): Promise<string> {
    const resource = await this.getByPublicId(publicId);
    return mediaService.getReadUrl(resource.mediaPublicId, requestorPublicId);
  }

  async update(publicId: string, tutorPublicId: string, dto: UpdateResourceDto): Promise<IResource> {
    const resource = await ResourceModel.findOneAndUpdate(
      { publicId, tutorPublicId, isDeleted: false },
      // Whitelist: the body is unvalidated, and authorship/attachment fields must not be editable here.
      { $set: pickDefined({ title: dto.title, description: dto.description }) },
      { new: true },
    ).lean();
    if (!resource) throw new NotFoundError('Resource not found');
    return resource;
  }

  async softDelete(publicId: string, tutorPublicId: string): Promise<void> {
    const result = await ResourceModel.findOneAndUpdate(
      { publicId, tutorPublicId, isDeleted: false },
      { $set: { isDeleted: true } },
    ).lean();
    if (!result) throw new AppError('Resource not found or not owned by you', 404);
  }
}

export const resourceService = new ResourceService();
