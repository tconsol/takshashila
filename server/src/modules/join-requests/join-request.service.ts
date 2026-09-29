import { v4 as uuidv4 } from 'uuid';
import { JoinRequestModel } from './join-request.model';
import { JoinRequestStatus, JoinRequestInitiator } from './join-request.types';
import type { IJoinRequest } from './join-request.types';
import { TutorProfileModel } from '../tutors/tutor.model';
import { TutorStatus } from '../tutors/tutor.types';
import { PrincipalProfileModel } from '../principals/principal.model';
import { PrincipalStatus } from '../principals/principal.types';
import { userRepository } from '../users/user.repository';
import { ConflictError, NotFoundError, AppError } from '../../utils/error';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { settingsService } from '../settings/settings.service';
import { ScheduledClassModel } from '../schedules/schedule.model';
import { ClassStatus } from '../schedules/schedule.types';
import { logger } from '../../lib/logger';

export interface JoinRequestWithDetails extends IJoinRequest {
  tutorName: string;
  tutorEmail: string;
  tutorSubjects: string[];
  principalName: string;
  principalOrg: string;
  principalEmail: string;
}

export class JoinRequestService {
  async createTutorRequest(
    tutorUserPublicId: string,
    principalProfilePublicId: string,
    message?: string,
  ): Promise<IJoinRequest> {
    let tutorProfile = await TutorProfileModel.findOne({
      userPublicId: tutorUserPublicId,
      isDeleted: false,
    }).lean();
    if (!tutorProfile) {
      tutorProfile = await TutorProfileModel.create({
        publicId: uuidv4(),
        userPublicId: tutorUserPublicId,
        status: TutorStatus.REGISTERED,
        subjects: [], languages: [], hourlyRateCents: 0,
        commissionRatePercent: (await settingsService.get()).defaultTutorCommissionRatePercent,
        qualifications: [], timezone: 'UTC', trustScore: 50, totalStudents: 0,
        totalClassesCompleted: 0, totalClassesCancelled: 0, totalEarningsCents: 0,
        rating: 0, ratingCount: 0, isVerified: false, isDeleted: false,
      }).then((doc) => doc.toObject());
    }
    if (!tutorProfile) throw new AppError('Failed to initialise tutor profile', 500);

    const principalProfile = await PrincipalProfileModel.findOne({
      publicId: principalProfilePublicId,
      isDeleted: false,
      status: PrincipalStatus.ACTIVE,
    }).lean();
    if (!principalProfile) throw new NotFoundError('Principal profile');

    const existing = await JoinRequestModel.findOne({
      tutorUserPublicId,
      principalProfilePublicId,
      status: JoinRequestStatus.PENDING,
      isDeleted: false,
    }).lean();
    if (existing) throw new ConflictError('A pending request already exists for this principal');

    const request = await this._createPending({
      publicId: uuidv4(),
      tutorUserPublicId,
      tutorProfilePublicId: tutorProfile.publicId,
      principalUserPublicId: principalProfile.userPublicId,
      principalProfilePublicId,
      initiatedBy: JoinRequestInitiator.TUTOR,
      status: JoinRequestStatus.PENDING,
      message,
      isDeleted: false,
    });

    domainEvents.emit(DomainEvent.JOIN_REQUEST_SENT, {
      requestPublicId: request.publicId,
      tutorUserPublicId,
      principalUserPublicId: principalProfile.userPublicId,
      initiatedBy: JoinRequestInitiator.TUTOR,
    });

    return request.toObject();
  }

