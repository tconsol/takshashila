import argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { studentRepository } from './student.repository';
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
import type { CreateStudentByTutorDto } from './student.validators';

const MAX_DEMO_CLASSES = 3;
const DEMO_CREDITS_PER_CLASS_CENTS = 100_00;

export class StudentService {
  async createByTutor(
    tutorUserPublicId: string,
    dto: CreateStudentByTutorDto,
  ): Promise<IStudentProfile & { firstName: string; lastName: string; email: string }> {
    const { tutorService } = await import('../tutors/tutor.service');
    const tutorProfile = await tutorService.getByUserPublicId(tutorUserPublicId);

    const emailExists = await userRepository.existsByEmail(dto.email);
    if (emailExists) throw new ConflictError('An account with this email already exists');

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    const user = await userRepository.create({
      publicId: uuidv4(),
      email: dto.email.toLowerCase(),
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

    domainEvents.emit(DomainEvent.STUDENT_APPROVED, {
      studentPublicId: profile.publicId,
      approvedBy: tutorUserPublicId,
    });

    return {
      ...profile,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
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

    domainEvents.emit(DomainEvent.STUDENT_APPROVED, {
      studentPublicId: publicId,
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
      previousTutorPublicIds: [...profile.previousTutorPublicIds, profile.tutorPublicId],
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
      return { ...s, firstName, lastName, displayName: `${firstName} ${lastName}`.trim() || 'Student' };
    });

    return { ...result, items: hydrated };
  }

  async listAll(query: PaginationQuery): Promise<PaginatedResult<IStudentProfile>> {
    return studentRepository.findAll(query);
  }

  async listPending(query: PaginationQuery): Promise<PaginatedResult<IStudentProfile>> {
    return studentRepository.findPending(query);
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
}

export const studentService = new StudentService();
