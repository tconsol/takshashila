import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { Model } from 'mongoose';
import { userRepository } from './user.repository';
import type { PublicUser } from './user.types';
import { UserStatus } from './user.types';
import type { PaginationQuery } from '../../shared/types';
import { NotFoundError, ConflictError, ValidationError, AuthorizationError } from '../../utils/error';
import { Role, ROLE_HIERARCHY } from '../../constants/roles';
import { authService } from '../auth/auth.service';
import { auditService } from '../audit/audit.service';
import { UserModel } from './user.model';
import { StudentProfileModel } from '../students/student.model';
import { TutorProfileModel } from '../tutors/tutor.model';
import { PrincipalProfileModel } from '../principals/principal.model';
import { ParentProfileModel } from '../parents/parent.model';
import { WalletModel } from '../wallets/wallet.model';
import { ScheduledClassModel } from '../schedules/schedule.model';
import { AttendanceModel } from '../attendance/attendance.model';
import { TicketModel } from '../support/support.model';
import { AuditLogModel } from '../audit/audit.model';
import { ClassStatus } from '../schedules/schedule.types';
import { StudentStatus } from '../students/student.types';
import { TutorStatus } from '../tutors/tutor.types';
import { PrincipalStatus } from '../principals/principal.types';
import { settingsService } from '../settings/settings.service';

export interface UserActivity {
  classesTotal: number;
  classesCompleted: number;
  classesCancelled: number;
  classesUpcoming: number;
  attendanceRate: number | null;
  ticketsOpened: number;
}

const EMPTY_ACTIVITY: UserActivity = {
  classesTotal: 0,
  classesCompleted: 0,
  classesCancelled: 0,
  classesUpcoming: 0,
  attendanceRate: null,
  ticketsOpened: 0,
};

/**
 * Scheduled classes key off the tutor/student PROFILE id, never the user id —
 * every lookup here has to resolve the profile first.
 */
async function classCounts(field: 'tutorPublicId' | 'studentPublicId', profileId: string) {
  const [classesTotal, classesCompleted, classesCancelled, classesUpcoming] = await Promise.all([
    ScheduledClassModel.countDocuments({ [field]: profileId, isDeleted: false }),
    ScheduledClassModel.countDocuments({ [field]: profileId, status: ClassStatus.COMPLETED, isDeleted: false }),
    ScheduledClassModel.countDocuments({ [field]: profileId, status: ClassStatus.CANCELLED, isDeleted: false }),
    ScheduledClassModel.countDocuments({ [field]: profileId, status: ClassStatus.SCHEDULED, isDeleted: false }),
  ]);
  return { classesTotal, classesCompleted, classesCancelled, classesUpcoming };
}

async function attendanceRateFor(field: 'tutorPublicId' | 'studentPublicId', profileId: string) {
  const result = await AttendanceModel.aggregate([
    { $match: { [field]: profileId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] } },
      },
    },
  ]);
  const { total = 0, present = 0 } = result[0] ?? {};
  return total > 0 ? Math.round((present / total) * 100) : null;
}

export interface AdminActor {
  publicId: string;
  role: Role;
  ip?: string;
  userAgent?: string;
}

export interface CreateUserDto {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  phone?: string;
  timezone?: string;
  grade?: string;
  organizationName?: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  timezone?: string;
  status?: string;
}

/** Account fields an admin may rewrite. Role is deliberately not one of them. */
const EDITABLE_ACCOUNT_FIELDS: (keyof UpdateUserDto)[] = [
  'firstName', 'lastName', 'email', 'phone', 'timezone', 'status',
];

/** Role-profile fields an admin may rewrite, per role. */
const EDITABLE_PROFILE_FIELDS: Partial<Record<Role, string[]>> = {
  [Role.STUDENT]:   ['grade', 'notes', 'status', 'contactEmail'],
  [Role.TUTOR]:     ['subjects', 'languages', 'hourlyRateCents', 'commissionRatePercent', 'bio', 'isVerified', 'status'],
  [Role.PRINCIPAL]: ['organizationName', 'organizationWebsite', 'bio', 'commissionRatePercent', 'status'],
};

