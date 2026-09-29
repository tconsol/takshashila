import argon2 from 'argon2';
import type { Model } from 'mongoose';
import { userRepository } from './user.repository';
import { UserModel } from './user.model';
import { AppError, AuthenticationError, NotFoundError, ValidationError } from '../../utils/error';
import { authService } from '../auth/auth.service';
import { auditService } from '../audit/audit.service';
import { logger } from '../../lib/logger';
import { sendEmailNow } from '../../queues/email.queue';
import { StudentProfileModel } from '../students/student.model';
import { TutorProfileModel } from '../tutors/tutor.model';
import { PrincipalProfileModel } from '../principals/principal.model';
import { ParentProfileModel } from '../parents/parent.model';
import { WalletModel } from '../wallets/wallet.model';
import { WalletTransactionModel } from '../wallets/wallet-transaction.model';
import { TransactionType, TransactionStatus } from '../wallets/wallet.types';
import { ScheduledClassModel } from '../schedules/schedule.model';
import { ClassStatus } from '../schedules/schedule.types';
import { AttendanceModel } from '../attendance/attendance.model';
import { CourseModel } from '../courses/course.model';
import { ProgramModel, ProgramEnrollmentModel } from '../programs/program.model';
import { Role } from '../../constants/roles';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PROFILE_MODELS: Partial<Record<string, Model<any>>> = {
  STUDENT: StudentProfileModel,
  TUTOR: TutorProfileModel,
  PRINCIPAL: PrincipalProfileModel,
  PARENT: ParentProfileModel,
};

export interface AccountActor {
  publicId: string;
  role: string;
  ip?: string;
  userAgent?: string;
}

