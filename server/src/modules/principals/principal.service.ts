import { v4 as uuidv4 } from 'uuid';
import { PrincipalProfileModel } from './principal.model';
import { PrincipalStatus } from './principal.types';
import type { IPrincipalProfile } from './principal.types';
import { NotFoundError, ConflictError } from '../../utils/error';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { walletService } from '../wallets/wallet.service';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';

export interface PrincipalWithUser extends IPrincipalProfile {
  firstName: string;
  lastName: string;
  email: string;
}

export class PrincipalService {
  async createProfile(userPublicId: string, data: Partial<IPrincipalProfile>): Promise<IPrincipalProfile> {
    const existing = await PrincipalProfileModel.findOne({ userPublicId });
    if (existing) throw new ConflictError('Principal profile already exists');

    const profile = await PrincipalProfileModel.create({
      publicId: uuidv4(),
      userPublicId,
      status: PrincipalStatus.PENDING_APPROVAL,
      organizationName: data.organizationName,
      organizationWebsite: data.organizationWebsite,
      bio: data.bio,
      commissionRatePercent: data.commissionRatePercent || 15,
      totalTutors: 0,
      totalStudents: 0,
      totalRevenueCents: 0,
      trustScore: 50,
      isDeleted: false,
    });

    await walletService.createWallet(userPublicId).catch(() => {});
    return profile.toObject();
  }

  async getByPublicId(publicId: string): Promise<IPrincipalProfile> {
    const profile = await PrincipalProfileModel.findOne({ publicId, isDeleted: false }).lean();
    if (!profile) throw new NotFoundError('Principal profile');
    return profile;
  }

  async getByUserPublicId(userPublicId: string): Promise<IPrincipalProfile> {
    const profile = await PrincipalProfileModel.findOne({ userPublicId, isDeleted: false }).lean();
    if (!profile) throw new NotFoundError('Principal profile');
    return profile;
  }

  async approve(publicId: string, approvedBy: string): Promise<IPrincipalProfile> {
    const profile = await PrincipalProfileModel.findOneAndUpdate(
      { publicId, status: PrincipalStatus.PENDING_APPROVAL, isDeleted: false },
      { $set: { status: PrincipalStatus.ACTIVE, approvedBy, approvedAt: new Date() } },
      { new: true },
    ).lean();
    if (!profile) throw new NotFoundError('Principal profile');
    domainEvents.emit(DomainEvent.PRINCIPAL_APPROVED, {
      principalPublicId: publicId,
      userPublicId: profile.userPublicId,
      approvedBy,
    });
    return profile;
  }

  async suspend(publicId: string): Promise<IPrincipalProfile> {
    const profile = await PrincipalProfileModel.findOneAndUpdate(
      { publicId, isDeleted: false },
      { $set: { status: PrincipalStatus.SUSPENDED } },
      { new: true },
    ).lean();
    if (!profile) throw new NotFoundError('Principal profile');
    return profile;
  }

  async listActive(query: PaginationQuery): Promise<PaginatedResult<PrincipalWithUser>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter = { status: PrincipalStatus.ACTIVE, isDeleted: false };

    const [items, total] = await Promise.all([
      PrincipalProfileModel.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'userPublicId',
            foreignField: 'publicId',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            firstName: { $ifNull: ['$user.firstName', ''] },
            lastName: { $ifNull: ['$user.lastName', ''] },
            email: { $ifNull: ['$user.email', ''] },
          },
        },
        { $project: { user: 0 } },
      ]),
      PrincipalProfileModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async listPending(query: PaginationQuery): Promise<PaginatedResult<PrincipalWithUser>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter = { status: PrincipalStatus.PENDING_APPROVAL, isDeleted: false };

    const [items, total] = await Promise.all([
      PrincipalProfileModel.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'userPublicId',
            foreignField: 'publicId',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            firstName: { $ifNull: ['$user.firstName', ''] },
            lastName: { $ifNull: ['$user.lastName', ''] },
            email: { $ifNull: ['$user.email', ''] },
          },
        },
        { $project: { user: 0 } },
      ]),
      PrincipalProfileModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async listAll(query: PaginationQuery): Promise<PaginatedResult<PrincipalWithUser>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter = { isDeleted: false };

    const [items, total] = await Promise.all([
      PrincipalProfileModel.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'userPublicId',
            foreignField: 'publicId',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            firstName: { $ifNull: ['$user.firstName', ''] },
            lastName: { $ifNull: ['$user.lastName', ''] },
            email: { $ifNull: ['$user.email', ''] },
          },
        },
        { $project: { user: 0 } },
      ]),
      PrincipalProfileModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }
}

export const principalService = new PrincipalService();
