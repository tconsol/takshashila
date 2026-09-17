import { UserModel } from './user.model';
import type { IUser, CreateUserDto } from './user.types';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';
import type { Role } from '../../constants/roles';

export interface DirectoryFilters {
  role?: Role;
  status?: string;
  q?: string;
  /** Deletion is soft, so an admin needs to see and restore the tail. */
  deleted?: 'exclude' | 'include' | 'only';
}

function buildDirectoryFilter(filters: DirectoryFilters): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (filters.deleted === 'only') filter.isDeleted = true;
  else if (filters.deleted !== 'include') filter.isDeleted = false;

  if (filters.role) filter.role = filters.role;
  if (filters.status) filter.status = filters.status;
  if (filters.q && filters.q.trim().length >= 2) {
    const escaped = filters.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }, { studentId: regex }];
  }

  return filter;
}

export class UserRepository {
  async create(dto: Omit<IUser, '_id' | 'createdAt' | 'updatedAt'>): Promise<IUser> {
    const user = await UserModel.create(dto);
    return user.toObject();
  }

  async findById(id: string): Promise<IUser | null> {
    return UserModel.findById(id).lean();
  }

  async findByPublicId(publicId: string): Promise<IUser | null> {
    return UserModel.findOne({ publicId, isDeleted: false }).lean();
  }

  /**
   * `includeDeleted` matters because the email unique index is global, not
   * partial on isDeleted. Deletion normally releases the address (see
   * `releaseEmail`), but legacy rows deleted before that existed still hold
   * theirs, so callers about to CREATE should look with it on.
   */
  async findByEmail(email: string, withSensitive = false, includeDeleted = false): Promise<IUser | null> {
    const filter: Record<string, unknown> = { email: email.toLowerCase() };
    if (!includeDeleted) filter.isDeleted = false;

    const query = UserModel.findOne(filter);
    if (withSensitive) {
      query.select('+passwordHash +emailVerificationToken +emailVerificationExpiry +passwordResetToken +passwordResetExpiry');
    }
    return query.lean();
  }

  async findByEmailVerificationToken(token: string): Promise<IUser | null> {
    return UserModel.findOne({
      emailVerificationToken: token,
      emailVerificationExpiry: { $gt: new Date() },
      isDeleted: false,
    })
      .select('+emailVerificationToken +emailVerificationExpiry')
      .lean();
  }

  async findByPasswordResetToken(token: string): Promise<IUser | null> {
    return UserModel.findOne({
      passwordResetToken: token,
      passwordResetExpiry: { $gt: new Date() },
      isDeleted: false,
    })
      .select('+passwordResetToken +passwordResetExpiry')
      .lean();
  }

  /**
   * Frees a deleted account's address so the person can sign up again, while the
   * row itself stays put for classes, ledger and audit to resolve against. The
   * original is parked in `deletedEmail` so restore can reclaim it.
   *
   * Returns false when the address was already released.
   */
  async releaseEmail(publicId: string): Promise<boolean> {
    const user = await UserModel.findOne({ publicId }, { email: 1, deletedEmail: 1 }).lean();
    if (!user || user.deletedEmail) return false;

    await UserModel.updateOne(
      { publicId },
      {
        $set: {
          deletedEmail: user.email,
          // Unique but obviously inert, and never a deliverable address.
          email: `deleted+${publicId}@deleted.invalid`,
        },
      },
    );
    return true;
  }

  /** Puts a released address back, unless someone has since claimed it. */
  async reclaimEmail(publicId: string): Promise<{ reclaimed: boolean; email?: string }> {
    const user = await UserModel.findOne({ publicId }, { deletedEmail: 1 }).lean();
    if (!user?.deletedEmail) return { reclaimed: false };

    const taken = await UserModel.findOne(
      { email: user.deletedEmail, publicId: { $ne: publicId } },
      { publicId: 1 },
    ).lean();
    if (taken) return { reclaimed: false };

    await UserModel.updateOne(
      { publicId },
      { $set: { email: user.deletedEmail }, $unset: { deletedEmail: '' } },
    );
    return { reclaimed: true, email: user.deletedEmail };
  }

