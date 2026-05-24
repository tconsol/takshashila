import argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { studentRepository } from './student.repository';
import { StudentProfileModel } from './student.model';
import { StudentStatus } from './student.types';
import type { IStudentProfile, TransferStudentDto } from './student.types';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { NotFoundError, ConflictError, AppError } from '../../utils/error';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { walletService } from '../wallets/wallet.service';
import { CreditType } from '../wallets/wallet.types';
import { userRepository } from '../users/user.repository';
import { UserStatus } from '../users/user.types';
import { tutorRepository } from '../tutors/tutor.repository';
import type { CreateStudentByTutorDto, InviteExistingStudentDto, CreateStudentByPrincipalDto, InviteStudentByPrincipalDto, CreateStudentByParentDto } from './student.validators';
import { PrincipalProfileModel } from '../principals/principal.model';
import { ParentProfileModel } from '../parents/parent.model';
import { enqueueEmail } from '../../queues/email.queue';

function buildWelcomeEmail(opts: {
  firstName: string;
  lastName: string;
  studentId: string;
  password: string;
  grade?: string;
}): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px;background:#fafafa;border-radius:16px;border:2px solid #1a1a2e">
      <h2 style="margin:0 0 8px;color:#1a1a2e">Welcome to Takshashila! 🎓</h2>
      <p style="color:#555;margin:0 0 24px">A student account has been created for <strong>${opts.firstName} ${opts.lastName}</strong>.</p>
      <div style="background:#fff;border:2px solid #1a1a2e;border-radius:12px;padding:20px;margin-bottom:20px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#888;font-size:13px">Student ID (login)</td><td style="padding:6px 0;font-weight:700;font-family:monospace;font-size:16px;letter-spacing:2px;color:#1a1a2e">${opts.studentId}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:13px">Password</td><td style="padding:6px 0;font-weight:700;font-family:monospace;font-size:16px;color:#1a1a2e">${opts.password}</td></tr>
          ${opts.grade ? `<tr><td style="padding:6px 0;color:#888;font-size:13px">Grade</td><td style="padding:6px 0;font-weight:600;color:#1a1a2e">${opts.grade}</td></tr>` : ''}
        </table>
      </div>
      <p style="color:#888;font-size:12px">Your child logs in using the <strong>Student ID</strong> (not an email address) + their password. Please save this information safely.</p>
    </div>
  `;
}

const MAX_DEMO_CLASSES = 3;
const DEMO_CREDITS_PER_CLASS_CENTS = 100_00;

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

    // Validate custom studentId uniqueness
    if (dto.customStudentId) {
      const taken = await userRepository.existsByStudentId(dto.customStudentId);
      if (taken) throw new ConflictError('This Student ID is already in use');
    }

    const studentId = dto.customStudentId?.toLowerCase() ?? await generateStudentId(dto.firstName, dto.lastName);
    // Internal unique email — students log in by studentId, not email
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
      notes: dto.notes,
      invitedBy: tutorUserPublicId,
      approvedBy: tutorUserPublicId,
      approvedAt: new Date(),
      isDeleted: false,
    });

    await tutorRepository.incrementStats(tutorProfile.publicId, { totalStudents: 1 });

    domainEvents.emit(DomainEvent.STUDENT_APPROVED, {
      studentPublicId: profile.publicId,
      studentUserPublicId: user.publicId,
      tutorUserPublicId,
      approvedBy: tutorUserPublicId,
    });

    if (dto.contactEmail) {
      await enqueueEmail({
        to: dto.contactEmail,
        subject: `Student account created for ${dto.firstName} — Takshashila`,
        html: buildWelcomeEmail({ firstName: dto.firstName, lastName: dto.lastName, studentId, password: dto.password, grade: dto.grade }),
      });
    }

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

  async approve(publicId: string, approvedBy: string): Promise<IStudentProfile> {
    const profile = await studentRepository.findByPublicId(publicId);
    if (!profile) throw new NotFoundError('Student profile');

    if (profile.status !== StudentStatus.PENDING_APPROVAL) {
      throw new ConflictError(`Cannot approve from status: ${profile.status}`);
    }

    const updated = await studentRepository.update(publicId, {
      status: StudentStatus.ACTIVE,
      approvedBy,
      approvedAt: new Date(),
    });

    await walletService.initializeDemoCredits(profile.userPublicId).catch(() => {});
    if (profile.tutorPublicId) {
      await tutorRepository.incrementStats(profile.tutorPublicId, { totalStudents: 1 });
    }

    domainEvents.emit(DomainEvent.STUDENT_APPROVED, {
      studentPublicId: publicId,
      studentUserPublicId: profile.userPublicId,
      tutorUserPublicId: approvedBy,
      approvedBy,
    });

    return updated!;
  }

  async reject(publicId: string): Promise<void> {
    const profile = await studentRepository.findByPublicId(publicId);
    if (!profile) throw new NotFoundError('Student profile');
    await studentRepository.update(publicId, { status: StudentStatus.INACTIVE });
  }

  async suspend(publicId: string): Promise<IStudentProfile> {
    const updated = await studentRepository.update(publicId, { status: StudentStatus.SUSPENDED });
    if (!updated) throw new NotFoundError('Student profile');
    return updated;
  }

  async transfer(publicId: string, dto: TransferStudentDto, actorId: string): Promise<IStudentProfile> {
    const profile = await studentRepository.findByPublicId(publicId);
    if (!profile) throw new NotFoundError('Student profile');

    if (profile.tutorPublicId === dto.newTutorPublicId) {
      throw new ConflictError('Student is already assigned to this tutor');
    }

    const updated = await studentRepository.update(publicId, {
      tutorPublicId: dto.newTutorPublicId,
      previousTutorPublicIds: profile.tutorPublicId
        ? [...profile.previousTutorPublicIds, profile.tutorPublicId]
        : profile.previousTutorPublicIds,
      status: StudentStatus.TRANSFERRED,
      transferredFrom: profile.tutorPublicId,
      transferredAt: new Date(),
    });

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
    } else if (dto.email) {
      // Email might be a shared contact email — search StudentProfile first
      const profiles = await studentRepository.findManyByContactEmail(dto.email);
      if (profiles.length > 0) {
        // Return first match that isn't already linked to this tutor
        for (const p of profiles) {
          const linked = await studentRepository.findByUserAndTutor(p.userPublicId, tutorProfile.publicId);
          if (!linked) {
            user = await userRepository.findByPublicId(p.userPublicId);
            contactEmail = p.contactEmail;
            break;
          }
        }
        if (!user && profiles.length > 0) {
          // All already linked
          user = await userRepository.findByPublicId(profiles[0].userPublicId);
          contactEmail = profiles[0].contactEmail;
        }
      }
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

    const existing = await studentRepository.findByUserAndTutor(user.publicId, tutorProfile.publicId);
    if (existing) throw new ConflictError('This student is already linked to your account');

    // Check if they already have a profile with no tutor — update it
    const profileWithoutTutor = await StudentProfileModel.findOne({
      userPublicId: user.publicId,
      tutorPublicId: { $exists: false },
      isDeleted: false,
    }).lean();

    let profile: IStudentProfile;
    if (profileWithoutTutor) {
      const updated = await studentRepository.update(profileWithoutTutor.publicId, {
        tutorPublicId: tutorProfile.publicId,
        status: StudentStatus.PENDING_APPROVAL,
        invitedBy: tutorUserPublicId,
      });
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

  async acceptInvite(studentUserPublicId: string): Promise<IStudentProfile> {
    const profile = await studentRepository.findByUserPublicId(studentUserPublicId);
    if (!profile) throw new NotFoundError('No pending invite found');
    if (profile.status !== StudentStatus.PENDING_APPROVAL) {
      throw new ConflictError('No pending invite to accept');
    }

    const updated = await studentRepository.update(profile.publicId, {
      status: StudentStatus.ACTIVE,
      approvedBy: studentUserPublicId,
      approvedAt: new Date(),
    });

    await walletService.initializeDemoCredits(studentUserPublicId).catch(() => {});
    if (profile.tutorPublicId) {
      await tutorRepository.incrementStats(profile.tutorPublicId, { totalStudents: 1 });
    }

    domainEvents.emit(DomainEvent.STUDENT_APPROVED, {
      studentPublicId: profile.publicId,
      studentUserPublicId,
      approvedBy: studentUserPublicId,
    });

    return updated!;
  }

  async declineInvite(studentUserPublicId: string): Promise<void> {
    const profile = await studentRepository.findByUserPublicId(studentUserPublicId);
    if (!profile) throw new NotFoundError('No pending invite found');
    if (profile.status !== StudentStatus.PENDING_APPROVAL) {
      throw new ConflictError('No pending invite to decline');
    }
    await studentRepository.update(profile.publicId, { status: StudentStatus.INACTIVE });
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
      notes: dto.notes,
      invitedBy: principalUserPublicId,
      approvedBy: principalUserPublicId,
      approvedAt: new Date(),
      isDeleted: false,
    });

    await tutorRepository.incrementStats(dto.tutorPublicId, { totalStudents: 1 });
    await PrincipalProfileModel.updateOne({ publicId: principalProfile.publicId }, { $inc: { totalStudents: 1 } });

    domainEvents.emit(DomainEvent.STUDENT_APPROVED, {
      studentPublicId: profile.publicId,
      studentUserPublicId: user.publicId,
      tutorUserPublicId: principalUserPublicId,
      approvedBy: principalUserPublicId,
    });

    if (dto.contactEmail) {
      await enqueueEmail({
        to: dto.contactEmail,
        subject: `Student account created for ${dto.firstName} — Takshashila`,
        html: buildWelcomeEmail({ firstName: dto.firstName, lastName: dto.lastName, studentId, password: dto.password, grade: dto.grade }),
      });
    }

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
        subject: `Child account created for ${dto.firstName} — Takshashila`,
        html: buildWelcomeEmail({ firstName: dto.firstName, lastName: dto.lastName, studentId, password: dto.password, grade: dto.grade }),
      });
    }

    return { ...profile, firstName: user.firstName, lastName: user.lastName, studentId };
  }

  async unlinkStudent(
    studentPublicId: string,
    actorUserPublicId: string,
    actorRole: 'TUTOR' | 'PRINCIPAL',
  ): Promise<void> {
    const profile = await studentRepository.findByPublicId(studentPublicId);
    if (!profile) throw new NotFoundError('Student profile');

    if (actorRole === 'TUTOR') {
      const { tutorService } = await import('../tutors/tutor.service');
      const tutorProfile = await tutorService.getByUserPublicId(actorUserPublicId);
      if (profile.tutorPublicId !== tutorProfile.publicId) {
        throw new AppError('This student is not linked to your account', 403);
      }
      await tutorRepository.incrementStats(tutorProfile.publicId, { totalStudents: -1 }).catch(() => {});
    } else {
      // PRINCIPAL — verify the student's tutor belongs to this principal's org
      const principalProfile = await PrincipalProfileModel.findOne({ userPublicId: actorUserPublicId, isDeleted: false }).lean();
      if (!principalProfile) throw new AppError('Principal profile not found', 404);
      if (profile.tutorPublicId) {
        const tutor = await tutorRepository.findByPublicId(profile.tutorPublicId);
        if (!tutor || tutor.principalPublicId !== actorUserPublicId) {
          throw new AppError('This student does not belong to your organization', 403);
        }
        await tutorRepository.incrementStats(profile.tutorPublicId, { totalStudents: -1 }).catch(() => {});
      }
      await PrincipalProfileModel.updateOne({ publicId: principalProfile.publicId }, { $inc: { totalStudents: -1 } }).catch(() => {});
    }

    await studentRepository.update(studentPublicId, {
      tutorPublicId: undefined as unknown as string,
      status: StudentStatus.INACTIVE,
    });
  }

  async canUseDemoCredit(userPublicId: string, tutorPublicId: string): Promise<boolean> {
    const profile = await studentRepository.findByUserPublicId(userPublicId);
    if (!profile) return false;
    if (profile.demoClassesUsed >= MAX_DEMO_CLASSES) return false;
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
