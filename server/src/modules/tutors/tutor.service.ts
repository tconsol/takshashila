import { v4 as uuidv4 } from 'uuid';
import argon2 from 'argon2';
import crypto from 'crypto';
import { tutorRepository } from './tutor.repository';
import { TutorStatus } from './tutor.types';
import type { ITutorProfile, TutorSearchFilters } from './tutor.types';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { NotFoundError, ConflictError } from '../../utils/error';
import { domainEvents } from '../../events/event-emitter';
import { walletService } from '../wallets/wallet.service';
import { userRepository } from '../users/user.repository';
import { UserStatus } from '../users/user.types';
import { DomainEvent } from '../../constants/events';
import type { UpdateTutorProfileDto } from './tutor.validators';
import { PrincipalProfileModel } from '../principals/principal.model';

export class TutorService {
  async createProfile(
    userPublicId: string,
    principalPublicId: string | undefined,
    invitedBy: string,
    data: Partial<ITutorProfile>,
  ): Promise<ITutorProfile> {
    const existing = await tutorRepository.findByUserPublicId(userPublicId);
    if (existing) throw new ConflictError('Tutor profile already exists for this user');

    const profile = await tutorRepository.create({
      publicId: uuidv4(),
      userPublicId,
      principalPublicId,
      status: TutorStatus.REGISTERED,
      subjects: data.subjects || [],
      languages: data.languages || [],
      hourlyRateCents: data.hourlyRateCents || 0,
      commissionRatePercent: 20,
      bio: data.bio,
      qualifications: data.qualifications || [],
      timezone: data.timezone || 'UTC',
      trustScore: 50,
      totalStudents: 0,
      totalClassesCompleted: 0,
      totalClassesCancelled: 0,
      totalEarningsCents: 0,
      rating: 0,
      ratingCount: 0,
      isVerified: false,
      invitedBy,
      isDeleted: false,
    });

    await walletService.createWallet(userPublicId).catch(() => {});
    return profile;
  }

  async getByPublicId(publicId: string): Promise<ITutorProfile> {
    const profile = await tutorRepository.findByPublicId(publicId);
    if (!profile) throw new NotFoundError('Tutor profile');
    return profile;
  }

  async getByPublicIdForDisplay(publicId: string): Promise<ITutorProfile & { displayName: string; email: string }> {
    const profile = await this.getByPublicId(publicId);
    return this._hydrateOne(profile);
  }

  async getByUserPublicId(userPublicId: string): Promise<ITutorProfile> {
    const profile = await tutorRepository.findByUserPublicId(userPublicId);
    if (!profile) throw new NotFoundError('Tutor profile');
    return profile;
  }

  async getByUserPublicIdForDisplay(userPublicId: string): Promise<ITutorProfile & { displayName: string; email: string }> {
    const profile = await this.getByUserPublicId(userPublicId);
    return this._hydrateOne(profile);
  }

  private async _hydrateOne(profile: ITutorProfile): Promise<ITutorProfile & { displayName: string; email: string }> {
    const user = await userRepository.findByPublicId(profile.userPublicId);
    return {
      ...profile,
      displayName: user ? `${user.firstName} ${user.lastName}`.trim() : 'Unknown Tutor',
      email: user?.email ?? '',
    };
  }

