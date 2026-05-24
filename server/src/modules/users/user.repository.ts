import { UserModel } from './user.model';
import type { IUser, CreateUserDto } from './user.types';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';
import type { Role } from '../../constants/roles';

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

  async findByEmail(email: string, withSensitive = false): Promise<IUser | null> {
    const query = UserModel.findOne({ email: email.toLowerCase(), isDeleted: false });
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

  async update(publicId: string, updates: Partial<IUser>): Promise<IUser | null> {
    return UserModel.findOneAndUpdate(
      { publicId, isDeleted: false },
      { $set: updates },
      { new: true },
    ).lean();
  }

  async softDelete(publicId: string, deletedBy: string): Promise<IUser | null> {
    return UserModel.findOneAndUpdate(
      { publicId },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy } },
      { new: true },
    ).lean();
  }

  async findAllByRole(role: Role, query: PaginationQuery): Promise<PaginatedResult<IUser>> {
    const { page, limit, skip, sortBy, sortOrder } = parsePaginationQuery(query);
    const filter = { role, isDeleted: false };

    const [items, total] = await Promise.all([
      UserModel.find(filter).sort({ [sortBy]: sortOrder } as Record<string, 1 | -1>).skip(skip).limit(limit).lean(),
      UserModel.countDocuments(filter),
    ]);

    return buildPaginatedResult(items, total, page, limit);
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
