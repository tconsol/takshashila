import { UserModel } from '../users/user.model';
import { ScheduledClassModel } from '../schedules/schedule.model';
import { WalletTransactionModel } from '../wallets/wallet-transaction.model';
import { AssignmentModel, SubmissionModel } from '../assignments/assignment.model';
import { AttendanceModel } from '../attendance/attendance.model';
import { TutorProfileModel } from '../tutors/tutor.model';
import { StudentProfileModel } from '../students/student.model';
import { PrincipalProfileModel } from '../principals/principal.model';
import { TicketModel } from '../support/support.model';
import { AuditLogModel } from '../audit/audit.model';
import { Role } from '../../constants/roles';
import { ClassStatus } from '../schedules/schedule.types';
import { TransactionType, CreditType, TransactionStatus } from '../wallets/wallet.types';
import { PrincipalStatus } from '../principals/principal.types';
import { TicketStatus, TicketPriority } from '../support/support.types';

export class AnalyticsService {
  async getPlatformOverview() {
    const [totalUsers, totalClasses, totalRevenueCents, activeStudents, activeTutors] = await Promise.all([
      UserModel.countDocuments({ isDeleted: false }),
      ScheduledClassModel.countDocuments({ isDeleted: false }),
      WalletTransactionModel.aggregate([
        { $match: { type: TransactionType.CREDIT } },
        { $group: { _id: null, total: { $sum: '$amountCents' } } },
      ]).then((r) => r[0]?.total ?? 0),
      UserModel.countDocuments({ role: Role.STUDENT, status: 'ACTIVE', isDeleted: false }),
      UserModel.countDocuments({ role: Role.TUTOR, status: 'ACTIVE', isDeleted: false }),
    ]);

    return { totalUsers, totalClasses, totalRevenueCents, activeStudents, activeTutors };
  }

  async getClassStats(periodDays = 30) {
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const [completed, cancelled, booked] = await Promise.all([
      ScheduledClassModel.countDocuments({ status: ClassStatus.COMPLETED, createdAt: { $gte: since } }),
      ScheduledClassModel.countDocuments({ status: ClassStatus.CANCELLED, createdAt: { $gte: since } }),
      ScheduledClassModel.countDocuments({ createdAt: { $gte: since } }),
    ]);
    return { completed, cancelled, booked, periodDays };
  }

