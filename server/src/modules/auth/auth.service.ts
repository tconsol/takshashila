import argon2 from 'argon2';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { userRepository } from '../users/user.repository';
import { UserStatus } from '../users/user.types';
import { getRedisClient } from '../../config/redis';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateSessionId,
  buildTokenPayload,
} from '../../utils/token';
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  AppError,
} from '../../utils/error';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import type { Role } from '../../constants/roles';
import type { TokenPair, DeviceInfo } from '../../shared/types';
import type {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './auth.validators';
import { walletService } from '../wallets/wallet.service';
import { PrincipalProfileModel } from '../principals/principal.model';
import { PrincipalStatus } from '../principals/principal.types';
import { TutorProfileModel } from '../tutors/tutor.model';
import { TutorStatus } from '../tutors/tutor.types';
import { StudentProfileModel } from '../students/student.model';
import { StudentStatus } from '../students/student.types';

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export class AuthService {
  async register(dto: RegisterDto, defaultRole: Role = 'STUDENT'): Promise<{ publicId: string }> {
    const exists = await userRepository.existsByEmail(dto.email);
    if (exists) throw new ConflictError('An account with this email already exists');

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await userRepository.create({
      publicId: uuidv4(),
      email: dto.email.toLowerCase(),
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role as Role || defaultRole,
      status: UserStatus.PENDING_VERIFICATION,
      phone: dto.phone,
      timezone: dto.timezone || 'UTC',
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpiry: verificationExpiry,
      twoFAEnabled: false,
      loginCount: 0,
      isDeleted: false,
    });

    domainEvents.emit(DomainEvent.USER_REGISTERED, {
      userId: user.publicId,
      email: user.email,
      role: user.role,
      verificationToken,
    });

    // Auto-create wallet for all new users
    try {
      await walletService.getOrCreateWallet(user.publicId);
    } catch (err) {
      console.warn('[auth] Could not create wallet for user:', (err as Error).message);
    }

    // Auto-create tutor profile for self-registered tutors
    if (user.role === 'TUTOR') {
      try {
        await TutorProfileModel.create({
          publicId: uuidv4(),
          userPublicId: user.publicId,
          status: TutorStatus.REGISTERED,
          subjects: [],
          languages: [],
          hourlyRateCents: 0,
          commissionRatePercent: 20,
          qualifications: [],
          timezone: dto.timezone || 'UTC',
          trustScore: 50,
          totalStudents: 0,
          totalClassesCompleted: 0,
          totalClassesCancelled: 0,
          totalEarningsCents: 0,
          rating: 0,
          ratingCount: 0,
          isVerified: false,
          isDeleted: false,
        });
      } catch (err) {
        console.warn('[auth] Could not create tutor profile:', (err as Error).message);
      }
    }

    // Auto-create principal profile in PENDING_APPROVAL state
    if (user.role === 'PRINCIPAL') {
      try {
        await PrincipalProfileModel.create({
          publicId: uuidv4(),
          userPublicId: user.publicId,
          status: PrincipalStatus.PENDING_APPROVAL,
          commissionRatePercent: 15,
          totalTutors: 0,
          totalStudents: 0,
          totalRevenueCents: 0,
          trustScore: 50,
          isDeleted: false,
        });
      } catch (err) {
        console.warn('[auth] Could not create principal profile:', (err as Error).message);
      }
    }

    // Auto-create student profile for self-registered students
    if (user.role === 'STUDENT') {
      try {
        await StudentProfileModel.create({
          publicId: uuidv4(),
          userPublicId: user.publicId,
          previousTutorPublicIds: [],
          status: StudentStatus.PENDING_APPROVAL,
          demoClassesUsed: 0,
          demoClassTakenWith: [],
          totalClassesAttended: 0,
          totalClassesCancelled: 0,
          totalClassesMissed: 0,
          totalClassesBooked: 0,
          attendanceRate: 0,
          grade: dto.grade,
          invitedBy: user.publicId,
          isDeleted: false,
        });
      } catch (err) {
        console.warn('[auth] Could not create student profile:', (err as Error).message);
      }
    }

    return { publicId: user.publicId };
  }

  async login(dto: LoginDto, device: DeviceInfo): Promise<TokenPair & { user: object }> {
    const user = await userRepository.findByEmail(dto.email, true);

    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    if (user.isDeleted) {
      throw new AuthenticationError('This account has been deactivated');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new AuthenticationError('Your account has been suspended. Please contact support.');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid email or password');
    }

    if (!user.emailVerified || user.status === UserStatus.PENDING_VERIFICATION) {
      throw new AuthenticationError('Please verify your email address before logging in. Check your inbox for the verification link.');
    }

    if (user.role === 'PRINCIPAL') {
      const principalProfile = await PrincipalProfileModel.findOne({ userPublicId: user.publicId, isDeleted: false }).lean();
      if (!principalProfile || principalProfile.status === PrincipalStatus.PENDING_APPROVAL) {
        throw new AuthenticationError('Your account is pending approval. Our team will review and approve your account shortly.');
      }
      if (principalProfile.status === PrincipalStatus.SUSPENDED) {
        throw new AuthenticationError('Your account has been suspended. Please contact support.');
      }
      if (principalProfile.status === PrincipalStatus.INACTIVE) {
        throw new AuthenticationError('Your account is inactive. Please contact support.');
      }
    }

    // Ensure student profile exists for legacy accounts that pre-date profile auto-creation
    if (user.role === 'STUDENT') {
      const existing = await StudentProfileModel.findOne({ userPublicId: user.publicId, isDeleted: false }).lean();
      if (!existing) {
        try {
          await StudentProfileModel.create({
            publicId: uuidv4(),
            userPublicId: user.publicId,
            previousTutorPublicIds: [],
            status: StudentStatus.PENDING_APPROVAL,
            demoClassesUsed: 0,
            demoClassTakenWith: [],
            totalClassesAttended: 0,
            totalClassesCancelled: 0,
            totalClassesMissed: 0,
            totalClassesBooked: 0,
            attendanceRate: 0,
            invitedBy: user.publicId,
            isDeleted: false,
          });
        } catch (err) {
          console.warn('[auth] Could not auto-create student profile on login:', (err as Error).message);
        }
      }
    }

    const sessionId = generateSessionId();
    const payload = buildTokenPayload(user._id.toString(), user.publicId, user.role, sessionId);

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const sessionKey = `session:${sessionId}`;
    const sessionData = JSON.stringify({
      userId: user.publicId,
      role: user.role,
      device: device.device || 'unknown',
      ip: device.ip,
      userAgent: device.userAgent,
      createdAt: new Date().toISOString(),
    });

    try {
      const redis = getRedisClient();
      const userSessionsKey = `user_sessions:${user.publicId}`;
      await redis.setex(sessionKey, SESSION_TTL_SECONDS, sessionData);
      await redis.sadd(userSessionsKey, sessionId);
      await redis.expire(userSessionsKey, SESSION_TTL_SECONDS);
    } catch (redisErr) {
      // Redis unavailable tokens still work but session management (logout-all, etc.) is disabled
      console.warn('[auth] Redis session store unavailable:', (redisErr as Error).message);
    }

    await userRepository.updateLastLogin(user.publicId, device.ip || '');

    domainEvents.emit(DomainEvent.USER_LOGIN, {
      userId: user.publicId,
      role: user.role,
      ip: device.ip,
    });

    const { passwordHash: _, ...publicUser } = user;

    return { accessToken, refreshToken, user: publicUser };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AuthenticationError('Invalid or expired refresh token');
    }

    const newSessionId = generateSessionId();
    const newPayload = buildTokenPayload(
      payload.userId,
      payload.publicId,
      payload.role,
      newSessionId,
    );

    const newAccessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    try {
      const redis = getRedisClient();
      const sessionKey = `session:${payload.sessionId}`;
      const session = await redis.get(sessionKey);

      if (!session) {
        throw new AuthenticationError('Session expired, please login again');
      }

      const userSessionsKey = `user_sessions:${payload.publicId}`;
      await redis.del(sessionKey);
      await redis.srem(userSessionsKey, payload.sessionId);
      await redis.setex(`session:${newSessionId}`, SESSION_TTL_SECONDS, session);
      await redis.sadd(userSessionsKey, newSessionId);
    } catch (err) {
      if (err instanceof AuthenticationError) throw err;
      console.warn('[auth] Redis unavailable during token refresh:', (err as Error).message);
    }

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(sessionId: string, publicId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(`session:${sessionId}`);
      await redis.srem(`user_sessions:${publicId}`, sessionId);
    } catch (err) {
      console.warn('[auth] Redis unavailable during logout:', (err as Error).message);
    }

    domainEvents.emit(DomainEvent.USER_LOGOUT, { userId: publicId, sessionId });
  }

  async logoutAllDevices(publicId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const userSessionsKey = `user_sessions:${publicId}`;
      const sessions = await redis.smembers(userSessionsKey);

      if (sessions.length > 0) {
        const pipeline = redis.pipeline();
        sessions.forEach((sid) => pipeline.del(`session:${sid}`));
        pipeline.del(userSessionsKey);
        await pipeline.exec();
      }
    } catch (err) {
      console.warn('[auth] Redis unavailable during logout-all:', (err as Error).message);
    }
  }

  async listActiveSessions(publicId: string): Promise<object[]> {
    try {
      const redis = getRedisClient();
      const sessionIds = await redis.smembers(`user_sessions:${publicId}`);

      const sessions = await Promise.all(
        sessionIds.map(async (sid) => {
          const data = await redis.get(`session:${sid}`);
          if (!data) return null;
          return { sessionId: sid, ...JSON.parse(data) };
        }),
      );

      return sessions.filter(Boolean) as object[];
    } catch {
      return [];
    }
  }

  async revokeSession(sessionId: string, publicId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(`session:${sessionId}`);
      await redis.srem(`user_sessions:${publicId}`, sessionId);
    } catch (err) {
      console.warn('[auth] Redis unavailable during session revoke:', (err as Error).message);
    }
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await userRepository.findByEmailVerificationToken(token);
    if (!user) throw new AppError('Invalid or expired verification token', 400);

    await userRepository.update(user.publicId, {
      emailVerified: true,
      status: UserStatus.ACTIVE,
      emailVerificationToken: undefined,
      emailVerificationExpiry: undefined,
    });

    domainEvents.emit(DomainEvent.USER_EMAIL_VERIFIED, { userId: user.publicId });
  }

  async acceptInvite(token: string, password: string): Promise<void> {
    const user = await userRepository.findByEmailVerificationToken(token);
    if (!user) throw new AppError('This invite link is invalid or has expired.', 400);

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    await userRepository.update(user.publicId, {
      emailVerified: true,
      status: UserStatus.ACTIVE,
      passwordHash,
      emailVerificationToken: undefined,
      emailVerificationExpiry: undefined,
    });

    // If the invited user is a tutor, advance status from INVITED → REGISTERED
    await TutorProfileModel.updateOne(
      { userPublicId: user.publicId, status: TutorStatus.INVITED },
      { $set: { status: TutorStatus.REGISTERED } },
    );
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await userRepository.findByEmail(dto.email);
    if (!user) return;

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await userRepository.update(user.publicId, {
      passwordResetToken: resetToken,
      passwordResetExpiry: resetExpiry,
    });

    domainEvents.emit(DomainEvent.USER_PASSWORD_RESET, {
      userId: user.publicId,
      email: user.email,
      resetToken,
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await userRepository.findByPasswordResetToken(dto.token);
    if (!user) throw new AppError('Invalid or expired reset token', 400);

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    await userRepository.update(user.publicId, {
      passwordHash,
      passwordResetToken: undefined,
      passwordResetExpiry: undefined,
    });

    await this.logoutAllDevices(user.publicId);
  }

  async changePassword(publicId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await userRepository.findByEmail(
      (await userRepository.findByPublicId(publicId))!.email,
      true,
    );
    if (!user) throw new NotFoundError('User');

    const isValid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!isValid) throw new AuthenticationError('Current password is incorrect');

    const newPasswordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    await userRepository.update(publicId, { passwordHash: newPasswordHash });
    await this.logoutAllDevices(publicId);
  }
}

export const authService = new AuthService();