  async createPrincipalRequest(
    principalUserPublicId: string,
    query: string,
    message?: string,
  ): Promise<IJoinRequest> {
    const principalProfile = await PrincipalProfileModel.findOne({
      userPublicId: principalUserPublicId,
      isDeleted: false,
      status: PrincipalStatus.ACTIVE,
    }).lean();
    if (!principalProfile) throw new NotFoundError('Principal profile');

    // Find user by email or phone
    const normalizedQuery = query.toLowerCase().trim();
    let targetUser = await userRepository.findByEmail(normalizedQuery);
    if (!targetUser && query.trim()) {
      targetUser = await userRepository.findByPhone(query.trim());
    }
    if (!targetUser || targetUser.role !== 'TUTOR') {
      throw new NotFoundError('No tutor found with that email or phone number');
    }

    let tutorProfile = await TutorProfileModel.findOne({
      userPublicId: targetUser.publicId,
      isDeleted: false,
    }).lean();
    if (!tutorProfile) {
      tutorProfile = await TutorProfileModel.create({
        publicId: uuidv4(),
        userPublicId: targetUser.publicId,
        status: TutorStatus.REGISTERED,
        subjects: [], languages: [], hourlyRateCents: 0,
        commissionRatePercent: (await settingsService.get()).defaultTutorCommissionRatePercent,
        qualifications: [], timezone: 'UTC', trustScore: 50, totalStudents: 0,
        totalClassesCompleted: 0, totalClassesCancelled: 0, totalEarningsCents: 0,
        rating: 0, ratingCount: 0, isVerified: false, isDeleted: false,
      }).then((doc) => doc.toObject());
    }
    if (!tutorProfile) throw new AppError('Failed to initialise tutor profile', 500);

    const existing = await JoinRequestModel.findOne({
      tutorUserPublicId: targetUser.publicId,
      principalProfilePublicId: principalProfile.publicId,
      status: JoinRequestStatus.PENDING,
      isDeleted: false,
    }).lean();
    if (existing) throw new ConflictError('A pending request already exists for this tutor');

    const request = await this._createPending({
      publicId: uuidv4(),
      tutorUserPublicId: targetUser.publicId,
      tutorProfilePublicId: tutorProfile.publicId,
      principalUserPublicId,
      principalProfilePublicId: principalProfile.publicId,
      initiatedBy: JoinRequestInitiator.PRINCIPAL,
      status: JoinRequestStatus.PENDING,
      message,
      isDeleted: false,
    });

    domainEvents.emit(DomainEvent.JOIN_REQUEST_SENT, {
      requestPublicId: request.publicId,
      tutorUserPublicId: targetUser.publicId,
      principalUserPublicId,
      initiatedBy: JoinRequestInitiator.PRINCIPAL,
    });

    return request.toObject();
  }

