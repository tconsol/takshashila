import argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { studentRepository } from './student.repository';
import { buildLocationUpdate } from '../geo/location-update';
import { StudentProfileModel } from './student.model';
import { StudentStatus } from './student.types';
import type { IStudentProfile, TransferStudentDto } from './student.types';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { NotFoundError, ConflictError, AppError, ValidationError } from '../../utils/error';
import { geoService } from '../geo/geo.service';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { LEGAL_VERSION } from '../../config/legal';
import { walletService } from '../wallets/wallet.service';
import { CreditType } from '../wallets/wallet.types';
import { userRepository } from '../users/user.repository';
import { UserStatus } from '../users/user.types';
import { tutorRepository } from '../tutors/tutor.repository';
import type { CreateStudentByTutorDto, InviteExistingStudentDto, CreateStudentByPrincipalDto, InviteStudentByPrincipalDto, CreateStudentByParentDto } from './student.validators';
import { PrincipalProfileModel } from '../principals/principal.model';
import { TutorProfileModel } from '../tutors/tutor.model';
import { ParentProfileModel } from '../parents/parent.model';
import { enqueueEmail } from '../../queues/email.queue';
import { settingsService } from '../settings/settings.service';
import { logger } from '../../lib/logger';

// Statuses for which a tutor's TutorProfile.totalStudents counter was
// actually incremented (see approve()/acceptInvite()/createByPrincipal()) —
// PENDING_APPROVAL and INACTIVE never were, so removing/transferring a
// student in those statuses must never decrement it.
const COUNTED_STUDENT_STATUSES: StudentStatus[] = [StudentStatus.ACTIVE, StudentStatus.SUSPENDED];

const isCounted = (status?: StudentStatus): boolean => !!status && COUNTED_STUDENT_STATUSES.includes(status);

/**
 * Single rule for every totalStudents counter write: the tutor's and the
 * principal's counters only move when the counted-ness of the student's status
 * changes. Pass oldStatus=undefined for a brand-new / newly attached student
 * and newStatus=undefined for a removed / detached one. principalUserPublicId
 * is the principal's USER publicId (TutorProfile.principalPublicId). Failures
 * are logged, never thrown.
 */
export async function adjustCountersForStatusChange(
  oldStatus: StudentStatus | undefined,
  newStatus: StudentStatus | undefined,
  tutorPublicId?: string,
  principalUserPublicId?: string,
): Promise<void> {
  const delta = (isCounted(newStatus) ? 1 : 0) - (isCounted(oldStatus) ? 1 : 0);
  if (delta === 0) return;
  if (tutorPublicId) {
    try {
      await tutorRepository.incrementStats(tutorPublicId, { totalStudents: delta });
    } catch (err) {
      logger.error('Failed to adjust tutor totalStudents', { err, tutorPublicId, delta, oldStatus, newStatus });
    }
  }
  if (principalUserPublicId) {
    try {
      await PrincipalProfileModel.updateOne({ userPublicId: principalUserPublicId, isDeleted: false }, { $inc: { totalStudents: delta } });
    } catch (err) {
      logger.error('Failed to adjust principal totalStudents', { err, principalUserPublicId, tutorPublicId, delta, oldStatus, newStatus });
    }
  }
}

async function principalOfTutor(tutorPublicId?: string): Promise<string | undefined> {
  if (!tutorPublicId) return undefined;
  const tutor = await tutorRepository.findByPublicId(tutorPublicId);
  return tutor?.principalPublicId;
}

export interface StudentActor {
  userPublicId: string;
  role: string;
}

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

/**
 * Ownership rule for managing (approve/reject/suspend/transfer/unlink/status)
 * a student. ADMIN/SUPER_ADMIN: any. TUTOR: the student is theirs (tutorPublicId),
 * or is a still-unassigned/pending student that requested them
 * (pendingTutorPublicId) or that they invited (invitedBy) - this keeps the
 * tutor's pending-approval flow working. PRINCIPAL: the student's (pending)
 * tutor belongs to them, or an unassigned student they invited. Failure is a
 * NotFoundError so student existence is not leaked.
 */
export async function assertActorCanManageStudent(
  profile: Pick<IStudentProfile, 'tutorPublicId' | 'pendingTutorPublicId' | 'invitedBy' | 'status'>,
  actor: StudentActor,
): Promise<void> {
  if (ADMIN_ROLES.includes(actor.role)) return;
  let allowed = false;
  if (actor.role === 'TUTOR') {
    const mine = (await tutorRepository.findByUserPublicId(actor.userPublicId))?.publicId;
    if (mine) {
      if (profile.tutorPublicId === mine) allowed = true;
      else if (profile.status === StudentStatus.PENDING_APPROVAL && profile.pendingTutorPublicId === mine) allowed = true;
      else if (!profile.tutorPublicId && !profile.pendingTutorPublicId && profile.invitedBy === actor.userPublicId) allowed = true;
    }
  } else if (actor.role === 'PRINCIPAL') {
    const tutorId = profile.pendingTutorPublicId ?? profile.tutorPublicId;
    if (tutorId) {
      const tutor = await tutorRepository.findByPublicId(tutorId);
      allowed = !!tutor && tutor.principalPublicId === actor.userPublicId;
    } else {
      allowed = profile.invitedBy === actor.userPublicId;
    }
  }
  if (!allowed) throw new NotFoundError('Student profile');
}

