import type { Model } from 'mongoose';
import { WorksheetModel } from '../worksheets/worksheet.model';
import { AssignmentModel } from '../assignments/assignment.model';
import { ResourceModel } from '../resources/resource.model';
import { TutorProfileModel } from '../tutors/tutor.model';
import { UserModel } from '../users/user.model';
import { auditService } from '../audit/audit.service';
import { NotFoundError, ValidationError } from '../../utils/error';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';
import type { PaginationQuery } from '../../shared/types';
import type { Role } from '../../constants/roles';

/**
 * Read-and-remove oversight of tutor-authored content.
 *
 * Admins do not create or edit teaching material — that is the tutor's job —
 * but they do need to find something reported as inappropriate and take it
 * down. So this exposes search across the three content types plus a soft
 * delete, and nothing else.
 *
 * Removal is soft and audited: taking material down must be reversible and
 * attributable, since the usual reason is a contested judgement call.
 */

export type ContentKind = 'worksheet' | 'assignment' | 'resource';

/**
 * The three content models differ in their generics, so a plain union of them
 * is not callable. They do share every field this service touches, so narrow
 * to that shape at the lookup boundary.
 */
type ContentDoc = {
  publicId: string;
  title: string;
  tutorPublicId: string;
  isDeleted?: boolean;
  createdAt?: Date;
};

const MODELS: Record<ContentKind, Model<ContentDoc>> = {
  worksheet: WorksheetModel as unknown as Model<ContentDoc>,
  assignment: AssignmentModel as unknown as Model<ContentDoc>,
  resource: ResourceModel as unknown as Model<ContentDoc>,
};

export interface ContentItem {
  publicId: string;
  kind: ContentKind;
  title: string;
  tutorPublicId: string;
  tutorName: string;
  createdAt: Date;
  isDeleted: boolean;
  /** Type-specific extra, e.g. file size or question count. */
  detail: string | null;
}

const invalid = (msg: string) => new ValidationError([msg], msg);

export class ContentOversightService {
  async list(
    filters: { kind?: ContentKind; q?: string; includeDeleted?: boolean },
    query: PaginationQuery,
  ) {
    const kinds: ContentKind[] = filters.kind ? [filters.kind] : ['worksheet', 'assignment', 'resource'];
    const { page, limit, skip } = parsePaginationQuery(query);

    const filter: Record<string, unknown> = {};
    if (!filters.includeDeleted) filter.isDeleted = false;
    if (filters.q && filters.q.trim().length >= 2) {
      const escaped = filters.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.title = new RegExp(escaped, 'i');
    }

    // Each type is its own collection, so gather a page-worth from each and
    // merge. Over-fetching by `skip + limit` per kind is what lets the merged
    // result be correctly ordered and paged without a union view.
    const perKind = await Promise.all(
      kinds.map(async (kind) => {
        const rows = await MODELS[kind]
          .find(filter, { publicId: 1, title: 1, tutorPublicId: 1, createdAt: 1, isDeleted: 1, questions: 1, sizeBytes: 1, dueDate: 1 })
          .sort({ createdAt: -1 })
          .limit(skip + limit)
          .lean();
        const total = await MODELS[kind].countDocuments(filter);
        return { kind, rows, total };
      }),
    );

    const merged = perKind
      .flatMap(({ kind, rows }) =>
        rows.map((row) => {
          const record = row as unknown as Record<string, unknown>;
          return {
            publicId: String(record.publicId),
            kind,
            title: String(record.title ?? 'Untitled'),
            tutorPublicId: String(record.tutorPublicId ?? ''),
            createdAt: record.createdAt as Date,
            isDeleted: Boolean(record.isDeleted),
            detail: describe(kind, record),
          };
        }),
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(skip, skip + limit);

    const total = perKind.reduce((sum, k) => sum + k.total, 0);
    return buildPaginatedResult(await this.withTutorNames(merged), total, page, limit);
  }

  /** Counts per content type, for the summary tiles. */
  async counts() {
    const [worksheets, assignments, resources] = await Promise.all([
      WorksheetModel.countDocuments({ isDeleted: false }),
      AssignmentModel.countDocuments({ isDeleted: false }),
      ResourceModel.countDocuments({ isDeleted: false }),
    ]);
    return { worksheets, assignments, resources, total: worksheets + assignments + resources };
  }

  /** Soft-removes a piece of content. Reversible, and always attributed. */
  async remove(
    kind: ContentKind,
    publicId: string,
    actor: { publicId: string; role: Role; ip?: string; userAgent?: string },
    reason?: string,
  ) {
    const Model = MODELS[kind];
    if (!Model) throw invalid(`Unknown content type "${kind}"`);

    const existing = await Model.findOne({ publicId }).lean();
    if (!existing) throw new NotFoundError(kind);

    await Model.updateOne(
      { publicId },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: actor.publicId } },
    );

    await auditService.log({
      actorId: actor.publicId,
      actorRole: actor.role,
      action: 'CONTENT_REMOVED',
      resourceType: kind,
      resourceId: publicId,
      ip: actor.ip,
      userAgent: actor.userAgent,
      before: { title: (existing as unknown as Record<string, unknown>).title },
      after: { isDeleted: true, reason },
    });
  }

  async restore(
    kind: ContentKind,
    publicId: string,
    actor: { publicId: string; role: Role; ip?: string; userAgent?: string },
  ) {
    const Model = MODELS[kind];
    if (!Model) throw invalid(`Unknown content type "${kind}"`);

    await Model.updateOne(
      { publicId },
      { $set: { isDeleted: false }, $unset: { deletedAt: '', deletedBy: '' } },
    );

    await auditService.log({
      actorId: actor.publicId,
      actorRole: actor.role,
      action: 'CONTENT_RESTORED',
      resourceType: kind,
      resourceId: publicId,
      ip: actor.ip,
      userAgent: actor.userAgent,
      after: { isDeleted: false },
    });
  }

  /** Content rows carry a tutor PROFILE id; oversight needs the person's name. */
  private async withTutorNames<T extends { tutorPublicId: string }>(items: T[]): Promise<(T & { tutorName: string })[]> {
    if (items.length === 0) return [];

    const profiles = await TutorProfileModel.find(
      { publicId: { $in: [...new Set(items.map((i) => i.tutorPublicId))] } },
      { publicId: 1, userPublicId: 1 },
    ).lean();
    const users = await UserModel.find(
      { publicId: { $in: profiles.map((p) => p.userPublicId) } },
      { publicId: 1, firstName: 1, lastName: 1 },
    ).lean();

    const nameByUser = new Map(users.map((u) => [u.publicId, `${u.firstName} ${u.lastName}`.trim()]));
    const nameByProfile = new Map(profiles.map((p) => [p.publicId, nameByUser.get(p.userPublicId) ?? 'Unknown tutor']));

    return items.map((i) => ({ ...i, tutorName: nameByProfile.get(i.tutorPublicId) ?? 'Unknown tutor' }));
  }
}

/** A short, type-appropriate descriptor so the list is scannable. */
function describe(kind: ContentKind, record: Record<string, unknown>): string | null {
  if (kind === 'worksheet') {
    const questions = Array.isArray(record.questions) ? record.questions.length : 0;
    return `${questions} question${questions === 1 ? '' : 's'}`;
  }
  if (kind === 'resource') {
    const bytes = Number(record.sizeBytes ?? 0);
    if (!bytes) return null;
    return bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
  }
  if (kind === 'assignment' && record.dueDate) {
    return `Due ${new Date(record.dueDate as string).toLocaleDateString()}`;
  }
  return null;
}

export const contentOversightService = new ContentOversightService();
