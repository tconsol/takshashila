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
    const [
      totalUsers, totalClasses, completedClasses, totalRevenueCents,
      totalStudents, totalTutors, totalPrincipals, totalParents,
      activeUsers, activeStudents, activeTutors,
    ] = await Promise.all([
      UserModel.countDocuments({ isDeleted: false }),
      ScheduledClassModel.countDocuments({ isDeleted: false }),
      ScheduledClassModel.countDocuments({ status: ClassStatus.COMPLETED, isDeleted: false }),
      WalletTransactionModel.aggregate([
        { $match: { type: TransactionType.CREDIT } },
        { $group: { _id: null, total: { $sum: '$amountCents' } } },
      ]).then((r) => r[0]?.total ?? 0),
      UserModel.countDocuments({ role: Role.STUDENT, isDeleted: false }),
      UserModel.countDocuments({ role: Role.TUTOR, isDeleted: false }),
      UserModel.countDocuments({ role: Role.PRINCIPAL, isDeleted: false }),
      UserModel.countDocuments({ role: Role.PARENT, isDeleted: false }),
      UserModel.countDocuments({ status: 'ACTIVE', isDeleted: false }),
      UserModel.countDocuments({ role: Role.STUDENT, status: 'ACTIVE', isDeleted: false }),
      UserModel.countDocuments({ role: Role.TUTOR, status: 'ACTIVE', isDeleted: false }),
    ]);

    return {
      totalUsers, totalClasses, completedClasses, totalRevenueCents,
      totalStudents, totalTutors, totalPrincipals, totalParents,
      activeUsers, activeStudents, activeTutors,
    };
  }

  async getClassStats(periodDays = 30) {
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const [completed, cancelled, booked, recentClasses] = await Promise.all([
      ScheduledClassModel.countDocuments({ status: ClassStatus.COMPLETED, createdAt: { $gte: since } }),
      ScheduledClassModel.countDocuments({ status: ClassStatus.CANCELLED, createdAt: { $gte: since } }),
      ScheduledClassModel.countDocuments({ createdAt: { $gte: since } }),
      ScheduledClassModel.find(
        { createdAt: { $gte: since }, isDeleted: false },
        { publicId: 1, title: 1, status: 1, startUTC: 1, costCents: 1, durationMinutes: 1 },
      )
        .sort({ startUTC: -1 })
        .limit(20)
        .lean(),
    ]);
    return { completed, cancelled, booked, periodDays, recentClasses };
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
    const rows = await ScheduledClassModel.aggregate([
      { $match: { status: ClassStatus.COMPLETED, isDeleted: false } },
      {
        $group: {
          _id: '$tutorPublicId',
          classesCompleted: { $sum: 1 },
          revenueCents: { $sum: '$costCents' },
        },
      },
      { $sort: { classesCompleted: -1 } },
      { $limit: limit },
    ]);

    // Classes key off the tutor PROFILE id; resolve through to the user for names.
    const profileIds = rows.map((r: { _id: string }) => r._id);
    const profiles = await TutorProfileModel.find(
      { publicId: { $in: profileIds } },
      { publicId: 1, userPublicId: 1, rating: 1, subjects: 1 },
    ).lean();
    const userIds = profiles.map((p) => p.userPublicId);
    const users = await UserModel.find(
      { publicId: { $in: userIds } },
      { publicId: 1, firstName: 1, lastName: 1, avatarUrl: 1 },
    ).lean();

    const userByPublicId = new Map(users.map((u) => [u.publicId, u]));
    const profileByPublicId = new Map(profiles.map((p) => [p.publicId, p]));

    return rows.map((r: { _id: string; classesCompleted: number; revenueCents: number }) => {
      const profile = profileByPublicId.get(r._id);
      const user = profile ? userByPublicId.get(profile.userPublicId) : undefined;
      return {
        tutorPublicId: r._id,
        name: user ? `${user.firstName} ${user.lastName}` : 'Unknown tutor',
        avatarUrl: user?.avatarUrl,
        subjects: profile?.subjects ?? [],
        rating: profile?.rating ?? 0,
        classesCompleted: r.classesCompleted,
        revenueCents: r.revenueCents ?? 0,
      };
    });
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

  /** Student cohort breakdown for the admin dashboards. */
  async getStudentBreakdown() {
    const [total, byStatusRaw, byGradeRaw, withTutor, aggregates] = await Promise.all([
      StudentProfileModel.countDocuments({ isDeleted: false }),
      StudentProfileModel.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      StudentProfileModel.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: { $ifNull: ['$grade', 'Unspecified'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 12 },
      ]),
      StudentProfileModel.countDocuments({
        isDeleted: false,
        tutorPublicId: { $exists: true, $nin: [null, ''] },
      }),
      StudentProfileModel.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: null,
            avgAttendanceRate: { $avg: '$attendanceRate' },
            totalClassesAttended: { $sum: '$totalClassesAttended' },
            totalClassesMissed: { $sum: '$totalClassesMissed' },
            totalClassesBooked: { $sum: '$totalClassesBooked' },
            demoClassesUsed: { $sum: '$demoClassesUsed' },
          },
        },
      ]),
    ]);

    const agg = aggregates[0] ?? {};

    return {
      total,
      withTutor,
      withoutTutor: total - withTutor,
      byStatus: byStatusRaw.map((s: { _id: string; count: number }) => ({ status: s._id, count: s.count })),
      byGrade: byGradeRaw.map((g: { _id: string; count: number }) => ({ grade: g._id, count: g.count })),
      avgAttendanceRate: Math.round(agg.avgAttendanceRate ?? 0),
      totalClassesAttended: agg.totalClassesAttended ?? 0,
      totalClassesMissed: agg.totalClassesMissed ?? 0,
      totalClassesBooked: agg.totalClassesBooked ?? 0,
      demoClassesUsed: agg.demoClassesUsed ?? 0,
    };
  }

  /** Daily signups per role over a window — the trend the dashboards were missing. */
  async getGrowth(periodDays = 90) {
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const rows = await UserModel.aggregate([
      { $match: { isDeleted: false, createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            role: '$role',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    // Collapse into one entry per day with a per-role map the client can chart directly.
    const byDate = new Map<string, { date: string; total: number; byRole: Record<string, number> }>();
    for (const r of rows as { _id: { date: string; role: string }; count: number }[]) {
      const entry = byDate.get(r._id.date) ?? { date: r._id.date, total: 0, byRole: {} };
      entry.byRole[r._id.role] = (entry.byRole[r._id.role] ?? 0) + r.count;
      entry.total += r.count;
      byDate.set(r._id.date, entry);
    }

    const series = [...byDate.values()];
    const previousWindowStart = new Date(since.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const [currentTotal, previousTotal] = await Promise.all([
      UserModel.countDocuments({ isDeleted: false, createdAt: { $gte: since } }),
      UserModel.countDocuments({ isDeleted: false, createdAt: { $gte: previousWindowStart, $lt: since } }),
    ]);

    return {
      periodDays,
      series,
      currentTotal,
      previousTotal,
      changePercent: previousTotal > 0
        ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100)
        : null,
    };
  }

  async getPrincipalStats(principalPublicId: string) {
    const tutorProfiles = await TutorProfileModel.find({ principalPublicId, isDeleted: false }, { publicId: 1 }).lean();
    const tutorPublicIds = tutorProfiles.map((t) => t.publicId);

    const { WorksheetModel, WorksheetSubmissionModel } = await import('../worksheets/worksheet.model');

    const [wsIds, aIds] = await Promise.all([
      WorksheetModel.distinct('publicId', { tutorPublicId: { $in: tutorPublicIds }, isDeleted: false }),
      AssignmentModel.distinct('publicId', { tutorPublicId: { $in: tutorPublicIds }, isDeleted: false }),
    ]);

    const [tutors, students, classes, worksheets, assignments, worksheetSubmissions, assignmentSubmissions] = await Promise.all([
      Promise.resolve(tutorPublicIds.length),
      StudentProfileModel.countDocuments({ tutorPublicId: { $in: tutorPublicIds }, isDeleted: false }),
      ScheduledClassModel.countDocuments({ tutorPublicId: { $in: tutorPublicIds }, isDeleted: false }),
      Promise.resolve(wsIds.length),
      Promise.resolve(aIds.length),
      WorksheetSubmissionModel.countDocuments({ worksheetPublicId: { $in: wsIds }, isDeleted: false }),
      SubmissionModel.countDocuments({ assignmentPublicId: { $in: aIds }, isDeleted: false }),
    ]);
    return { tutors, students, classes, worksheets, assignments, worksheetSubmissions, assignmentSubmissions };
  }

  async getTutorStats(tutorUserPublicId: string) {
    // Classes store the tutor PROFILE id, not the user id — resolve it first.
    const profile = await TutorProfileModel.findOne(
      { userPublicId: tutorUserPublicId, isDeleted: false }, { publicId: 1 },
    ).lean();
    const tutorPublicId = profile?.publicId ?? '__none__';

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

  async getStudentStats(studentUserPublicId: string) {
    // Classes and attendance store the student PROFILE id, not the user id.
    const profile = await StudentProfileModel.findOne(
      { userPublicId: studentUserPublicId, isDeleted: false }, { publicId: 1 },
    ).lean();
    const studentPublicId = profile?.publicId ?? '__none__';

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
