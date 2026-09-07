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
    return this.search({}, query);
  }

  /**
   * Filtered audit search. Every filter is optional and they compose, so the
   * console can narrow by who / what / when in one request instead of the
   * actor-only lookup it used to be limited to.
   */
  async search(
    filters: {
      actorId?: string;
      actorRole?: string;
      action?: string;
      resourceType?: string;
      resourceId?: string;
      from?: string;
      to?: string;
      q?: string;
    },
    query: PaginationQuery,
  ): Promise<PaginatedResult<IAuditLog>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter = this.buildFilter(filters);

    const [items, total] = await Promise.all([
      AuditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLogModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  /** Distinct actions and resource types, so the console can offer real filters. */
  async getFacets(): Promise<{ actions: string[]; resourceTypes: string[]; actorRoles: string[] }> {
    const [actions, resourceTypes, actorRoles] = await Promise.all([
      AuditLogModel.distinct('action'),
      AuditLogModel.distinct('resourceType'),
      AuditLogModel.distinct('actorRole'),
    ]);
    return {
      actions: (actions as string[]).sort(),
      resourceTypes: (resourceTypes as string[]).sort(),
      actorRoles: (actorRoles as string[]).sort(),
    };
  }

  /**
   * Rows for an export. Capped rather than unbounded — an audit table grows without
   * limit and streaming the whole thing into memory is how an export takes the API down.
   */
  async exportRows(
    filters: Parameters<AuditService['search']>[0],
    max = 5000,
  ): Promise<IAuditLog[]> {
    return AuditLogModel.find(this.buildFilter(filters))
      .sort({ createdAt: -1 })
      .limit(Math.min(max, 20_000))
      .lean();
  }

  private buildFilter(filters: Parameters<AuditService['search']>[0]): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (filters.actorId) filter.actorId = filters.actorId;
    if (filters.actorRole) filter.actorRole = filters.actorRole;
    if (filters.action) filter.action = filters.action;
    if (filters.resourceType) filter.resourceType = filters.resourceType;
    if (filters.resourceId) filter.resourceId = filters.resourceId;

    const createdAt: Record<string, Date> = {};
    if (filters.from) createdAt.$gte = new Date(filters.from);
    if (filters.to) createdAt.$lte = new Date(filters.to);
    if (Object.keys(createdAt).length > 0) filter.createdAt = createdAt;

    if (filters.q && filters.q.trim().length >= 2) {
      const escaped = filters.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [{ action: regex }, { resourceType: regex }, { actorId: regex }, { resourceId: regex }];
    }

    return filter;
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
