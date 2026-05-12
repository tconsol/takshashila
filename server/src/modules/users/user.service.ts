import { userRepository } from './user.repository';
import type { UpdateUserDto, PublicUser } from './user.types';
import { NotFoundError, ConflictError } from '../../utils/error';

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

  async suspendUser(publicId: string, actorPublicId: string): Promise<void> {
    const user = await userRepository.findByPublicId(publicId);
    if (!user) throw new NotFoundError('User');
    await userRepository.update(publicId, { status: 'SUSPENDED' });
  }

  async activateUser(publicId: string): Promise<void> {
    const user = await userRepository.findByPublicId(publicId);
    if (!user) throw new NotFoundError('User');
    await userRepository.update(publicId, { status: 'ACTIVE' });
  }

  async softDeleteUser(publicId: string, deletedBy: string): Promise<void> {
    const user = await userRepository.findByPublicId(publicId);
    if (!user) throw new NotFoundError('User');
    await userRepository.softDelete(publicId, deletedBy);
  }
}

export const userService = new UserService();