  async getRevenueByPeriod(periodDays = 30) {
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const result = await WalletTransactionModel.aggregate([
      { $match: { type: TransactionType.CREDIT, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalCents: { $sum: '$amountCents' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return result;
  }

  async getTopTutors(limit = 10) {
    return ScheduledClassModel.aggregate([
      { $match: { status: ClassStatus.COMPLETED } },
      { $group: { _id: '$tutorPublicId', classesCompleted: { $sum: 1 } } },
      { $sort: { classesCompleted: -1 } },
      { $limit: limit },
    ]);
  }

  async getAssignmentStats(periodDays = 30) {
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const [published, submitted, graded] = await Promise.all([
      AssignmentModel.countDocuments({ createdAt: { $gte: since }, isDeleted: false }),
      SubmissionModel.countDocuments({ createdAt: { $gte: since } }),
      SubmissionModel.countDocuments({ createdAt: { $gte: since }, score: { $exists: true } }),
    ]);
    return { published, submitted, graded, periodDays };
  }

  async getAttendanceRate(periodDays = 30) {
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const result = await AttendanceModel.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] } },
        },
      },
    ]);
    const { total = 0, present = 0 } = result[0] ?? {};
    return { total, present, rate: total > 0 ? Math.round((present / total) * 100) : 0 };
  }

  async getPrincipalStats(principalPublicId: string) {
    const tutorProfiles = await TutorProfileModel.find({ principalPublicId, isDeleted: false }, { publicId: 1 }).lean();
    const tutorPublicIds = tutorProfiles.map((t) => t.publicId);

    const [tutors, students, classes] = await Promise.all([
      Promise.resolve(tutorPublicIds.length),
      StudentProfileModel.countDocuments({ tutorPublicId: { $in: tutorPublicIds }, isDeleted: false }),
      ScheduledClassModel.countDocuments({ tutorPublicId: { $in: tutorPublicIds }, isDeleted: false }),
    ]);
    return { tutors, students, classes };
  }

  async getTutorStats(tutorPublicId: string) {
    const [upcoming, completed, totalStudents] = await Promise.all([
      ScheduledClassModel.countDocuments({ tutorPublicId, status: ClassStatus.SCHEDULED }),
      ScheduledClassModel.countDocuments({ tutorPublicId, status: ClassStatus.COMPLETED }),
      ScheduledClassModel.distinct('studentPublicId', { tutorPublicId, status: ClassStatus.COMPLETED }).then((r) => r.length),
    ]);
    return { upcoming, completed, totalStudents };
  }

  async getSuperAdminDashboard() {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalUsers, totalClasses, roleDistributionRaw, revenueTotalResult, tutorEarningsResult, recentAuditEvents] =
      await Promise.all([
        UserModel.countDocuments({ isDeleted: false }),
        ScheduledClassModel.countDocuments({ isDeleted: false }),
        UserModel.aggregate([
          { $match: { isDeleted: false } },
          { $group: { _id: '$role', count: { $sum: 1 } } },
        ]),
        WalletTransactionModel.aggregate([
          { $match: { type: TransactionType.DEBIT, status: TransactionStatus.COMPLETED, createdAt: { $gte: since30d } } },
          { $group: { _id: null, totalCents: { $sum: '$amountCents' } } },
        ]),
        WalletTransactionModel.aggregate([
          { $match: { type: TransactionType.CREDIT, creditType: CreditType.EARNED_CREDITS, status: TransactionStatus.COMPLETED, createdAt: { $gte: since30d } } },
          { $group: { _id: null, totalCents: { $sum: '$amountCents' } } },
        ]),
        AuditLogModel.find({}).sort({ createdAt: -1 }).limit(5).lean(),
      ]);

    const totalRevenueCents = revenueTotalResult[0]?.totalCents ?? 0;
    const tutorEarningsCents = tutorEarningsResult[0]?.totalCents ?? 0;
    const platformCommissionCents = Math.max(0, totalRevenueCents - tutorEarningsCents);

    const roleDistribution = roleDistributionRaw.map((r: { _id: string; count: number }) => ({
      role: r._id as string,
      count: r.count,
    }));

    return {
      totalUsers,
      totalClasses,
      roleDistribution,
      revenue30d: {
        totalCents: totalRevenueCents,
        tutorEarningsCents,
        platformCommissionCents,
      },
      recentAuditEvents,
    };
  }

  async getAdminDashboard() {
    const highPriorityStatuses = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS];
    const urgentPriorities = [TicketPriority.HIGH, TicketPriority.URGENT];

    const [
      pendingApprovals,
      activePrincipals,
      openTickets,
      highPriorityTickets,
      payoutsPendingResult,
      pendingPrincipalProfiles,
      urgentTicketsList,
    ] = await Promise.all([
      PrincipalProfileModel.countDocuments({ status: PrincipalStatus.PENDING_APPROVAL, isDeleted: false }),
      PrincipalProfileModel.countDocuments({ status: PrincipalStatus.ACTIVE, isDeleted: false }),
      TicketModel.countDocuments({ status: { $in: highPriorityStatuses }, isDeleted: false }),
      TicketModel.countDocuments({ priority: { $in: urgentPriorities }, status: { $in: highPriorityStatuses }, isDeleted: false }),
      WalletTransactionModel.aggregate([
        { $match: { type: TransactionType.PAYOUT, status: TransactionStatus.PENDING } },
        { $group: { _id: null, totalCents: { $sum: '$amountCents' } } },
      ]),
      PrincipalProfileModel.find({ status: PrincipalStatus.PENDING_APPROVAL, isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      TicketModel.find({ priority: { $in: urgentPriorities }, status: { $in: highPriorityStatuses }, isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const userPublicIds = pendingPrincipalProfiles.map((p) => p.userPublicId);
    const users = await UserModel.find(
      { publicId: { $in: userPublicIds } },
      { publicId: 1, firstName: 1, lastName: 1, email: 1 },
    ).lean();
    const userMap = new Map(users.map((u) => [u.publicId, u]));

    const pendingPrincipalsList = pendingPrincipalProfiles.map((p) => {
      const u = userMap.get(p.userPublicId);
      return {
        publicId: p.publicId,
        organizationName: p.organizationName ?? '',
        name: u ? `${u.firstName} ${u.lastName}` : 'Unknown',
        email: u?.email ?? '',
        appliedAt: p.createdAt,
      };
    });

    return {
      stats: {
        pendingApprovals,
        activePrincipals,
        openTickets,
        highPriorityTickets,
        payoutsPendingCents: payoutsPendingResult[0]?.totalCents ?? 0,
      },
      pendingPrincipalsList,
      urgentTicketsList,
    };
  }

  async getStudentStats(studentPublicId: string) {
    const [upcoming, completed, submissions] = await Promise.all([
      ScheduledClassModel.countDocuments({ studentPublicId, status: ClassStatus.SCHEDULED }),
      ScheduledClassModel.countDocuments({ studentPublicId, status: ClassStatus.COMPLETED }),
      SubmissionModel.countDocuments({ studentPublicId }),
    ]);

    const attendance = await AttendanceModel.aggregate([
      { $match: { studentPublicId } },
      { $group: { _id: null, total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] } } } },
    ]);
    const { total = 0, present = 0 } = attendance[0] ?? {};
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

    return { upcoming, completed, submissions, attendanceRate };
  }
}

export const analyticsService = new AnalyticsService();