/**
 * The four profile models share the fields this service touches (`userPublicId`,
 * `isDeleted`), but their generics differ, so a plain union isn't callable.
 * Narrow to that common shape at the lookup boundary.
 */
type ProfileDoc = { userPublicId: string; isDeleted?: boolean };

const PROFILE_MODELS: Partial<Record<Role, Model<ProfileDoc>>> = {
  [Role.STUDENT]: StudentProfileModel as unknown as Model<ProfileDoc>,
  [Role.TUTOR]: TutorProfileModel as unknown as Model<ProfileDoc>,
  [Role.PRINCIPAL]: PrincipalProfileModel as unknown as Model<ProfileDoc>,
  [Role.PARENT]: ParentProfileModel as unknown as Model<ProfileDoc>,
};

const invalid = (msg: string) => new ValidationError([msg], msg);

export class UserAdminService {
  /**
   * Directory listing. When the caller filters to a role that has a profile, the
   * page is hydrated with it in one extra query — so the tutors screen can show
   * subjects and rate, and the students screen grade and attendance, without the
   * client issuing a request per row.
   */
  async listDirectory(
    filters: { role?: Role; status?: string; q?: string; deleted?: 'exclude' | 'include' | 'only' },
    pagination: PaginationQuery,
  ) {
    const result = await userRepository.findAll(filters, pagination);

    const ProfileModel = filters.role ? PROFILE_MODELS[filters.role] : undefined;
    if (!ProfileModel || result.items.length === 0) {
      return { ...result, items: result.items.map((u) => ({ ...u, profile: null })) };
    }

    const userPublicIds = result.items.map((u) => u.publicId);
    const profiles = await ProfileModel.find({ userPublicId: { $in: userPublicIds } }).lean();
    const byUser = new Map(profiles.map((p) => [p.userPublicId, p]));

    return {
      ...result,
      items: result.items.map((u) => ({ ...u, profile: byUser.get(u.publicId) ?? null })),
    };
  }

  /** Flat rows for a CSV export, bounded so a large tenant cannot blow up memory. */
  async exportUsers(
    filters: { role?: Role; status?: string; q?: string; deleted?: 'exclude' | 'include' | 'only' },
    max = 5000,
  ): Promise<PublicUser[]> {
    return (await userRepository.findAllForExport(filters, max)) as PublicUser[];
  }

  /**
   * An admin may only act on someone strictly below them in the role hierarchy,
   * and never on themselves. Super admins are exempt from the first rule but not
   * the second — nobody deletes or suspends their own account by accident.
   */
  private assertCanManage(target: PublicUser, actor: AdminActor, verb: string): void {
    if (target.publicId === actor.publicId) {
      throw invalid(`Cannot ${verb} your own account`);
    }
    if (actor.role === Role.SUPER_ADMIN) return;
    if (ROLE_HIERARCHY[target.role] >= ROLE_HIERARCHY[actor.role]) {
      throw new AuthorizationError(`Only a super admin can ${verb} a ${target.role.replace('_', ' ').toLowerCase()}`);
    }
  }

  private assertCanCreateRole(role: Role, actor: AdminActor): void {
    if (!ROLE_HIERARCHY[role]) throw invalid(`Unknown role "${role}"`);
    if (actor.role === Role.SUPER_ADMIN) return;
    if (ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[actor.role]) {
      throw new AuthorizationError('Only a super admin can create accounts at or above admin level');
    }
  }

  /**
   * Creates the account through the normal registration path so the new user gets
   * a wallet, their role profile and a verification email exactly as a self-signup
   * would. The password is random and never shown — the invitee sets their own via
   * the emailed link.
   */
  async createUser(dto: CreateUserDto, actor: AdminActor) {
    this.assertCanCreateRole(dto.role, actor);

    const existing = await userRepository.findByEmail(dto.email);
    if (existing && (existing.emailVerified || existing.status === UserStatus.ACTIVE)) {
      throw new ConflictError('An account with this email already exists');
    }

    const temporaryPassword = `${crypto.randomBytes(24).toString('base64url')}Aa1!`;

    const { publicId } = await authService.register(
      {
        email: dto.email,
        password: temporaryPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        phone: dto.phone,
        timezone: dto.timezone,
        grade: dto.grade,
        organizationName: dto.organizationName,
      } as Parameters<typeof authService.register>[0],
      dto.role,
    );

    await auditService.log({
      actorId: actor.publicId,
      actorRole: actor.role,
      action: 'USER_CREATED_BY_ADMIN',
      resourceType: 'User',
      resourceId: publicId,
      ip: actor.ip,
      userAgent: actor.userAgent,
      after: { email: dto.email, role: dto.role },
    });

    return this.getUserDetail(publicId);
  }

