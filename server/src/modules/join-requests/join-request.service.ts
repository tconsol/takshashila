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
        subjects: [], languages: [], hourlyRateCents: 0, commissionRatePercent: 20,
        qualifications: [], timezone: 'UTC', trustScore: 50, totalStudents: 0,
        totalClassesCompleted: 0, totalClassesCancelled: 0, totalEarningsCents: 0,
        rating: 0, ratingCount: 0, isVerified: false, isDeleted: false,
      }).then((doc) => doc.toObject());
    }

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

    const request = await JoinRequestModel.create({
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
        subjects: [], languages: [], hourlyRateCents: 0, commissionRatePercent: 20,
        qualifications: [], timezone: 'UTC', trustScore: 50, totalStudents: 0,
        totalClassesCompleted: 0, totalClassesCancelled: 0, totalEarningsCents: 0,
        rating: 0, ratingCount: 0, isVerified: false, isDeleted: false,
      }).then((doc) => doc.toObject());
    }

    const existing = await JoinRequestModel.findOne({
      tutorUserPublicId: targetUser.publicId,
      principalProfilePublicId: principalProfile.publicId,
      status: JoinRequestStatus.PENDING,
      isDeleted: false,
    }).lean();
    if (existing) throw new ConflictError('A pending request already exists for this tutor');

    const request = await JoinRequestModel.create({
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

    await JoinRequestModel.updateOne(
      { publicId: requestPublicId },
      { $set: { status: JoinRequestStatus.APPROVED } },
    );

    // Attach tutor to principal, advance status, and increment the principal's tutor count
    await Promise.all([
      TutorProfileModel.findOneAndUpdate(
        { publicId: request.tutorProfilePublicId, isDeleted: false },
        {
          $set: {
            principalPublicId: request.principalUserPublicId,
            status: TutorStatus.UNDER_VERIFICATION,
          },
        },
      ),
      PrincipalProfileModel.updateOne(
        { userPublicId: request.principalUserPublicId, isDeleted: false },
        { $inc: { totalTutors: 1 } },
      ),
    ]);

    domainEvents.emit(DomainEvent.JOIN_REQUEST_APPROVED, {
      requestPublicId,
      tutorUserPublicId: request.tutorUserPublicId,
      principalUserPublicId: request.principalUserPublicId,
      principalProfilePublicId: request.principalProfilePublicId,
    });

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

    await JoinRequestModel.updateOne(
      { publicId: requestPublicId },
      { $set: { status: JoinRequestStatus.REJECTED, rejectionReason: reason } },
    );

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
    const normalizedQuery = query.toLowerCase().trim();
    let user = await userRepository.findByEmail(normalizedQuery);
    if (!user && query.trim()) {
      user = await userRepository.findByPhone(query.trim());
    }
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
        commissionRatePercent: 20,
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