  async getMyPrincipal(tutorUserPublicId: string): Promise<(object & { firstName: string; lastName: string; email: string }) | null> {
    const tutorProfile = await tutorRepository.findByUserPublicId(tutorUserPublicId);
    if (!tutorProfile || !tutorProfile.principalPublicId) return null;

    const principalProfiles = await PrincipalProfileModel.aggregate([
      { $match: { userPublicId: tutorProfile.principalPublicId, isDeleted: false } },
      {
        $lookup: {
          from: 'users',
          localField: 'userPublicId',
          foreignField: 'publicId',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      // Compute live tutor/student counts so stale counters don't show wrong numbers
      {
        $lookup: {
          from: 'tutorprofiles',
          let: { pUserPublicId: '$userPublicId' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$principalPublicId', '$$pUserPublicId'] }, { $eq: ['$isDeleted', false] }] } } },
          ],
          as: 'tutors',
        },
      },
      {
        $addFields: {
          firstName: { $ifNull: ['$user.firstName', ''] },
          lastName: { $ifNull: ['$user.lastName', ''] },
          email: { $ifNull: ['$user.email', ''] },
          totalTutors: { $size: '$tutors' },
        },
      },
      { $project: { user: 0, tutors: 0 } },
    ]);

    return principalProfiles[0] ?? null;
  }

  async updateProfile(publicId: string, dto: UpdateTutorProfileDto): Promise<ITutorProfile> {
    const updated = await tutorRepository.update(publicId, dto);
    if (!updated) throw new NotFoundError('Tutor profile');
    return updated;
  }

  async submitForVerification(publicId: string): Promise<ITutorProfile> {
    const profile = await this.getByPublicId(publicId);

    if (profile.status !== TutorStatus.REGISTERED) {
      throw new ConflictError(`Cannot submit from status: ${profile.status}`);
    }

    const updated = await tutorRepository.update(publicId, {
      status: TutorStatus.UNDER_VERIFICATION,
    });
    return updated!;
  }

  async approve(publicId: string, approvedBy: string): Promise<ITutorProfile> {
    const profile = await this.getByPublicId(publicId);

    if (profile.status !== TutorStatus.UNDER_VERIFICATION) {
      throw new ConflictError(`Cannot approve from status: ${profile.status}`);
    }

    const updated = await tutorRepository.update(publicId, {
      status: TutorStatus.ACTIVE,
      isVerified: true,
      verifiedAt: new Date(),
      verifiedBy: approvedBy,
    });

    domainEvents.emit(DomainEvent.TUTOR_APPROVED, { tutorPublicId: publicId, userPublicId: updated!.userPublicId, approvedBy });
    return updated!;
  }

  async suspend(publicId: string): Promise<ITutorProfile> {
    const updated = await tutorRepository.update(publicId, { status: TutorStatus.SUSPENDED });
    if (!updated) throw new NotFoundError('Tutor profile');
    return updated;
  }

  async reactivate(publicId: string): Promise<ITutorProfile> {
    const updated = await tutorRepository.update(publicId, { status: TutorStatus.ACTIVE });
    if (!updated) throw new NotFoundError('Tutor profile');
    return updated;
  }

  async search(
    filters: TutorSearchFilters,
    query: PaginationQuery,
  ): Promise<PaginatedResult<ITutorProfile & { displayName: string }>> {
    const result = await tutorRepository.search(filters, query);

    // Hydrate each tutor profile with the user's full name
    const userPublicIds = result.items.map((t) => t.userPublicId);
    const users = await userRepository.findManyByPublicIds(userPublicIds);
    const userMap = new Map(users.map((u) => [u.publicId, u]));

    const hydrated = result.items.map((t) => {
      const u = userMap.get(t.userPublicId);
      return { ...t, displayName: u ? `${u.firstName} ${u.lastName}` : 'Unknown Tutor' };
    });

    return { ...result, items: hydrated };
  }

  async getByPrincipal(
    principalPublicId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<ITutorProfile & { displayName: string; email: string }>> {
    const result = await tutorRepository.findByPrincipal(principalPublicId, query);
    return this._hydrateWithUser(result);
  }

  async getByPrincipalProfile(
    profilePublicId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<ITutorProfile & { displayName: string; email: string }>> {
    const principalProfile = await PrincipalProfileModel.findOne({ publicId: profilePublicId, isDeleted: false }).lean();
    if (!principalProfile) throw new NotFoundError('Principal not found');
    const result = await tutorRepository.findByPrincipal(principalProfile.userPublicId, query);
    return this._hydrateWithUser(result);
  }

  async getPending(
    query: PaginationQuery,
    principalPublicId?: string,
  ): Promise<PaginatedResult<ITutorProfile & { displayName: string; email: string }>> {
    const result = await tutorRepository.findPending(query, principalPublicId);
    return this._hydrateWithUser(result);
  }

  private async _hydrateWithUser(
    result: PaginatedResult<ITutorProfile>,
  ): Promise<PaginatedResult<ITutorProfile & { displayName: string; email: string }>> {
    const userPublicIds = result.items.map((t) => t.userPublicId);
    const users = await userRepository.findManyByPublicIds(userPublicIds);
    const userMap = new Map(users.map((u) => [u.publicId, u]));
    const hydrated = result.items.map((t) => {
      const u = userMap.get(t.userPublicId);
      return {
        ...t,
        displayName: u ? `${u.firstName} ${u.lastName}` : 'Unknown Tutor',
        email: u?.email ?? '',
      };
    });
    return { ...result, items: hydrated };
  }

  /**
   * Invite a new tutor to the platform under a principal.
   * Creates a User + TutorProfile with status=INVITED.
   * Emits USER_REGISTERED so the email queue sends an invite link with the verification token.
   */
  async inviteTutor(params: {
    email: string;
    firstName: string;
    lastName: string;
    subjects?: string[];
    hourlyRateCents?: number;
    principalPublicId: string;
    invitedBy: string;
  }): Promise<ITutorProfile> {
    const emailLc = params.email.toLowerCase();
    const exists = await userRepository.existsByEmail(emailLc);
    if (exists) throw new ConflictError('A user with this email already exists');

    // Generate a one-time password the tutor resets it via the invite link
    const tempPassword = crypto.randomBytes(16).toString('hex');
    const passwordHash = await argon2.hash(tempPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const user = await userRepository.create({
      publicId: uuidv4(),
      email: emailLc,
      passwordHash,
      firstName: params.firstName,
      lastName: params.lastName,
      role: 'TUTOR',
      status: UserStatus.PENDING_VERIFICATION,
      timezone: 'UTC',
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpiry: verificationExpiry,
      twoFAEnabled: false,
      loginCount: 0,
      isDeleted: false,
    });

    const profile = await tutorRepository.create({
      publicId: uuidv4(),
      userPublicId: user.publicId,
      principalPublicId: params.principalPublicId,
      status: TutorStatus.INVITED,
      subjects: params.subjects ?? [],
      languages: [],
      hourlyRateCents: params.hourlyRateCents ?? 0,
      commissionRatePercent: 20,
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
      invitedBy: params.invitedBy,
      isDeleted: false,
    });

    await walletService.createWallet(user.publicId).catch(() => {});

    domainEvents.emit(DomainEvent.USER_REGISTERED, {
      userId: user.publicId,
      email: user.email,
      role: user.role,
      verificationToken,
      isInvite: true,
      firstName: params.firstName,
      lastName: params.lastName,
      invitedBy: params.invitedBy,
    });

    return profile;
  }

  async recordClassCompleted(publicId: string, earningsCents: number): Promise<void> {
    await tutorRepository.incrementStats(publicId, {
      totalClassesCompleted: 1,
      totalEarningsCents: earningsCents,
    });
  }

  async recordClassCancelled(publicId: string): Promise<void> {
    await tutorRepository.incrementStats(publicId, { totalClassesCancelled: 1 });
  }
}

export const tutorService = new TutorService();