  async updateUser(publicId: string, dto: UpdateUserDto, actor: AdminActor) {
    const user = await userRepository.findByPublicId(publicId);
    if (!user) throw new NotFoundError('User');
    this.assertCanManage(user as PublicUser, actor, 'edit');

    const updates: Record<string, unknown> = {};
    for (const field of EDITABLE_ACCOUNT_FIELDS) {
      const value = dto[field];
      if (value === undefined) continue;
      const trimmed = String(value).trim();
      if (!trimmed) throw invalid(`${field} cannot be empty`);
      updates[field] = field === 'email' ? trimmed.toLowerCase() : trimmed;
    }

    if (Object.keys(updates).length === 0) throw invalid('No valid fields supplied');

    // Changing the email invalidates verification — the new address is unproven.
    if (updates.email && updates.email !== user.email) {
      if (await userRepository.existsByEmail(updates.email as string)) {
        throw new ConflictError('Email already in use');
      }
      updates.emailVerified = false;
    }

    if (updates.status && !Object.values(UserStatus).includes(updates.status as UserStatus)) {
      throw invalid(`Unknown status "${updates.status}"`);
    }

    const updated = await userRepository.update(publicId, updates);
    await auditService.log({
      actorId: actor.publicId,
      actorRole: actor.role,
      action: 'USER_UPDATED_BY_ADMIN',
      resourceType: 'User',
      resourceId: publicId,
      ip: actor.ip,
      userAgent: actor.userAgent,
      before: { firstName: user.firstName, lastName: user.lastName, email: user.email, status: user.status },
      after: updates,
    });

    return updated as PublicUser;
  }

  /** Patches the role-specific profile (grade, subjects, commission, …). */
  async updateRoleProfile(publicId: string, patch: Record<string, unknown>, actor: AdminActor) {
    const user = await userRepository.findByPublicId(publicId);
    if (!user) throw new NotFoundError('User');
    this.assertCanManage(user as PublicUser, actor, 'edit');

    const allowed = EDITABLE_PROFILE_FIELDS[user.role];
    if (!allowed) throw invalid(`${user.role} accounts have no editable profile fields`);

    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (patch[key] !== undefined) updates[key] = patch[key];
    }
    if (Object.keys(updates).length === 0) throw invalid('No valid profile fields supplied');

    const ProfileModel = PROFILE_MODELS[user.role];
    if (!ProfileModel) throw new NotFoundError(`${user.role} profile`);

    const before = await ProfileModel.findOne({ userPublicId: publicId, isDeleted: false }).lean();
    if (!before) throw new NotFoundError(`${user.role} profile`);

    const after = await ProfileModel.findOneAndUpdate(
      { userPublicId: publicId, isDeleted: false },
      { $set: updates },
      { new: true, runValidators: true },
    ).lean();

    await auditService.log({
      actorId: actor.publicId,
      actorRole: actor.role,
      action: 'USER_PROFILE_UPDATED_BY_ADMIN',
      resourceType: `${user.role}Profile`,
      resourceId: publicId,
      ip: actor.ip,
      userAgent: actor.userAgent,
      before,
      after: updates,
    });

