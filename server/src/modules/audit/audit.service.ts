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
    return buildPaginatedResult(await this.withNames(items), total, page, limit);
  }

  /**
   * Rows store ids only ("23b9f8b0-…", "ScheduledClass 24e2b0c7-…"), which makes
   * the log unreadable. Resolve the actor and the resource to something a person
   * can recognise.
   */
  private async withNames<T extends { actorId: string; resourceType: string; resourceId?: string }>(
    items: T[],
  ): Promise<(T & { actorName?: string; resourceLabel?: string })[]> {
    if (items.length === 0) return items;

    const [{ UserModel }, { ScheduledClassModel }, { TutorProfileModel }, { PrincipalProfileModel }, { StudentProfileModel }] =
      await Promise.all([
        import('../users/user.model'),
        import('../schedules/schedule.model'),
        import('../tutors/tutor.model'),
        import('../principals/principal.model'),
        import('../students/student.model'),
      ]);

    const idsOf = (type: string) =>
      [...new Set(items.filter((i) => i.resourceType === type && i.resourceId).map((i) => i.resourceId as string))];

    const profileTypes: Array<[string, typeof TutorProfileModel | typeof PrincipalProfileModel | typeof StudentProfileModel]> = [
      ['TutorProfile', TutorProfileModel],
      ['PrincipalProfile', PrincipalProfileModel],
      ['StudentProfile', StudentProfileModel],
    ];
    const profileUser = new Map<string, string>(); // `${type}:${profileId}` -> userPublicId
    for (const [type, model] of profileTypes) {
      const ids = idsOf(type);
      if (ids.length === 0) continue;
      const rows = await (model as typeof TutorProfileModel).find({ publicId: { $in: ids } }, { publicId: 1, userPublicId: 1 }).lean();
      rows.forEach((r) => profileUser.set(`${type}:${r.publicId}`, r.userPublicId));
    }

    const userIds = new Set<string>([
      ...items.map((i) => i.actorId).filter((id) => id && id !== 'system'),
      ...idsOf('User'),
      ...profileUser.values(),
    ]);
    const users = await UserModel.find(
      { publicId: { $in: [...userIds] } },
      { publicId: 1, firstName: 1, lastName: 1 },
    ).lean();
    const nameOf = new Map(users.map((u) => [u.publicId, `${u.firstName} ${u.lastName}`.trim()]));

    const classIds = idsOf('ScheduledClass');
    const classes = classIds.length
      ? await ScheduledClassModel.find({ publicId: { $in: classIds } }, { publicId: 1, title: 1 }).lean()
      : [];
    const classTitle = new Map(classes.map((c) => [c.publicId, c.title]));

    return items.map((i) => {
      let label: string | undefined;
      if (i.resourceType === 'User') label = nameOf.get(i.resourceId ?? '');
      else if (i.resourceType === 'ScheduledClass') label = classTitle.get(i.resourceId ?? '');
      else if (profileUser.has(`${i.resourceType}:${i.resourceId}`)) {
        label = nameOf.get(profileUser.get(`${i.resourceType}:${i.resourceId}`) as string);
      }
      return { ...i, actorName: nameOf.get(i.actorId), resourceLabel: label };
    });
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
  ): Promise<Array<IAuditLog & { actorName?: string; resourceLabel?: string }>> {
    const rows = await AuditLogModel.find(this.buildFilter(filters))
      .sort({ createdAt: -1 })
      .limit(Math.min(max, 20_000))
      .lean();
    return (await this.withNames(rows)) as unknown as Array<IAuditLog & { actorName?: string; resourceLabel?: string }>;
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