function buildWelcomeEmail(opts: {
  firstName: string;
  lastName: string;
  studentId: string;
  grade?: string;
}): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px;background:#fafafa;border-radius:16px;border:2px solid #1a1a2e">
      <h2 style="margin:0 0 8px;color:#1a1a2e">Welcome to brainbaseedu! 🎓</h2>
      <p style="color:#555;margin:0 0 24px">A student account has been created for <strong>${opts.firstName} ${opts.lastName}</strong>.</p>
      <div style="background:#fff;border:2px solid #1a1a2e;border-radius:12px;padding:20px;margin-bottom:20px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#888;font-size:13px">Student ID (login)</td><td style="padding:6px 0;font-weight:700;font-family:monospace;font-size:16px;letter-spacing:2px;color:#1a1a2e">${opts.studentId}</td></tr>
          ${opts.grade ? `<tr><td style="padding:6px 0;color:#888;font-size:13px">Grade</td><td style="padding:6px 0;font-weight:600;color:#1a1a2e">${opts.grade}</td></tr>` : ''}
        </table>
      </div>
      <p style="color:#888;font-size:12px">Your child logs in using the <strong>Student ID</strong> (not an email address) and the password chosen when the account was created. For your child's safety the password is <strong>never sent by email</strong>: ask the person who created the account for it, and change it from Profile &rarr; Security after the first sign-in.</p>
    </div>
  `;
}

// Demo-class limits now live in platform settings (settingsService.get()).

/** Keep a record that a parent/guardian agreed to the policies for a child account. */
async function recordGuardianConsent(profilePublicId: string, byUserPublicId: string, byRole: string): Promise<void> {
  await StudentProfileModel.updateOne(
    { publicId: profilePublicId },
    { $set: { guardianConsent: { givenBy: byUserPublicId, givenByRole: byRole, givenAt: new Date(), version: LEGAL_VERSION } } },
  );
}

async function generateStudentId(firstName: string, lastName: string): Promise<string> {
  const f = (firstName[0] || 'x').toLowerCase().replace(/[^a-z]/, 'x');
  const l = (lastName[0] || 'x').toLowerCase().replace(/[^a-z]/, 'x');
  const base = `stu${f}${l}`;
  for (let i = 0; i < 20; i++) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    const id = `${base}${rand}`;
    const exists = await userRepository.existsByStudentId(id);
    if (!exists) return id;
  }
  // fallback: add more digits
  return `${base}${Date.now().toString().slice(-6)}`;
}

export class StudentService {
  async createByTutor(
    tutorUserPublicId: string,
    dto: CreateStudentByTutorDto,
  ): Promise<IStudentProfile & { firstName: string; lastName: string; studentId: string; contactEmail?: string }> {
    const { tutorService } = await import('../tutors/tutor.service');
    const tutorProfile = await tutorService.getByUserPublicId(tutorUserPublicId);
    // Checked first so a bad county never leaves a half-created account behind.
    const location = buildLocationUpdate({ state: dto.state, countyFips: dto.countyFips }).set;

    // Validate custom studentId uniqueness
    if (dto.customStudentId) {
      const taken = await userRepository.existsByStudentId(dto.customStudentId);
      if (taken) throw new ConflictError('This Student ID is already in use');
    }

    const studentId = dto.customStudentId?.toLowerCase() ?? await generateStudentId(dto.firstName, dto.lastName);
    // Internal unique email students log in by studentId, not email
    const internalEmail = `${studentId}@student.internal`;

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    const user = await userRepository.create({
      publicId: uuidv4(),
      email: internalEmail,
      studentId,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: 'STUDENT',
      status: UserStatus.ACTIVE,
      emailVerified: true,
      phone: dto.phone,
      timezone: 'UTC',
      twoFAEnabled: false,
      loginCount: 0,
      isDeleted: false,
    });

    await walletService.createWallet(user.publicId).catch(() => {});

    const profile = await studentRepository.create({
      publicId: uuidv4(),
      userPublicId: user.publicId,
      tutorPublicId: tutorProfile.publicId,
      contactEmail: dto.contactEmail?.toLowerCase(),
      previousTutorPublicIds: [],
      status: StudentStatus.ACTIVE,
      demoClassesUsed: 0,
      demoClassTakenWith: [],
      totalClassesAttended: 0,
      totalClassesMissed: 0,
      totalClassesBooked: 0,
      attendanceRate: 0,
      grade: dto.grade,
      ...location,
      notes: dto.notes,
      invitedBy: tutorUserPublicId,
      approvedBy: tutorUserPublicId,
      approvedAt: new Date(),
      isDeleted: false,
    });

    await adjustCountersForStatusChange(undefined, StudentStatus.ACTIVE, tutorProfile.publicId, tutorProfile.principalPublicId);

    domainEvents.emit(DomainEvent.STUDENT_APPROVED, {
      studentPublicId: profile.publicId,
      studentUserPublicId: user.publicId,
      tutorUserPublicId,
      approvedBy: tutorUserPublicId,
    });

    if (dto.contactEmail) {
      await enqueueEmail({
        to: dto.contactEmail,
        subject: `Student account created for ${dto.firstName} on brainbaseedu`,
        html: buildWelcomeEmail({ firstName: dto.firstName, lastName: dto.lastName, studentId, grade: dto.grade }),
      });
    }

    await recordGuardianConsent(profile.publicId, tutorUserPublicId, 'TUTOR');
    await walletService.initializeDemoCredits(user.publicId).catch(() => {});

    return {
      ...profile,
      firstName: user.firstName,
      lastName: user.lastName,
      studentId,
    };
  }

  async createProfile(
    userPublicId: string,
    tutorPublicId: string,
    invitedBy: string,
    data: { grade?: string; notes?: string },
  ): Promise<IStudentProfile> {
    const existing = await studentRepository.findByUserAndTutor(userPublicId, tutorPublicId);
    if (existing) throw new ConflictError('Student already assigned to this tutor');

    const profile = await studentRepository.create({
      publicId: uuidv4(),
      userPublicId,
      tutorPublicId,
      previousTutorPublicIds: [],
      status: StudentStatus.PENDING_APPROVAL,
      demoClassesUsed: 0,
      demoClassTakenWith: [],
      totalClassesAttended: 0,
      totalClassesMissed: 0,
      totalClassesBooked: 0,
      attendanceRate: 0,
      grade: data.grade,
      notes: data.notes,
      invitedBy,
      isDeleted: false,
    });

    domainEvents.emit(DomainEvent.STUDENT_INVITED, {
      studentPublicId: profile.publicId,
      userPublicId,
      tutorPublicId,
    });

    return profile;
  }

  async approve(publicId: string, actor: StudentActor): Promise<IStudentProfile> {
    const approvedBy = actor.userPublicId;
    const profile = await studentRepository.findByPublicId(publicId);
    if (!profile) throw new NotFoundError('Student profile');
    await assertActorCanManageStudent(profile, actor);

    if (profile.status !== StudentStatus.PENDING_APPROVAL) {
      throw new ConflictError(`Cannot approve from status: ${profile.status}`);
    }

    const updated = await studentRepository.update(publicId, {
      status: StudentStatus.ACTIVE,
      approvedBy,
      approvedAt: new Date(),
    });

    await walletService.initializeDemoCredits(profile.userPublicId).catch(() => {});
    await adjustCountersForStatusChange(profile.status, StudentStatus.ACTIVE, profile.tutorPublicId, await principalOfTutor(profile.tutorPublicId));

    domainEvents.emit(DomainEvent.STUDENT_APPROVED, {
      studentPublicId: publicId,
      studentUserPublicId: profile.userPublicId,
      tutorUserPublicId: approvedBy,
      approvedBy,
    });

    return updated!;
  }

  async reject(publicId: string, actor: StudentActor): Promise<void> {
    const profile = await studentRepository.findByPublicId(publicId);
    if (!profile) throw new NotFoundError('Student profile');
    await assertActorCanManageStudent(profile, actor);
    await studentRepository.update(publicId, { status: StudentStatus.INACTIVE });
    await adjustCountersForStatusChange(profile.status, StudentStatus.INACTIVE, profile.tutorPublicId, await principalOfTutor(profile.tutorPublicId));
  }

  async suspend(publicId: string, actor: StudentActor): Promise<IStudentProfile> {
    const before = await studentRepository.findByPublicId(publicId);
    if (!before) throw new NotFoundError('Student profile');
    await assertActorCanManageStudent(before, actor);
    const updated = await studentRepository.update(publicId, { status: StudentStatus.SUSPENDED });
    if (!updated) throw new NotFoundError('Student profile');
    await adjustCountersForStatusChange(before.status, StudentStatus.SUSPENDED, before.tutorPublicId, await principalOfTutor(before.tutorPublicId));
    return updated;
  }

  async transfer(publicId: string, dto: TransferStudentDto, actor: StudentActor): Promise<IStudentProfile> {
    const actorId = actor.userPublicId;
    const profile = await studentRepository.findByPublicId(publicId);
    if (!profile) throw new NotFoundError('Student profile');
    await assertActorCanManageStudent(profile, actor);

    const target = await tutorRepository.findByPublicId(dto.newTutorPublicId);
    if (!target) throw new NotFoundError('Tutor');
    if (!ADMIN_ROLES.includes(actor.role)) {
      let inScope = false;
      if (actor.role === 'PRINCIPAL') {
        inScope = target.principalPublicId === actor.userPublicId;
      } else if (actor.role === 'TUTOR') {
        const me = await tutorRepository.findByUserPublicId(actor.userPublicId);
        inScope = !!me && (me.publicId === target.publicId || (!!me.principalPublicId && me.principalPublicId === target.principalPublicId));
      }
      if (!inScope) throw new NotFoundError('Tutor');
    }

    if (profile.tutorPublicId === dto.newTutorPublicId) {
      throw new ConflictError('Student is already assigned to this tutor');
    }

    // Transfer preserves approval state: PENDING_APPROVAL / INACTIVE /
    // SUSPENDED stay as they are; anything else (ACTIVE, TRANSFERRED) becomes
    // ACTIVE with the new tutor.
    const keepStatuses: StudentStatus[] = [StudentStatus.PENDING_APPROVAL, StudentStatus.INACTIVE, StudentStatus.SUSPENDED];
    const newStatus = keepStatuses.includes(profile.status) ? profile.status : StudentStatus.ACTIVE;

    const updated = await studentRepository.update(publicId, {
      tutorPublicId: dto.newTutorPublicId,
      previousTutorPublicIds: profile.tutorPublicId
        ? [...profile.previousTutorPublicIds, profile.tutorPublicId]
        : profile.previousTutorPublicIds,
      // ACTIVE rather than TRANSFERRED (which would look stale on the new
      // tutor's page); the move is recorded via transferredFrom/At below.
      status: newStatus,
      transferredFrom: profile.tutorPublicId,
      transferredAt: new Date(),
    });

    // Keep tutor and principal totalStudents in sync. Cross-org moves shift
    // the principal counters; same-org moves leave the principal net-zero.
    const oldPrincipal = await principalOfTutor(profile.tutorPublicId);
    const newPrincipal = await principalOfTutor(dto.newTutorPublicId);
    const samePrincipal = oldPrincipal === newPrincipal;
    await adjustCountersForStatusChange(profile.status, undefined, profile.tutorPublicId, samePrincipal ? undefined : oldPrincipal);
    await adjustCountersForStatusChange(undefined, newStatus, dto.newTutorPublicId, samePrincipal ? undefined : newPrincipal);

    domainEvents.emit(DomainEvent.STUDENT_TRANSFERRED, {
      studentPublicId: publicId,
      fromTutor: profile.tutorPublicId,
      toTutor: dto.newTutorPublicId,
      actorId,
    });

    return updated!;
  }

  async getByPublicId(publicId: string): Promise<IStudentProfile> {
    const profile = await studentRepository.findByPublicId(publicId);
    if (!profile) throw new NotFoundError('Student profile');
    return profile;
  }

  async getByUserPublicId(userPublicId: string): Promise<IStudentProfile> {
    const profile = await studentRepository.findByUserPublicId(userPublicId);
    if (!profile) throw new NotFoundError('Student profile');
    return profile;
  }

  async updateMyProfile(
    userPublicId: string,
    data: { grade?: string; country?: string; state?: string; countyFips?: string; districtId?: string },
  ): Promise<IStudentProfile> {
    const $set: Record<string, unknown> = { ...data };
    let $unset: Record<string, ''> | undefined;
    if (data.districtId) {
      const district = geoService.getDistrict(data.districtId);
      if (!district) throw new ValidationError({ districtId: [`Unknown school district ${data.districtId}`] });
      Object.assign($set, {
        country: 'US',
        state: district.state,
        countyFips: district.countyFips,
        county: geoService.getCounty(district.countyFips)?.name ?? district.countyFips,
        district: district.name,
      });
    } else if (data.countyFips) {
      const county = geoService.getCounty(data.countyFips);
      if (!county) throw new ValidationError({ countyFips: [`Unknown county ${data.countyFips}`] });
      $set.country = data.country ?? 'US';
      $set.county = county.name;
      // A district belongs to one county; don't leave the old one behind.
      $unset = { districtId: '', district: '' };
    }
    const updated = await StudentProfileModel.findOneAndUpdate(
      { userPublicId, isDeleted: false },
      $unset ? { $set, $unset } : { $set },
      { new: true },
    ).lean();
    if (!updated) throw new NotFoundError('Student profile');
    return updated;
  }

  async getByTutor(
    tutorPublicId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<IStudentProfile & { firstName: string; lastName: string; displayName: string }>> {
    const result = await studentRepository.findByTutor(tutorPublicId, query);

    const userPublicIds = result.items.map((s) => s.userPublicId);
    const users = await userRepository.findManyByPublicIds(userPublicIds);
    const userMap = new Map(users.map((u) => [u.publicId, u]));

    const hydrated = result.items.map((s) => {
      const u = userMap.get(s.userPublicId);
      const firstName = u?.firstName ?? '';
      const lastName = u?.lastName ?? '';
      return { ...s, firstName, lastName, displayName: `${firstName} ${lastName}`.trim() || 'Student', email: u?.email ?? '' };
    });

    return { ...result, items: hydrated };
  }

  async lookupByEmailOrPhone(
    tutorUserPublicId: string,
    dto: InviteExistingStudentDto,
  ): Promise<{ publicId: string; firstName: string; lastName: string; studentId?: string; contactEmail?: string; phone?: string; alreadyLinked: boolean }> {
    const { tutorService } = await import('../tutors/tutor.service');
    const tutorProfile = await tutorService.getByUserPublicId(tutorUserPublicId);

    let user = null;
    let contactEmail: string | undefined;

    if (dto.studentId) {
      user = await userRepository.findByStudentId(dto.studentId);
      // A student ID and an account ID are both "the id on their account" to a
      // tutor, so accept either rather than making them know the difference.
      if (!user) user = await userRepository.findByPublicId(dto.studentId);
    } else if (dto.email) {
      // A student may be reachable at two addresses: the one they sign in with,
      // and a guardian's contact address shared across siblings. Check the
      // shared contact address first, since that is the ambiguous one, then
      // fall back to the login email — omitting that fallback was why searching
      // a student's own account email found nothing.
      const profiles = await studentRepository.findManyByContactEmail(dto.email);
      if (profiles.length > 0) {
        // Prefer a match that isn't already linked to this tutor.
        for (const p of profiles) {
          const linked = await studentRepository.findByUserAndTutor(p.userPublicId, tutorProfile.publicId);
          if (!linked) {
            user = await userRepository.findByPublicId(p.userPublicId);
            contactEmail = p.contactEmail;
            break;
          }
        }
        if (!user) {
          // All already linked — return the first so the caller can say so.
          user = await userRepository.findByPublicId(profiles[0].userPublicId);
          contactEmail = profiles[0].contactEmail;
        }
      }
      if (!user) user = await userRepository.findByEmail(dto.email);
    } else if (dto.phone) {
      user = await userRepository.findByPhone(dto.phone);
    }

    if (!user) throw new NotFoundError('No student account found');
    if (user.role !== 'STUDENT') throw new AppError('This account is not a student', 400);

    const existing = await studentRepository.findByUserAndTutor(user.publicId, tutorProfile.publicId);
    return {
      publicId: user.publicId,
      firstName: user.firstName,
      lastName: user.lastName,
      studentId: user.studentId,
      contactEmail: contactEmail,
      phone: user.phone,
      alreadyLinked: !!existing,
    };
  }

  async inviteExisting(
    tutorUserPublicId: string,
    dto: InviteExistingStudentDto,
  ): Promise<IStudentProfile> {
    const { tutorService } = await import('../tutors/tutor.service');
    const tutorProfile = await tutorService.getByUserPublicId(tutorUserPublicId);

    let user = null;
    if (dto.studentId) {
      user = await userRepository.findByStudentId(dto.studentId);
      if (!user) user = await userRepository.findByPublicId(dto.studentId);
    } else if (dto.email) {
      // Same two-address resolution as the lookup above — keep them in step,
      // or a student who can be found cannot then be invited.
      const profiles = await studentRepository.findManyByContactEmail(dto.email);
      if (profiles.length > 0) {
        user = await userRepository.findByPublicId(profiles[0].userPublicId);
      }
      if (!user) user = await userRepository.findByEmail(dto.email);
    } else if (dto.phone) {
      user = await userRepository.findByPhone(dto.phone!);
    }

    if (!user) throw new NotFoundError('No student account found');
    if (user.role !== 'STUDENT') throw new AppError('This account is not a student', 400);

    const existing = await studentRepository.findByUserAndTutor(user.publicId, tutorProfile.publicId);
    if (existing) throw new ConflictError('This student is already linked to your account');

    // Check if they already have a profile with no tutor update it
    const profileWithoutTutor = await StudentProfileModel.findOne({
      userPublicId: user.publicId,
      tutorPublicId: { $exists: false },
      isDeleted: false,
    }).lean();

    let profile: IStudentProfile;
    if (profileWithoutTutor) {
      // A tutor's direct invite supersedes any tutor a parent had requested.
      const updated = await StudentProfileModel.findOneAndUpdate(
        { publicId: profileWithoutTutor.publicId, isDeleted: false },
        {
          $set: {
            tutorPublicId: tutorProfile.publicId,
            status: StudentStatus.PENDING_APPROVAL,
            invitedBy: tutorUserPublicId,
          },
          $unset: { pendingTutorPublicId: '' },
        },
        { new: true },
      ).lean();
      profile = updated!;
    } else {
      profile = await studentRepository.create({
        publicId: uuidv4(),
        userPublicId: user.publicId,
        tutorPublicId: tutorProfile.publicId,
        previousTutorPublicIds: [],
        status: StudentStatus.PENDING_APPROVAL,
        demoClassesUsed: 0,
        demoClassTakenWith: [],
        totalClassesAttended: 0,
        totalClassesMissed: 0,
        totalClassesBooked: 0,
        attendanceRate: 0,
        invitedBy: tutorUserPublicId,
        isDeleted: false,
      });
    }

    domainEvents.emit(DomainEvent.STUDENT_INVITED, {
      studentPublicId: profile.publicId,
      userPublicId: user.publicId,
      tutorPublicId: tutorProfile.publicId,
      tutorUserPublicId,
    });

    return profile;
  }

  /**
   * The profile an accept/decline acts on. A student can hold several profiles
   * (one per tutor link), so the first one is not necessarily the invite:
   * use the link the student clicked, else their pending invite.
   */
  private async findInviteProfile(studentUserPublicId: string, linkId?: string): Promise<IStudentProfile> {
    if (linkId) return this.assertOwnsLink(studentUserPublicId, linkId);
    const pending = await StudentProfileModel.findOne({
      userPublicId: studentUserPublicId,
      status: StudentStatus.PENDING_APPROVAL,
      isDeleted: false,
    }).lean();
    const profile = pending ?? (await studentRepository.findByUserPublicId(studentUserPublicId));
    if (!profile) throw new NotFoundError('No pending invite found');
    return profile as unknown as IStudentProfile;
  }

  async acceptInvite(studentUserPublicId: string, linkId?: string): Promise<IStudentProfile> {
    const profile = await this.findInviteProfile(studentUserPublicId, linkId);
    if (profile.status !== StudentStatus.PENDING_APPROVAL) {
      throw new ConflictError('No pending invite to accept');
    }

    // A parent-requested tutor only becomes the live tutor here, on acceptance.
    const newTutorPublicId = profile.pendingTutorPublicId ?? profile.tutorPublicId;
    const updated = await StudentProfileModel.findOneAndUpdate(
      { publicId: profile.publicId, isDeleted: false },
      {
        $set: {
          status: StudentStatus.ACTIVE,
          approvedBy: studentUserPublicId,
          approvedAt: new Date(),
          ...(newTutorPublicId ? { tutorPublicId: newTutorPublicId } : {}),
        },
        $unset: { pendingTutorPublicId: '' },
      },
      { new: true },
    ).lean();

    await walletService.initializeDemoCredits(studentUserPublicId).catch(() => {});
    await adjustCountersForStatusChange(profile.status, StudentStatus.ACTIVE, newTutorPublicId, await principalOfTutor(newTutorPublicId));

    domainEvents.emit(DomainEvent.STUDENT_APPROVED, {
      studentPublicId: profile.publicId,
      studentUserPublicId,
      approvedBy: studentUserPublicId,
    });

    return updated!;
  }

  /**
   * The student's tutor links, shaped for the "Tutors" screen. A link is a
   * student profile row that points at a tutor (or a pending invite from one).
   */
  async getMyTutorLinks(studentUserPublicId: string) {
    const profiles = await StudentProfileModel.find(
      { userPublicId: studentUserPublicId, isDeleted: false },
    ).lean();

    const links = await Promise.all(profiles.map(async (p) => {
      const tutorPublicId = p.pendingTutorPublicId ?? p.tutorPublicId;
      if (!tutorPublicId) return null;
      const tutor = await TutorProfileModel.findOne({ publicId: tutorPublicId, isDeleted: false }).lean();
      if (!tutor) return null;
      const tutorUser = await userRepository.findByPublicId(tutor.userPublicId);
      return {
        studentProfilePublicId: p.publicId,
        status: p.status,
        tutorPublicId: tutor.publicId,
        tutorUserPublicId: tutor.userPublicId,
        tutorName: tutorUser ? `${tutorUser.firstName} ${tutorUser.lastName}`.trim() : 'Tutor',
        tutorAvatarUrl: tutorUser?.avatarUrl,
        subjects: tutor.subjects ?? [],
        rating: tutor.rating ?? 0,
        isVerified: !!tutor.isVerified,
        isPendingInvite: p.status === StudentStatus.PENDING_APPROVAL,
        createdAt: (p as unknown as { createdAt?: Date }).createdAt?.toISOString?.() ?? new Date().toISOString(),
      };
    }));
    return links.filter((l): l is NonNullable<typeof l> => l !== null);
  }

  /** Make sure `linkId` is one of this student's own profiles (404 otherwise). */
  async assertOwnsLink(studentUserPublicId: string, linkId: string): Promise<IStudentProfile> {
    const profile = await StudentProfileModel.findOne(
      { publicId: linkId, userPublicId: studentUserPublicId, isDeleted: false },
    ).lean();
    if (!profile) throw new NotFoundError('Tutor link');
    return profile as unknown as IStudentProfile;
  }

  /** A student ends their own link with a tutor. */
  async unlinkOwnTutor(studentUserPublicId: string, linkId: string): Promise<void> {
    const profile = await this.assertOwnsLink(studentUserPublicId, linkId);
    const principalUserId = await principalOfTutor(profile.tutorPublicId);
    await adjustCountersForStatusChange(profile.status, undefined, profile.tutorPublicId, principalUserId);
    await studentRepository.update(profile.publicId, {
      tutorPublicId: undefined as unknown as string,
      status: StudentStatus.INACTIVE,
    });
  }

  async declineInvite(studentUserPublicId: string, linkId?: string): Promise<void> {
    const profile = await this.findInviteProfile(studentUserPublicId, linkId);
    if (profile.status !== StudentStatus.PENDING_APPROVAL) {
      throw new ConflictError('No pending invite to decline');
    }

    const declinedTutorPublicId = profile.pendingTutorPublicId ?? profile.tutorPublicId;

    // Detach the tutor as well as marking the profile inactive. Leaving the link
    // in place made the student look "already linked", so the tutor could never
    // send a fresh invite after a decline.
    //
    // `$unset` rather than setting undefined: mongoose strips undefined out of
    // `$set`, so the field would silently survive and the resend path — which
    // looks for `tutorPublicId: { $exists: false }` — would never match.
    await StudentProfileModel.updateOne(
      { publicId: profile.publicId },
      { $set: { status: StudentStatus.INACTIVE }, $unset: { tutorPublicId: '', pendingTutorPublicId: '' } },
    );

    if (declinedTutorPublicId) {
      const tutor = await TutorProfileModel.findOne(
        { publicId: declinedTutorPublicId, isDeleted: false },
        { userPublicId: 1 },
      ).lean();
      const student = await userRepository.findByPublicId(studentUserPublicId);

      if (tutor?.userPublicId) {
        domainEvents.emit(DomainEvent.STUDENT_INVITE_DECLINED, {
          tutorUserPublicId: tutor.userPublicId,
          studentUserPublicId,
          studentName: student ? `${student.firstName} ${student.lastName}`.trim() : 'A student',
        });
      }
    }
  }

  async listAll(query: PaginationQuery): Promise<PaginatedResult<IStudentProfile & { firstName: string; lastName: string; displayName: string; email: string }>> {
    const result = await studentRepository.findAll(query);
    return this._hydrateList(result);
  }

  async listPending(query: PaginationQuery): Promise<PaginatedResult<IStudentProfile & { firstName: string; lastName: string; displayName: string; email: string }>> {
    const result = await studentRepository.findPending(query);
    return this._hydrateList(result);
  }

  private async _hydrateList(
    result: PaginatedResult<IStudentProfile>,
  ): Promise<PaginatedResult<IStudentProfile & { firstName: string; lastName: string; displayName: string; email: string }>> {
    const userPublicIds = result.items.map((s) => s.userPublicId);
    const users = await userRepository.findManyByPublicIds(userPublicIds);
    const userMap = new Map(users.map((u) => [u.publicId, u]));
    const hydrated = result.items.map((s) => {
      const u = userMap.get(s.userPublicId);
      const firstName = u?.firstName ?? '';
      const lastName = u?.lastName ?? '';
      return { ...s, firstName, lastName, displayName: `${firstName} ${lastName}`.trim() || 'Student', email: u?.email ?? '' };
    });
    return { ...result, items: hydrated };
  }

  async createByPrincipal(
    principalUserPublicId: string,
    dto: CreateStudentByPrincipalDto,
  ): Promise<IStudentProfile & { firstName: string; lastName: string; studentId: string; contactEmail?: string }> {
    const principalProfile = await PrincipalProfileModel.findOne({ userPublicId: principalUserPublicId, isDeleted: false }).lean();
    if (!principalProfile) throw new AppError('Principal profile not found', 404);

    const tutor = await tutorRepository.findByPublicId(dto.tutorPublicId);
    if (!tutor) throw new NotFoundError('Tutor profile');
    if (tutor.principalPublicId !== principalUserPublicId) {
      throw new AppError('This tutor does not belong to your organization', 403);
    }
    // Checked first so a bad county never leaves a half-created account behind.
    const location = buildLocationUpdate({ state: dto.state, countyFips: dto.countyFips }).set;

    if (dto.customStudentId) {
      const taken = await userRepository.existsByStudentId(dto.customStudentId);
      if (taken) throw new ConflictError('This Student ID is already in use');
    }

    const studentId = dto.customStudentId?.toLowerCase() ?? await generateStudentId(dto.firstName, dto.lastName);
    const internalEmail = `${studentId}@student.internal`;

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    const user = await userRepository.create({
      publicId: uuidv4(),
      email: internalEmail,
      studentId,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: 'STUDENT',
      status: UserStatus.ACTIVE,
      emailVerified: true,
      phone: dto.phone,
      timezone: 'UTC',
      twoFAEnabled: false,
      loginCount: 0,
      isDeleted: false,
    });

    await walletService.createWallet(user.publicId).catch(() => {});

    const profile = await studentRepository.create({
      publicId: uuidv4(),
      userPublicId: user.publicId,
      tutorPublicId: dto.tutorPublicId,
      contactEmail: dto.contactEmail?.toLowerCase(),
      previousTutorPublicIds: [],
      status: StudentStatus.ACTIVE,
      demoClassesUsed: 0,
      demoClassTakenWith: [],
      totalClassesAttended: 0,
      totalClassesMissed: 0,
      totalClassesBooked: 0,
      attendanceRate: 0,
      grade: dto.grade,
      ...location,
      notes: dto.notes,
      invitedBy: principalUserPublicId,
      approvedBy: principalUserPublicId,
      approvedAt: new Date(),
      isDeleted: false,
    });

    await adjustCountersForStatusChange(undefined, StudentStatus.ACTIVE, dto.tutorPublicId, principalUserPublicId);

    domainEvents.emit(DomainEvent.STUDENT_APPROVED, {
      studentPublicId: profile.publicId,
      studentUserPublicId: user.publicId,
      tutorUserPublicId: principalUserPublicId,
      approvedBy: principalUserPublicId,
    });

    if (dto.contactEmail) {
      await enqueueEmail({
        to: dto.contactEmail,
        subject: `Student account created for ${dto.firstName} on brainbaseedu`,
        html: buildWelcomeEmail({ firstName: dto.firstName, lastName: dto.lastName, studentId, grade: dto.grade }),
      });
    }

    await recordGuardianConsent(profile.publicId, principalUserPublicId, 'PRINCIPAL');
    await walletService.initializeDemoCredits(user.publicId).catch(() => {});

    return { ...profile, firstName: user.firstName, lastName: user.lastName, studentId };
  }

  async inviteExistingByPrincipal(
    principalUserPublicId: string,
    dto: InviteStudentByPrincipalDto,
  ): Promise<IStudentProfile> {
    const principalProfile = await PrincipalProfileModel.findOne({ userPublicId: principalUserPublicId, isDeleted: false }).lean();
    if (!principalProfile) throw new AppError('Principal profile not found', 404);

    const tutor = await tutorRepository.findByPublicId(dto.tutorPublicId);
    if (!tutor) throw new NotFoundError('Tutor profile');
    if (tutor.principalPublicId !== principalUserPublicId) {
      throw new AppError('This tutor does not belong to your organization', 403);
    }

    let user = null;
    if (dto.studentPublicId) {
      const sp = await StudentProfileModel.findOne({ publicId: dto.studentPublicId, isDeleted: false }).lean();
      if (!sp) throw new NotFoundError('Student profile');
      user = await userRepository.findByPublicId(sp.userPublicId);
    } else if (dto.studentId) {
      user = await userRepository.findByStudentId(dto.studentId);
    } else if (dto.email) {
      const profiles = await studentRepository.findManyByContactEmail(dto.email);
      if (profiles.length > 0) {
        user = await userRepository.findByPublicId(profiles[0].userPublicId);
      }
    } else if (dto.phone) {
      user = await userRepository.findByPhone(dto.phone!);
    }

    if (!user) throw new NotFoundError('No student account found');
    if (user.role !== 'STUDENT') throw new AppError('This account is not a student', 400);

    const existing = await studentRepository.findByUserAndTutor(user.publicId, dto.tutorPublicId);
    if (existing) throw new ConflictError('This student is already linked to this tutor');

    const profile = await studentRepository.create({
      publicId: uuidv4(),
      userPublicId: user.publicId,
      tutorPublicId: dto.tutorPublicId,
      previousTutorPublicIds: [],
      status: StudentStatus.PENDING_APPROVAL,
      demoClassesUsed: 0,
      demoClassTakenWith: [],
      totalClassesAttended: 0,
      totalClassesMissed: 0,
      totalClassesBooked: 0,
      attendanceRate: 0,
      invitedBy: principalUserPublicId,
      isDeleted: false,
    });

    domainEvents.emit(DomainEvent.STUDENT_INVITED, {
      studentPublicId: profile.publicId,
      userPublicId: user.publicId,
      tutorPublicId: dto.tutorPublicId,
    });

    return profile;
  }

  async getByPrincipal(
    principalUserPublicId: string,
    query: PaginationQuery & { status?: string },
  ): Promise<PaginatedResult<IStudentProfile & { firstName: string; lastName: string; displayName: string; email: string }>> {
    const principalProfile = await PrincipalProfileModel.findOne({ userPublicId: principalUserPublicId, isDeleted: false }).lean();
    if (!principalProfile) throw new AppError('Principal profile not found', 404);

    const tutorsResult = await tutorRepository.findByPrincipal(principalUserPublicId, { page: 1, limit: 500 } as PaginationQuery);
    const tutorPublicIds = tutorsResult.items.map((t) => t.publicId);

    if (tutorPublicIds.length === 0) {
      return { items: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    }

    const result = await studentRepository.findByTutorIds(tutorPublicIds, query);
    return this._hydrateList(result);
  }

  async createByParent(
    parentUserPublicId: string,
    dto: CreateStudentByParentDto,
  ): Promise<IStudentProfile & { firstName: string; lastName: string; studentId: string }> {
    // Checked first so a bad county never leaves a half-created account behind.
    const location = buildLocationUpdate({ state: dto.state, countyFips: dto.countyFips }).set;
    if (dto.customStudentId) {
      const taken = await userRepository.existsByStudentId(dto.customStudentId);
      if (taken) throw new ConflictError('This Student ID is already in use');
    }

    const studentId = dto.customStudentId?.toLowerCase() ?? await generateStudentId(dto.firstName, dto.lastName);
    const internalEmail = `${studentId}@student.internal`;

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    const user = await userRepository.create({
      publicId: uuidv4(),
      email: internalEmail,
      studentId,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: 'STUDENT',
      status: UserStatus.ACTIVE,
      emailVerified: true,
      timezone: 'UTC',
      twoFAEnabled: false,
      loginCount: 0,
      isDeleted: false,
    });

    await walletService.createWallet(user.publicId).catch(() => {});

    // Fetch parent before creating profile so we can set contactEmail
    const parentUser = await userRepository.findByPublicId(parentUserPublicId);

    const profile = await studentRepository.create({
      publicId: uuidv4(),
      userPublicId: user.publicId,
      previousTutorPublicIds: [],
      status: StudentStatus.ACTIVE,
      demoClassesUsed: 0,
      demoClassTakenWith: [],
      totalClassesAttended: 0,
      totalClassesMissed: 0,
      totalClassesBooked: 0,
      attendanceRate: 0,
      grade: dto.grade,
      ...location,
      notes: dto.notes,
      contactEmail: parentUser?.email && !parentUser.email.endsWith('@student.internal') ? parentUser.email : undefined,
      invitedBy: parentUserPublicId,
      approvedBy: parentUserPublicId,
      approvedAt: new Date(),
      isDeleted: false,
    });

    domainEvents.emit(DomainEvent.STUDENT_APPROVED, {
      studentPublicId: profile.publicId,
      studentUserPublicId: user.publicId,
      approvedBy: parentUserPublicId,
    });

    // Send to parent's real email
    if (parentUser?.email && !parentUser.email.endsWith('@student.internal')) {
      await enqueueEmail({
        to: parentUser.email,
        subject: `Child account created for ${dto.firstName} on brainbaseedu`,
        html: buildWelcomeEmail({ firstName: dto.firstName, lastName: dto.lastName, studentId, grade: dto.grade }),
      });
    }

    await recordGuardianConsent(profile.publicId, parentUserPublicId, 'PARENT');
    await walletService.initializeDemoCredits(user.publicId).catch(() => {});

    return { ...profile, firstName: user.firstName, lastName: user.lastName, studentId };
  }

  async unlinkStudent(
    studentPublicId: string,
    actor: StudentActor,
  ): Promise<void> {
    const profile = await studentRepository.findByPublicId(studentPublicId);
    if (!profile) throw new NotFoundError('Student profile');
    await assertActorCanManageStudent(profile, actor);

    // Counters move only if the student was actually counted (see
    // COUNTED_STUDENT_STATUSES) - handled by adjustCountersForStatusChange.
    const principalUserId = await principalOfTutor(profile.tutorPublicId);
    await adjustCountersForStatusChange(profile.status, undefined, profile.tutorPublicId, principalUserId);

    await studentRepository.update(studentPublicId, {
      tutorPublicId: undefined as unknown as string,
      status: StudentStatus.INACTIVE,
    });
  }

  async setStudentStatus(
    studentPublicId: string,
    actor: StudentActor,
    newStatus: 'ACTIVE' | 'INACTIVE',
  ): Promise<IStudentProfile> {
    const profile = await studentRepository.findByPublicId(studentPublicId);
    if (!profile) throw new NotFoundError('Student profile');
    await assertActorCanManageStudent(profile, actor);
    const updated = await studentRepository.update(studentPublicId, { status: newStatus as StudentStatus });
    if (!updated) throw new NotFoundError('Student profile');
    await adjustCountersForStatusChange(profile.status, newStatus as StudentStatus, profile.tutorPublicId, await principalOfTutor(profile.tutorPublicId));
    return updated;
  }

  /** A tutor, or a principal for their tutors' students, sets where one of their students goes to school. */
  async setStudentLocation(
    studentPublicId: string,
    actor: StudentActor,
    input: { state?: string; countyFips?: string },
  ): Promise<IStudentProfile> {
    const profile = await studentRepository.findByPublicId(studentPublicId);
    if (!profile) throw new NotFoundError('Student profile');
    await assertActorCanManageStudent(profile, actor);
    const { set, unset } = buildLocationUpdate(input, profile.state);
    const update: Record<string, unknown> = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;
    const updated = Object.keys(update).length
      ? await StudentProfileModel.findOneAndUpdate({ publicId: studentPublicId, isDeleted: false }, update, { new: true }).lean()
      : profile;
    if (!updated) throw new NotFoundError('Student profile');
    return updated;
  }

  async canUseDemoCredit(userPublicId: string, tutorPublicId: string): Promise<boolean> {
    const profile = await studentRepository.findByUserPublicId(userPublicId);
    if (!profile) return false;
    const { maxDemoClasses } = await settingsService.get();
    if (profile.demoClassesUsed >= maxDemoClasses) return false;
    if (profile.demoClassTakenWith.includes(tutorPublicId)) return false;
    return true;
  }

  async recordDemoClassUsed(publicId: string, tutorPublicId: string): Promise<void> {
    const profile = await studentRepository.findByPublicId(publicId);
    if (!profile) throw new NotFoundError('Student profile');

    await studentRepository.update(publicId, {
      demoClassTakenWith: [...profile.demoClassTakenWith, tutorPublicId],
    });
    await studentRepository.incrementStats(publicId, { demoClassesUsed: 1 });
  }

  async searchParentByEmail(email: string) {
    const parentUser = await userRepository.findByEmail(email);
    if (!parentUser || parentUser.role !== 'PARENT') throw new NotFoundError('No parent account found with that email');

    const parentProfile = await ParentProfileModel.findOne({ userPublicId: parentUser.publicId, isDeleted: false }).lean();
    if (!parentProfile || !parentProfile.childStudentPublicIds?.length) {
      return { parentName: `${parentUser.firstName} ${parentUser.lastName}`.trim(), children: [] };
    }

    const studentProfiles = await StudentProfileModel.find({
      publicId: { $in: parentProfile.childStudentPublicIds },
      isDeleted: false,
    }).lean();

    const userPubIds = studentProfiles.map((s) => s.userPublicId);
    const users = await userRepository.findManyByPublicIds(userPubIds);
    const userMap = new Map(users.map((u) => [u.publicId, u]));

    const children = studentProfiles.map((sp) => {
      const u = userMap.get(sp.userPublicId);
      return {
        publicId: sp.publicId,
        firstName: u?.firstName ?? '',
        lastName: u?.lastName ?? '',
        grade: sp.grade,
        status: sp.status,
        studentId: u?.studentId,
        alreadyLinked: !!sp.tutorPublicId,
      };
    });

    return { parentName: `${parentUser.firstName} ${parentUser.lastName}`.trim(), children };
  }

  async getMyPrincipal(studentUserPublicId: string) {
    const studentProfile = await studentRepository.findByUserPublicId(studentUserPublicId);
    if (!studentProfile?.tutorPublicId) return null;

    const tutor = await tutorRepository.findByPublicId(studentProfile.tutorPublicId);
    if (!tutor?.principalPublicId) return null;

    const principalProfile = await PrincipalProfileModel.findOne({
      userPublicId: tutor.principalPublicId, isDeleted: false,
    }).lean();
    if (!principalProfile) return null;

    const principalUser = await userRepository.findByPublicId(principalProfile.userPublicId);
    return {
      publicId: principalProfile.publicId,
      organizationName: principalProfile.organizationName,
      firstName: principalUser?.firstName ?? '',
      lastName: principalUser?.lastName ?? '',
    };
  }
}

export const studentService = new StudentService();
