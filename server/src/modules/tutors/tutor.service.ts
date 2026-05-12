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

  async getByUserPublicId(userPublicId: string): Promise<ITutorProfile> {
    const profile = await tutorRepository.findByUserPublicId(userPublicId);
    if (!profile) throw new NotFoundError('Tutor profile');
    return profile;
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

    domainEvents.emit('TUTOR_APPROVED', { tutorPublicId: publicId, approvedBy });
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
  ): Promise<PaginatedResult<ITutorProfile>> {
    return tutorRepository.search(filters, query);
  }

  async getByPrincipal(
    principalPublicId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<ITutorProfile>> {
    return tutorRepository.findByPrincipal(principalPublicId, query);
  }

  async getPending(
    query: PaginationQuery,
    principalPublicId?: string,
  ): Promise<PaginatedResult<ITutorProfile>> {
    return tutorRepository.findPending(query, principalPublicId);
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