export class AccountService {
  /**
   * Things that must be settled before an account can be closed. Returned as a
   * list so the person sees everything in one go, not one error at a time.
   */
  async deletionBlockers(actor: AccountActor): Promise<string[]> {
    const problems: string[] = [];
    const profile = (await PROFILE_MODELS[actor.role]?.findOne({ userPublicId: actor.publicId, isDeleted: false }).lean()) as { publicId: string } | null | undefined;

    const wallet = await WalletModel.findOne({ ownerPublicId: actor.publicId, isDeleted: false }).lean();
    if (wallet) {
      if ((wallet.earnedCreditsCents ?? 0) > 0) {
        problems.push(
          `You still have $${(wallet.earnedCreditsCents / 100).toFixed(2)} of earnings. Withdraw them from your Wallet first.`,
        );
      }
      if ((wallet.purchasedCreditsCents ?? 0) > 0) {
        problems.push(
          `You still have $${(wallet.purchasedCreditsCents / 100).toFixed(2)} of purchased credits. Use them, or contact support to arrange a refund, before closing the account.`,
        );
      }
    }
    const pendingPayout = await WalletTransactionModel.countDocuments({
      ownerPublicId: actor.publicId,
      type: TransactionType.PAYOUT,
      status: TransactionStatus.PENDING,
    });
    if (pendingPayout > 0) problems.push('You have a payout waiting for review. Wait until it is approved or rejected.');

    const open = { status: { $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] }, isDeleted: false };
    if (actor.role === Role.TUTOR && profile) {
      if (await ScheduledClassModel.countDocuments({ ...open, tutorPublicId: profile.publicId })) {
        problems.push('You have booked or live classes. Complete or cancel them first.');
      }
      if (await CourseModel.countDocuments({ tutorPublicId: profile.publicId, status: 'ACCEPTED', isDeleted: false })) {
        problems.push('You have active courses with students. Finish or cancel them first.');
      }
      if (await ProgramModel.countDocuments({ tutorPublicId: profile.publicId, activeEnrollmentCount: { $gt: 0 } })) {
        problems.push('You have skill programs with enrolled students. Finish or cancel the enrolments first.');
      }
    }
    if (actor.role === Role.STUDENT && profile) {
      if (await ScheduledClassModel.countDocuments({ ...open, studentPublicId: profile.publicId })) {
        problems.push('You have booked or live classes. Complete or cancel them first.');
      }
      if (await CourseModel.countDocuments({ studentPublicId: profile.publicId, status: 'ACCEPTED', isDeleted: false })) {
        problems.push('You have an active course. Finish or cancel it first.');
      }
      if (await ProgramEnrollmentModel.countDocuments({ studentPublicId: profile.publicId, status: 'ACTIVE' })) {
        problems.push('You are enrolled in a skill program. Cancel the enrolment first.');
      }
    }
    if (actor.role === Role.PRINCIPAL) {
      const tutors = await TutorProfileModel.countDocuments({ principalPublicId: actor.publicId, isDeleted: false });
      if (tutors > 0) {
        problems.push(`${tutors} tutor(s) belong to your organization. Move or remove them first.`);
      }
    }
    if (actor.role === Role.SUPER_ADMIN) {
      const others = await UserModel.countDocuments({
        role: Role.SUPER_ADMIN, isDeleted: false, publicId: { $ne: actor.publicId },
      });
      if (others === 0) problems.push('You are the only super admin. Create another one before closing this account.');
    }
    return problems;
  }

  /** Close the caller's own account (soft delete, restorable by an admin). */
  async deleteOwnAccount(actor: AccountActor, input: { password?: string; confirm?: string }): Promise<void> {
    if (input.confirm?.trim() !== 'DELETE') {
      throw new ValidationError(['Type DELETE to confirm'], 'Type DELETE to confirm');
    }
    const existing = await userRepository.findByPublicId(actor.publicId);
    if (!existing) throw new NotFoundError('User');
    const withSecret = await userRepository.findByEmail(existing.email, true);
    if (!withSecret?.passwordHash || !input.password || !(await argon2.verify(withSecret.passwordHash, input.password))) {
      throw new AuthenticationError('Your password is incorrect');
    }

    const problems = await this.deletionBlockers(actor);
    if (problems.length > 0) throw new AppError(`Your account cannot be closed yet. ${problems.join(' ')}`, 409);

    await userRepository.softDelete(actor.publicId, actor.publicId);
    await userRepository.releaseEmail(actor.publicId);
    await PROFILE_MODELS[actor.role]?.updateOne(
      { userPublicId: actor.publicId },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: actor.publicId } },
    );
    await authService.logoutAllDevices(actor.publicId);

    await auditService.log({
      actorId: actor.publicId,
      actorRole: actor.role as never,
      action: 'USER_SELF_DELETED',
      resourceType: 'User',
      resourceId: actor.publicId,
      ip: actor.ip,
      userAgent: actor.userAgent,
      before: { email: existing.email, role: existing.role, status: existing.status },
      after: { isDeleted: true },
    });

    // Student accounts may have no deliverable address of their own.
    if (existing.email && !existing.email.endsWith('.invalid')) {
      sendEmailNow({
        to: existing.email,
        subject: 'Your brainbaseedu account was deleted',
        html: `<div style="font-family:sans-serif;max-width:520px;margin:auto">
          <h2>Your account was deleted</h2>
          <p>Hi ${existing.firstName ?? ''}, your brainbaseedu account was closed at your request and you were signed out on every device.</p>
          <p>Records we must keep, such as payment history, are retained for accounting. If this was not you, or you want the account back, contact support.</p>
        </div>`,
        text: 'Your brainbaseedu account was deleted at your request.',
      }).catch((e) => logger.warn('Could not send account-deleted email', { error: String(e) }));
    }
  }

  /** Everything the platform holds about the caller, as one JSON document. */
  async exportMyData(actor: AccountActor) {
    const user = await userRepository.findByPublicId(actor.publicId);
    if (!user) throw new NotFoundError('User');
    const profile = (await PROFILE_MODELS[actor.role]?.findOne({ userPublicId: actor.publicId }).lean()) as { publicId: string } | null | undefined;
    const wallet = await WalletModel.findOne({ ownerPublicId: actor.publicId }).lean();
    const transactions = await WalletTransactionModel.find({ ownerPublicId: actor.publicId })
      .sort({ createdAt: -1 }).limit(5000).lean();

    let classes: unknown[] = [];
    let attendance: unknown[] = [];
    if (profile && (actor.role === Role.STUDENT || actor.role === Role.TUTOR)) {
      const field = actor.role === Role.STUDENT ? 'studentPublicId' : 'tutorPublicId';
      classes = await ScheduledClassModel.find({ [field]: profile.publicId, isDeleted: false }).limit(5000).lean();
      if (actor.role === Role.STUDENT) {
        attendance = await AttendanceModel.find({ studentPublicId: profile.publicId }).limit(5000).lean();
      }
    }

    await auditService.log({
      actorId: actor.publicId,
      actorRole: actor.role as never,
      action: 'USER_DATA_EXPORTED',
      resourceType: 'User',
      resourceId: actor.publicId,
      ip: actor.ip,
      userAgent: actor.userAgent,
    }).catch(() => undefined);

    return {
      exportedAt: new Date().toISOString(),
      account: user,
      profile,
      wallet,
      walletTransactions: transactions,
      classes,
      attendance,
    };
  }
}

export const accountService = new AccountService();