    return after;
  }

  /**
   * Changing someone's role is the sharpest tool here — it rewrites what they can
   * see and do — so it is super-admin only, and provisions the profile the new
   * role needs rather than leaving the account half-configured.
   */
  async changeRole(publicId: string, newRole: Role, actor: AdminActor, reason?: string) {
    if (actor.role !== Role.SUPER_ADMIN) {
      throw new AuthorizationError('Only a super admin can change a role');
    }
    if (!ROLE_HIERARCHY[newRole]) throw invalid(`Unknown role "${newRole}"`);

    const user = await userRepository.findByPublicId(publicId);
    if (!user) throw new NotFoundError('User');
    if (user.publicId === actor.publicId) throw invalid('Cannot change your own role');
    if (user.role === newRole) throw invalid(`That account is already a ${newRole}`);

    await userRepository.update(publicId, { role: newRole });

    // The old profile stays (soft-flagged) so historical classes and ledger rows
    // still resolve; the new one is created if this role has never been held.
    const OldModel = PROFILE_MODELS[user.role];
    if (OldModel) {
      await OldModel.updateOne(
        { userPublicId: publicId },
        { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: actor.publicId } },
      );
    }
    await this.ensureProfileFor(publicId, newRole);

    await auditService.log({
      actorId: actor.publicId,
      actorRole: actor.role,
      action: 'USER_ROLE_CHANGED',
      resourceType: 'User',
      resourceId: publicId,
      ip: actor.ip,
      userAgent: actor.userAgent,
      before: { role: user.role },
      after: { role: newRole, reason },
    });

    return this.getUserDetail(publicId);
  }

  /** Creates (or un-deletes) the profile a role needs, with safe defaults. */
  private async ensureProfileFor(userPublicId: string, role: Role): Promise<void> {
    const ProfileModel = PROFILE_MODELS[role];
    if (!ProfileModel) return;

    const existing = await ProfileModel.findOne({ userPublicId }).lean();
    if (existing) {
      await ProfileModel.updateOne(
        { userPublicId },
        { $set: { isDeleted: false }, $unset: { deletedAt: '', deletedBy: '' } },
      );
      return;
    }

    const settings = await settingsService.get();
    const base = { publicId: uuidv4(), userPublicId, isDeleted: false };

    if (role === Role.STUDENT) {
      await StudentProfileModel.create({
        ...base,
        status: StudentStatus.PENDING_APPROVAL,
        previousTutorPublicIds: [],
        demoClassesUsed: 0,
        demoClassTakenWith: [],
        totalClassesAttended: 0,
        totalClassesMissed: 0,
        totalClassesBooked: 0,
        attendanceRate: 0,
        invitedBy: userPublicId,
      });
    } else if (role === Role.TUTOR) {
      await TutorProfileModel.create({
        ...base,
        status: TutorStatus.REGISTERED,
        subjects: [],
        languages: [],
        hourlyRateCents: 0,
        commissionRatePercent: settings.defaultTutorCommissionRatePercent,
        qualifications: [],
        timezone: 'UTC',
        trustScore: 50,
        totalStudents: 0,
        totalClassesCompleted: 0,
        totalClassesCancelled: 0,
        totalEarningsCents: 0,
        rating: 0,
        ratingCount: 0,
        isVerified: false,
      });
    } else if (role === Role.PRINCIPAL) {
      await PrincipalProfileModel.create({
        ...base,
        status: PrincipalStatus.PENDING_APPROVAL,
        commissionRatePercent: settings.defaultPrincipalCommissionRatePercent,
        totalTutors: 0,
        totalStudents: 0,
        totalRevenueCents: 0,
        trustScore: 50,
      });
    } else if (role === Role.PARENT) {
      await ParentProfileModel.create({ ...base, childStudentPublicIds: [] });
    }
  }

  /**
   * Soft delete: the account and its role profile are flagged, never dropped, so
   * classes, ledger rows and audit history keep resolving. Reversible via restore.
   */
  async deleteUser(publicId: string, actor: AdminActor, reason?: string) {
    const user = await userRepository.findByPublicId(publicId);
    if (!user) throw new NotFoundError('User');
    this.assertCanManage(user as PublicUser, actor, 'delete');

    await userRepository.softDelete(publicId, actor.publicId);

    const ProfileModel = PROFILE_MODELS[user.role];
    if (ProfileModel) {
      await ProfileModel.updateOne(
        { userPublicId: publicId },
        { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: actor.publicId } },
      );
    }

    await auditService.log({
      actorId: actor.publicId,
      actorRole: actor.role,
      action: 'USER_DELETED',
      resourceType: 'User',
      resourceId: publicId,
      ip: actor.ip,
      userAgent: actor.userAgent,
      before: { email: user.email, role: user.role, status: user.status },
      after: { isDeleted: true, reason },
    });
  }

  async restoreUser(publicId: string, actor: AdminActor) {
    // findByPublicId filters deleted rows out, so read the raw document here.
    const user = await UserModel.findOne({ publicId }).lean();
    if (!user) throw new NotFoundError('User');
    if (!user.isDeleted) throw invalid('That account is not deleted');
    this.assertCanManage(user as PublicUser, actor, 'restore');

    await UserModel.updateOne(
      { publicId },
      { $set: { isDeleted: false }, $unset: { deletedAt: '', deletedBy: '' } },
    );

    const ProfileModel = PROFILE_MODELS[user.role];
    if (ProfileModel) {
      await ProfileModel.updateOne(
        { userPublicId: publicId },
        { $set: { isDeleted: false }, $unset: { deletedAt: '', deletedBy: '' } },
      );
    }

    await auditService.log({
      actorId: actor.publicId,
      actorRole: actor.role,
      action: 'USER_RESTORED',
      resourceType: 'User',
      resourceId: publicId,
      ip: actor.ip,
      userAgent: actor.userAgent,
      after: { isDeleted: false },
    });

    return this.getUserDetail(publicId);
  }

  /**
   * Everything an admin needs about one user on a single screen: account,
   * role profile, wallet, activity counters and their recent audit trail.
   */
  async getUserDetail(publicId: string) {
    const user = await userRepository.findByPublicId(publicId);
    if (!user) throw new NotFoundError('User');

    const [wallet, ticketsOpened, recentAudit] = await Promise.all([
      WalletModel.findOne({ ownerPublicId: publicId, isDeleted: false }).lean(),
      TicketModel.countDocuments({ requesterPublicId: publicId, isDeleted: false }),
      AuditLogModel.find({ $or: [{ actorId: publicId }, { resourceId: publicId }] })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    let profile: Record<string, unknown> | null = null;
    let activity: UserActivity = { ...EMPTY_ACTIVITY, ticketsOpened };

    switch (user.role) {
      case Role.STUDENT: {
        const p = await StudentProfileModel.findOne({ userPublicId: publicId, isDeleted: false }).lean();
        profile = p as Record<string, unknown> | null;
        if (p) {
          const [counts, rate] = await Promise.all([
            classCounts('studentPublicId', p.publicId),
            attendanceRateFor('studentPublicId', p.publicId),
          ]);
          activity = { ...counts, attendanceRate: rate, ticketsOpened };
        }
        break;
      }
      case Role.TUTOR: {
        const p = await TutorProfileModel.findOne({ userPublicId: publicId, isDeleted: false }).lean();
        profile = p as Record<string, unknown> | null;
        if (p) {
          const [counts, rate] = await Promise.all([
            classCounts('tutorPublicId', p.publicId),
            attendanceRateFor('tutorPublicId', p.publicId),
          ]);
          activity = { ...counts, attendanceRate: rate, ticketsOpened };
        }
        break;
      }
      case Role.PRINCIPAL: {
        const p = await PrincipalProfileModel.findOne({ userPublicId: publicId, isDeleted: false }).lean();
        profile = p as Record<string, unknown> | null;
        break;
      }
      case Role.PARENT: {
        const p = await ParentProfileModel.findOne({ userPublicId: publicId, isDeleted: false }).lean();
        profile = p as Record<string, unknown> | null;
        break;
      }
      default:
        break;
    }

    return {
      user: user as PublicUser,
      profile,
      wallet: wallet
        ? {
            balanceCents: wallet.balanceCents,
            demoCreditsCents: wallet.demoCreditsCents,
            purchasedCreditsCents: wallet.purchasedCreditsCents,
            bonusCreditsCents: wallet.bonusCreditsCents,
            earnedCreditsCents: wallet.earnedCreditsCents,
            totalEarnedCents: wallet.totalEarnedCents,
            totalSpentCents: wallet.totalSpentCents,
            currency: wallet.currency,
            isLocked: wallet.isLocked,
          }
        : null,
      activity,
      recentAudit,
    };
  }
}

export const userAdminService = new UserAdminService();