  async update(publicId: string, updates: Partial<IUser>): Promise<IUser | null> {
    return UserModel.findOneAndUpdate(
      { publicId, isDeleted: false },
      { $set: updates },
      { new: true },
    ).lean();
  }

  async addPushToken(publicId: string, token: string): Promise<void> {
    await UserModel.updateOne({ publicId, isDeleted: false }, { $addToSet: { pushTokens: token } });
  }

  async removePushToken(publicId: string, token: string): Promise<void> {
    await UserModel.updateOne({ publicId }, { $pull: { pushTokens: token } });
  }

  async softDelete(publicId: string, deletedBy: string): Promise<IUser | null> {
    return UserModel.findOneAndUpdate(
      { publicId },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy } },
      { new: true },
    ).lean();
  }

  async findAllByRole(role: Role, query: PaginationQuery): Promise<PaginatedResult<IUser>> {
    return this.findAll({ role }, query);
  }

  /**
   * Admin directory listing. Every filter is optional so an unfiltered call
   * returns the whole (non-deleted) user base rather than an empty list.
   */
  async findAll(
    filters: DirectoryFilters,
    query: PaginationQuery,
  ): Promise<PaginatedResult<IUser>> {
    const { page, limit, skip, sortBy, sortOrder } = parsePaginationQuery(query);
    const filter = buildDirectoryFilter(filters);

    const [items, total] = await Promise.all([
      UserModel.find(filter).sort({ [sortBy]: sortOrder } as Record<string, 1 | -1>).skip(skip).limit(limit).lean(),
      UserModel.countDocuments(filter),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  /**
   * Export path. `parsePaginationQuery` caps a page at 100 rows, which would
   * silently truncate a CSV, so this bypasses it with its own explicit bound.
   */
  async findAllForExport(filters: DirectoryFilters, limit: number): Promise<IUser[]> {
    return UserModel.find(buildDirectoryFilter(filters))
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(1, limit), 20_000))
      .lean();
  }

  /** Counts grouped by role and by status, for admin dashboards. */
  async countsByRoleAndStatus(): Promise<{
    byRole: { role: string; count: number }[];
    byStatus: { status: string; count: number }[];
  }> {
    const [byRole, byStatus] = await Promise.all([
      UserModel.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      UserModel.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    return {
      byRole: byRole.map((r: { _id: string; count: number }) => ({ role: r._id, count: r.count })),
      byStatus: byStatus.map((s: { _id: string; count: number }) => ({ status: s._id, count: s.count })),
    };
  }

  async searchAll(q: string, limit = 30): Promise<IUser[]> {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    return UserModel.find({
      isDeleted: false,
      $or: [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { studentId: regex },
      ],
    })
      .select('publicId firstName lastName email role studentId avatarUrl')
      .limit(limit)
      .lean();
  }

  async findManyByPublicIds(publicIds: string[]): Promise<IUser[]> {
    if (publicIds.length === 0) return [];
    return UserModel.find({ publicId: { $in: publicIds }, isDeleted: false }).lean();
  }

  async findByPhone(phone: string): Promise<IUser | null> {
    return UserModel.findOne({ phone, isDeleted: false }).lean();
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await UserModel.countDocuments({ email: email.toLowerCase() });
    return count > 0;
  }

  async findByStudentId(studentId: string, withSensitive = false): Promise<IUser | null> {
    const query = UserModel.findOne({ studentId: studentId.toLowerCase(), isDeleted: false });
    if (withSensitive) {
      query.select('+passwordHash +emailVerificationToken +emailVerificationExpiry +passwordResetToken +passwordResetExpiry');
    }
    return query.lean();
  }

  async existsByStudentId(studentId: string): Promise<boolean> {
    const count = await UserModel.countDocuments({ studentId: studentId.toLowerCase() });
    return count > 0;
  }

  async updateLastLogin(publicId: string, ip: string): Promise<void> {
    await UserModel.updateOne(
      { publicId },
      { $set: { lastLoginAt: new Date(), lastLoginIp: ip }, $inc: { loginCount: 1 } },
    );
  }
}

export const userRepository = new UserRepository();
