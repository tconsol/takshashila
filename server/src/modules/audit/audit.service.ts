import { v4 as uuidv4 } from 'uuid';
import { AuditLogModel } from './audit.model';
import type { IAuditLog } from './audit.model';
import type { AuditMeta } from '../../shared/types';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';
import { domainEvents } from '../../events/event-emitter';

export class AuditService {
  constructor() {
    domainEvents.on('AUDIT', (meta: AuditMeta) => {
      this.log(meta).catch(() => {});
    });
  }

  async log(meta: AuditMeta): Promise<IAuditLog> {
    const log = await AuditLogModel.create({
      publicId: uuidv4(),
      actorId: meta.actorId,
      actorRole: meta.actorRole,
      action: meta.action,
      resourceType: meta.resourceType,
      resourceId: meta.resourceId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      before: meta.before,
      after: meta.after,
    });
    return log.toObject();
  }

  async getAll(query: PaginationQuery): Promise<PaginatedResult<IAuditLog>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const [items, total] = await Promise.all([
      AuditLogModel.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLogModel.countDocuments({}),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async getByActor(
    actorId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<IAuditLog>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter = { actorId };

    const [items, total] = await Promise.all([
      AuditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLogModel.countDocuments(filter),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  async getByResource(
    resourceType: string,
    resourceId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<IAuditLog>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter = { resourceType, resourceId };

    const [items, total] = await Promise.all([
      AuditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLogModel.countDocuments(filter),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }
}

export const auditService = new AuditService();
