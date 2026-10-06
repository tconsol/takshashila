import type mongoose from 'mongoose';
import { ScheduledClassModel } from '../schedules/schedule.model';
import { ClassStatus, BillingMode, RequestStatus, BundleBilling } from '../schedules/schedule.types';
import { CourseModel } from '../courses/course.model';
import { CourseStatus } from '../courses/course.types';
import { ProgramEnrollmentModel } from '../programs/program.model';
import { EnrollmentStatus } from '../programs/program.types';
import { StudentProfileModel } from '../students/student.model';
import { PLATFORM_FEE_CENTS } from '../../utils/currency';
import { spendableCents } from './wallet.service';

/**
 * Everything a student has promised but not yet been charged for. The hold is DERIVED from
 * these rows, not stored on the wallet: callers read it inside walletService.runWithBookingLock
 * so concurrent bookings for one student serialize.
 */
export interface ReservedBreakdown {
  /** Price only (no fee) of the student's own unfinished bookings. */
  studentCents: number;
  studentCount: number;
  /** Price only of accepted tutor-created classes inside the funded block. */
  tutorCents: number;
  tutorCount: number;
  /** Untaught part of held courses and programs. Bundle sessions charge the price only, no fee. */
  bundleCents: number;
}

export interface WalletHold {
  spendableCents: number;
  reservedCents: number;
  /** What the student can still spend: spendable minus reserved, never below zero. */
  availableCents: number;
}

export function reservedTotalCents(b: ReservedBreakdown): number {
  return b.studentCents + b.tutorCents + (b.studentCount + b.tutorCount) * PLATFORM_FEE_CENTS + b.bundleCents;
}

type Rows = Array<{ totalCents?: number; count?: number }>;

export class ReserveService {
  private async _sum(query: PromiseLike<Rows> & { session(s: mongoose.ClientSession): PromiseLike<Rows> }, session?: mongoose.ClientSession) {
    const rows = await (session ? query.session(session) : query);
    return { totalCents: rows[0]?.totalCents ?? 0, count: rows[0]?.count ?? 0 };
  }

  async getBreakdown(profileIds: string[], session?: mongoose.ClientSession): Promise<ReservedBreakdown> {
    if (profileIds.length === 0) {
      return { studentCents: 0, studentCount: 0, tutorCents: 0, tutorCount: 0, bundleCents: 0 };
    }

    // The student's own bookings charge price + fee on completion.
    const student = await this._sum(ScheduledClassModel.aggregate([
      {
        $match: {
          studentPublicId: { $in: profileIds },
          billingMode: BillingMode.STUDENT_REQUESTED,
          status: { $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] },
          // Free demo classes (cost 0) are paid from demo credits and charge no fee: nothing to reserve.
          costCents: { $gt: 0 },
          isDeleted: false,
        },
      },
      { $group: { _id: null, totalCents: { $sum: '$costCents' }, count: { $sum: 1 } } },
    ]) as never, session);

    // Accepted tutor-created classes reserve money the same way, inside the funded block only.
    const tutor = await this._sum(ScheduledClassModel.aggregate([
      {
        $match: {
          studentPublicId: { $in: profileIds },
          billingMode: BillingMode.TUTOR_REQUESTED,
          requestStatus: RequestStatus.ACCEPTED,
          status: { $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] },
          costCents: { $gt: 0 },
          isDeleted: false,
          $expr: { $lt: ['$startUTC', '$fundedThrough'] },
        },
      },
      { $group: { _id: null, totalCents: { $sum: '$costCents' }, count: { $sum: 1 } } },
    ]) as never, session);

    // Held courses: classes still owed, whether or not they are scheduled yet.
    const course = await this._sum(CourseModel.aggregate([
      {
        $match: {
          studentPublicId: { $in: profileIds },
          billing: BundleBilling.HELD,
          status: CourseStatus.ACCEPTED,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          totalCents: {
            $sum: {
              $multiply: [
                { $max: [0, { $subtract: ['$classesRequired', '$classesCompletedCount'] }] },
                { $ifNull: ['$costCentsPerClass', 0] },
              ],
            },
          },
        },
      },
    ]) as never, session);

    // Held programs: sessions still owed at the flat per-session share. The rounding remainder is never held.
    const program = await this._sum(ProgramEnrollmentModel.aggregate([
      {
        $match: {
          studentPublicId: { $in: profileIds },
          billing: BundleBilling.HELD,
          status: EnrollmentStatus.ACTIVE,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          totalCents: {
            $sum: {
              $multiply: [
                { $max: [0, { $subtract: ['$sessionCount', '$sessionsCompletedCount'] }] },
                { $floor: { $divide: ['$priceCentsPaid', '$sessionCount'] } },
              ],
            },
          },
        },
      },
    ]) as never, session);

    return {
      studentCents: student.totalCents,
      studentCount: student.count,
      tutorCents: tutor.totalCents,
      tutorCount: tutor.count,
      bundleCents: course.totalCents + program.totalCents,
    };
  }

  /** The hold for a user's wallet, as shown to them and as enforced on admin deductions. */
  async getHoldForUser(
    userPublicId: string,
    wallet: { balanceCents: number; demoCreditsCents?: number },
    session?: mongoose.ClientSession,
  ): Promise<WalletHold> {
    const profiles = await StudentProfileModel.find({ userPublicId, isDeleted: false }, { publicId: 1 }).lean();
    const reservedCents = reservedTotalCents(await this.getBreakdown(profiles.map((p) => p.publicId), session));
    const spendable = spendableCents(wallet);
    return { spendableCents: spendable, reservedCents, availableCents: Math.max(0, spendable - reservedCents) };
  }
}

export const reserveService = new ReserveService();
