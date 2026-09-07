import { userRepository } from './user.repository';
import type { UpdateUserDto, PublicUser } from './user.types';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/error';
import { auditService } from '../audit/audit.service';
import { Role } from '../../constants/roles';

interface Actor {
  publicId: string;
  role: Role;
  ip?: string;
  userAgent?: string;
}

export class UserService {
  async getByPublicId(publicId: string): Promise<PublicUser> {
    const user = await userRepository.findByPublicId(publicId);
    if (!user) throw new NotFoundError('User');
    return user as PublicUser;
  }

  async updateProfile(publicId: string, dto: UpdateUserDto): Promise<PublicUser> {
    const updated = await userRepository.update(publicId, dto);
    if (!updated) throw new NotFoundError('User');
    return updated as PublicUser;
  }

  async changeEmail(publicId: string, newEmail: string): Promise<void> {
    const exists = await userRepository.existsByEmail(newEmail);
    if (exists) throw new ConflictError('Email already in use');
    await userRepository.update(publicId, {
      email: newEmail.toLowerCase(),
      emailVerified: false,
    });
  }

  async suspendUser(publicId: string, actor: Actor, reason?: string): Promise<void> {
    const user = await userRepository.findByPublicId(publicId);
    if (!user) throw new NotFoundError('User');
    if (user.publicId === actor.publicId) {
      throw new ValidationError(['Cannot suspend your own account'], 'Cannot suspend your own account');
    }
    // A SUPER_ADMIN outranks everyone; an ADMIN must not be able to lock one out.
    if (user.role === Role.SUPER_ADMIN && actor.role !== Role.SUPER_ADMIN) {
      throw new ValidationError(
        ['Only a super admin can suspend a super admin'],
        'Only a super admin can suspend a super admin',
      );
    }

    await userRepository.update(publicId, { status: 'SUSPENDED' });
    await auditService.log({
      actorId: actor.publicId,
      actorRole: actor.role,
      action: 'USER_SUSPENDED',
      resourceType: 'User',
      resourceId: publicId,
      ip: actor.ip,
      userAgent: actor.userAgent,
      before: { status: user.status },
      after: { status: 'SUSPENDED', reason },
    });
  }

  async activateUser(publicId: string, actor: Actor): Promise<void> {
    const user = await userRepository.findByPublicId(publicId);
    if (!user) throw new NotFoundError('User');

    await userRepository.update(publicId, { status: 'ACTIVE' });
    await auditService.log({
      actorId: actor.publicId,
      actorRole: actor.role,
      action: 'USER_ACTIVATED',
      resourceType: 'User',
      resourceId: publicId,
      ip: actor.ip,
      userAgent: actor.userAgent,
      before: { status: user.status },
      after: { status: 'ACTIVE' },
    });
  }

  async softDeleteUser(publicId: string, deletedBy: string): Promise<void> {
    const user = await userRepository.findByPublicId(publicId);
    if (!user) throw new NotFoundError('User');
    await userRepository.softDelete(publicId, deletedBy);
  }
}

export const userService = new UserService();