  /** Create a PENDING request; the partial unique index turns a duplicate into a ConflictError. */
  private async _createPending(data: Partial<IJoinRequest>) {
    try {
      return await JoinRequestModel.create(data);
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictError('A pending request already exists between this tutor and principal');
      }
      throw err;
    }
  }

  /** Tell a tutor's students (and parents) that the tutor's organization can now see their progress. */
  private async notifyStudentsOfNewOrganization(tutorProfilePublicId: string, principalUserPublicId: string): Promise<void> {
    try {
      const { StudentProfileModel } = await import('../students/student.model');
      const { ParentProfileModel } = await import('../parents/parent.model');
      const { notificationService } = await import('../notifications/notification.service');
      const principal = await userRepository.findByPublicId(principalUserPublicId);
      const principalProfile = await PrincipalProfileModel.findOne({ userPublicId: principalUserPublicId }, { organizationName: 1 }).lean();
      const org = principalProfile?.organizationName || (principal ? `${principal.firstName} ${principal.lastName}`.trim() : 'an organization');

      const students = await StudentProfileModel.find(
        { tutorPublicId: tutorProfilePublicId, isDeleted: false, status: { $in: ['ACTIVE', 'PENDING_APPROVAL'] } },
        { publicId: 1, userPublicId: 1 },
      ).lean();
      const body = `Your tutor has joined ${org}. The organization's principal can now see your classes, attendance and progress. You can stop this at any time from My Tutors by unlinking, or contact support with questions.`;
      for (const st of students) {
        await notificationService.create({
          recipientPublicId: st.userPublicId, type: 'SYSTEM' as never, title: 'Your tutor joined an organization', body,
        });
      }
      const parents = await ParentProfileModel.find(
        { childStudentPublicIds: { $in: students.map((st) => st.publicId) }, isDeleted: false },
        { userPublicId: 1 },
      ).lean();
      for (const pr of parents) {
        await notificationService.create({
          recipientPublicId: pr.userPublicId, type: 'SYSTEM' as never, title: "Your child's tutor joined an organization",
          body: body.replace('Your tutor', "Your child's tutor").replace('your classes', "your child's classes"),
        });
      }
    } catch (error) {
      logger.warn('Could not notify students of tutor joining an organization', { error: String(error) });
    }
  }

  async approveRequest(requestPublicId: string, actorPublicId: string): Promise<IJoinRequest> {
    const request = await JoinRequestModel.findOne({
      publicId: requestPublicId,
      status: JoinRequestStatus.PENDING,
      isDeleted: false,
    }).lean();
    if (!request) throw new NotFoundError('Join request');

    // Verify actor is the receiver
    const isReceiver =
      (request.initiatedBy === JoinRequestInitiator.TUTOR && request.principalUserPublicId === actorPublicId) ||
      (request.initiatedBy === JoinRequestInitiator.PRINCIPAL && request.tutorUserPublicId === actorPublicId);

    if (!isReceiver) throw new AppError('Not authorised to approve this request', 403);

    // Atomic PENDING -> APPROVED transition: only the caller that wins this
    // write goes on to bump the counter, so retries can't double-count.
    const transitioned = await JoinRequestModel.findOneAndUpdate(
      { publicId: requestPublicId, status: JoinRequestStatus.PENDING, isDeleted: false },
      { $set: { status: JoinRequestStatus.APPROVED } },
    ).lean();
    if (!transitioned) throw new ConflictError('This request has already been processed');

    // Attach tutor to principal, advance status, and move the principal's tutor count.
    // findOneAndUpdate returns the PRE-update doc so we know which org (if any) the tutor is leaving.
    const before = await TutorProfileModel.findOneAndUpdate(
      { publicId: request.tutorProfilePublicId, isDeleted: false },
      {
        $set: {
          principalPublicId: request.principalUserPublicId,
          status: TutorStatus.UNDER_VERIFICATION,
        },
      },
    );
    const oldPrincipal = before?.principalPublicId;
    const switching = !!oldPrincipal && oldPrincipal !== request.principalUserPublicId;
    const unchanged = oldPrincipal === request.principalUserPublicId;

    await Promise.all([
      unchanged
        ? Promise.resolve()
        : PrincipalProfileModel.updateOne(
          { userPublicId: request.principalUserPublicId, isDeleted: false },
          { $inc: { totalTutors: 1 } },
        ),
      switching
        ? PrincipalProfileModel.updateOne(
          { userPublicId: oldPrincipal, isDeleted: false, totalTutors: { $gt: 0 } },
          { $inc: { totalTutors: -1 } },
        )
        : Promise.resolve(),
    ]);

    domainEvents.emit(DomainEvent.JOIN_REQUEST_APPROVED, {
      requestPublicId,
      tutorUserPublicId: request.tutorUserPublicId,
      principalUserPublicId: request.principalUserPublicId,
      principalProfilePublicId: request.principalProfilePublicId,
    });

    // The principal can now see this tutor's students. Their consent is not asked
    // first, so at least tell them (and let them unlink from My Tutors).
    if (!unchanged) void this.notifyStudentsOfNewOrganization(request.tutorProfilePublicId, request.principalUserPublicId);

    return { ...request, status: JoinRequestStatus.APPROVED };
  }

  async rejectRequest(
    requestPublicId: string,
    actorPublicId: string,
    reason?: string,
  ): Promise<IJoinRequest> {
    const request = await JoinRequestModel.findOne({
      publicId: requestPublicId,
      status: JoinRequestStatus.PENDING,
      isDeleted: false,
    }).lean();
    if (!request) throw new NotFoundError('Join request');

    const isReceiver =
      (request.initiatedBy === JoinRequestInitiator.TUTOR && request.principalUserPublicId === actorPublicId) ||
      (request.initiatedBy === JoinRequestInitiator.PRINCIPAL && request.tutorUserPublicId === actorPublicId);

    if (!isReceiver) throw new AppError('Not authorised to reject this request', 403);

    const transitioned = await JoinRequestModel.findOneAndUpdate(
      { publicId: requestPublicId, status: JoinRequestStatus.PENDING, isDeleted: false },
      { $set: { status: JoinRequestStatus.REJECTED, rejectionReason: reason } },
    ).lean();
    if (!transitioned) throw new ConflictError('This request has already been processed');

    domainEvents.emit(DomainEvent.JOIN_REQUEST_REJECTED, {
      requestPublicId,
      tutorUserPublicId: request.tutorUserPublicId,
      principalUserPublicId: request.principalUserPublicId,
    });

    return { ...request, status: JoinRequestStatus.REJECTED };
  }

  async cancelRequest(requestPublicId: string, actorPublicId: string): Promise<void> {
    const request = await JoinRequestModel.findOne({
      publicId: requestPublicId,
      status: JoinRequestStatus.PENDING,
      isDeleted: false,
    }).lean();
    if (!request) throw new NotFoundError('Join request');

    const isSender =
      (request.initiatedBy === JoinRequestInitiator.TUTOR && request.tutorUserPublicId === actorPublicId) ||
      (request.initiatedBy === JoinRequestInitiator.PRINCIPAL && request.principalUserPublicId === actorPublicId);

    if (!isSender) throw new AppError('Not authorised to cancel this request', 403);

    await JoinRequestModel.updateOne(
      { publicId: requestPublicId },
      { $set: { status: JoinRequestStatus.CANCELLED } },
    );
  }

  /** Tutor leaves their current organization. */
  async leaveOrganization(tutorUserPublicId: string): Promise<void> {
    const tutor = await TutorProfileModel.findOne({ userPublicId: tutorUserPublicId, isDeleted: false }).lean();
    if (!tutor) throw new NotFoundError('Tutor profile');
    if (!tutor.principalPublicId) throw new ConflictError('You are not part of an organization');
    await this._detachTutor(tutor.publicId, tutor.userPublicId, tutor.principalPublicId, 'TUTOR');
  }

  /** Principal removes one of their OWN tutors. */
  async removeTutor(principalUserPublicId: string, tutorProfilePublicId: string): Promise<void> {
    const tutor = await TutorProfileModel.findOne({ publicId: tutorProfilePublicId, isDeleted: false }).lean();
    // Same 404 for "not found" and "someone else's tutor" so ids can't be probed.
    if (!tutor || tutor.principalPublicId !== principalUserPublicId) throw new NotFoundError('Tutor');
    await this._detachTutor(tutor.publicId, tutor.userPublicId, principalUserPublicId, 'PRINCIPAL');
  }

  private async _detachTutor(
    tutorProfilePublicId: string,
    tutorUserPublicId: string,
    principalUserPublicId: string,
    initiatedBy: 'TUTOR' | 'PRINCIPAL',
  ): Promise<void> {
    // Guarded on the current principal so a double-click cannot decrement twice.
    const detached = await TutorProfileModel.findOneAndUpdate(
      { publicId: tutorProfilePublicId, principalPublicId: principalUserPublicId, isDeleted: false },
      { $unset: { principalPublicId: '' } },
    );
    if (!detached) throw new ConflictError('Tutor is no longer part of this organization');

    await PrincipalProfileModel.updateOne(
      { userPublicId: principalUserPublicId, isDeleted: false, totalTutors: { $gt: 0 } },
      { $inc: { totalTutors: -1 } },
    );

    const openClasses = await ScheduledClassModel.countDocuments({
      tutorPublicId: tutorProfilePublicId,
      status: { $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] },
      isDeleted: false,
    });
    if (openClasses > 0) {
      logger.warn('Tutor left organization with open classes', { tutorProfilePublicId, principalUserPublicId, openClasses });
    }

    const tutorUser = await userRepository.findByPublicId(tutorUserPublicId);
    domainEvents.emit(DomainEvent.TUTOR_LEFT_ORGANIZATION, {
      tutorUserPublicId,
      principalUserPublicId,
      initiatedBy,
      tutorName: tutorUser ? `${tutorUser.firstName} ${tutorUser.lastName}` : 'A tutor',
    });
  }

  async listIncoming(actorPublicId: string, role: string): Promise<JoinRequestWithDetails[]> {
    let filter: Record<string, unknown>;
    if (role === 'PRINCIPAL') {
      filter = {
        principalUserPublicId: actorPublicId,
        initiatedBy: JoinRequestInitiator.TUTOR,
        status: JoinRequestStatus.PENDING,
        isDeleted: false,
      };
    } else {
      filter = {
        tutorUserPublicId: actorPublicId,
        initiatedBy: JoinRequestInitiator.PRINCIPAL,
        status: JoinRequestStatus.PENDING,
        isDeleted: false,
      };
    }

    const requests = await JoinRequestModel.find(filter).sort({ createdAt: -1 }).lean();
    return this._hydrate(requests);
  }

  async listOutgoing(actorPublicId: string, role: string): Promise<JoinRequestWithDetails[]> {
    let filter: Record<string, unknown>;
    if (role === 'PRINCIPAL') {
      filter = {
        principalUserPublicId: actorPublicId,
        initiatedBy: JoinRequestInitiator.PRINCIPAL,
        isDeleted: false,
      };
    } else {
      filter = {
        tutorUserPublicId: actorPublicId,
        initiatedBy: JoinRequestInitiator.TUTOR,
        isDeleted: false,
      };
    }

    const requests = await JoinRequestModel.find(filter).sort({ createdAt: -1 }).lean();
    return this._hydrate(requests);
  }

  async searchTutor(query: string): Promise<{
    userPublicId: string;
    tutorProfilePublicId: string;
    displayName: string;
    email: string;
    phone?: string;
    subjects: string[];
    status: string;
    principalPublicId?: string;
  } | null> {
    // One box, three kinds of identifier — a principal shouldn't have to tell us
    // which they pasted. Order is cheapest/most selective first.
    const trimmed = query.trim();
    if (!trimmed) return null;

    let user = await userRepository.findByEmail(trimmed.toLowerCase());
    if (!user) user = await userRepository.findByPhone(trimmed);
    if (!user) user = await userRepository.findByPublicId(trimmed);

    if (!user || user.role !== 'TUTOR') return null;

    let profile = await TutorProfileModel.findOne({
      userPublicId: user.publicId,
      isDeleted: false,
    }).lean();

    // Auto-create profile for tutors who registered before profile auto-creation was added
    if (!profile) {
      profile = await TutorProfileModel.create({
        publicId: uuidv4(),
        userPublicId: user.publicId,
        status: TutorStatus.REGISTERED,
        subjects: [],
        languages: [],
        hourlyRateCents: 0,
        commissionRatePercent: (await settingsService.get()).defaultTutorCommissionRatePercent,
        qualifications: [],
        timezone: 'UTC',
        trustScore: 50,
        totalStudents: 0,
        totalClassesCompleted: 0,
        totalClassesCancelled: 0,
        totalEarningsCents: 0,
        rating: 0,
        ratingCount: 0,
        isVerified: false,
        isDeleted: false,
      }).then((doc) => doc.toObject());
    }
    if (!profile) throw new AppError('Failed to initialise tutor profile', 500);

    return {
      userPublicId: user.publicId,
      tutorProfilePublicId: profile.publicId,
      displayName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phone: user.phone,
      subjects: profile.subjects,
      status: profile.status,
      principalPublicId: profile.principalPublicId,
    };
  }

  private async _hydrate(requests: IJoinRequest[]): Promise<JoinRequestWithDetails[]> {
    if (requests.length === 0) return [];

    const tutorUserIds = [...new Set(requests.map((r) => r.tutorUserPublicId))];
    const principalUserIds = [...new Set(requests.map((r) => r.principalUserPublicId))];
    const principalProfileIds = [...new Set(requests.map((r) => r.principalProfilePublicId))];
    const tutorProfileIds = [...new Set(requests.map((r) => r.tutorProfilePublicId))];

    const [tutorUsers, principalUsers, principalProfiles, tutorProfiles] = await Promise.all([
      userRepository.findManyByPublicIds(tutorUserIds),
      userRepository.findManyByPublicIds(principalUserIds),
      PrincipalProfileModel.find({ publicId: { $in: principalProfileIds } }).lean(),
      TutorProfileModel.find({ publicId: { $in: tutorProfileIds } }).lean(),
    ]);

    const tutorUserMap = new Map(tutorUsers.map((u) => [u.publicId, u]));
    const principalUserMap = new Map(principalUsers.map((u) => [u.publicId, u]));
    const principalProfileMap = new Map(principalProfiles.map((p) => [p.publicId, p]));
    const tutorProfileMap = new Map(tutorProfiles.map((t) => [t.publicId, t]));

    return requests.map((r) => {
      const tutorUser = tutorUserMap.get(r.tutorUserPublicId);
      const principalUser = principalUserMap.get(r.principalUserPublicId);
      const principalProfile = principalProfileMap.get(r.principalProfilePublicId);
      const tutorProfile = tutorProfileMap.get(r.tutorProfilePublicId);

      return {
        ...r,
        tutorName: tutorUser ? `${tutorUser.firstName} ${tutorUser.lastName}` : 'Unknown Tutor',
        tutorEmail: tutorUser?.email ?? '',
        tutorSubjects: tutorProfile?.subjects ?? [],
        principalName: principalUser ? `${principalUser.firstName} ${principalUser.lastName}` : 'Unknown Principal',
        principalOrg: (principalProfile as { organizationName?: string })?.organizationName ?? '',
        principalEmail: principalUser?.email ?? '',
      };
    });
  }
}

export const joinRequestService = new JoinRequestService();
