import { v4 as uuidv4 } from 'uuid';
import { PrincipalProfileModel } from './principal.model';
import { PrincipalStatus } from './principal.types';
import type { IPrincipalProfile } from './principal.types';
import { NotFoundError, ConflictError } from '../../utils/error';
import { domainEvents } from '../../events/event-emitter';
import { walletService } from '../wallets/wallet.service';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';

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
    domainEvents.emit('PRINCIPAL_APPROVED', { principalPublicId: publicId, approvedBy });
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

  async listPending(query: PaginationQuery): Promise<PaginatedResult<IPrincipalProfile>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter = { status: PrincipalStatus.PENDING_APPROVAL, isDeleted: false };

    const [items, total] = await Promise.all([
      PrincipalProfileModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PrincipalProfileModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async listAll(query: PaginationQuery): Promise<PaginatedResult<IPrincipalProfile>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter = { isDeleted: false };

    const [items, total] = await Promise.all([
      PrincipalProfileModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PrincipalProfileModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }
}

export const principalService = new PrincipalService();
