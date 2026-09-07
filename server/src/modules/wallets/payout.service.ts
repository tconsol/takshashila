import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { WalletModel } from './wallet.model';
import { WalletTransactionModel } from './wallet-transaction.model';
import { TransactionType, TransactionStatus } from './wallet.types';
import type { IWalletTransaction } from './wallet.types';
import { UserModel } from '../users/user.model';
import { auditService } from '../audit/audit.service';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { AppError, NotFoundError, ValidationError } from '../../utils/error';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import type { Role } from '../../constants/roles';

export interface PayoutActor {
  publicId: string;
  role: Role;
  ip?: string;
  userAgent?: string;
}

export interface RequestPayoutDto {
  amountCents: number;
  method?: string;
  destination?: string;
  note?: string;
}

/** Nobody should be able to request a payout smaller than it costs to process. */
const MIN_PAYOUT_CENTS = 10_00;

const invalid = (msg: string) => new ValidationError([msg], msg);

export class PayoutService {
  /**
   * Requesting a payout moves the money out of the wallet immediately and parks
   * the transaction in PENDING. Holding the funds up front is what stops a tutor
   * from spending the same earnings while an admin is still reviewing the
   * request; rejecting later credits it straight back.
   */
  async requestPayout(ownerPublicId: string, dto: RequestPayoutDto): Promise<IWalletTransaction> {
    const amountCents = Math.round(Number(dto.amountCents));
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      throw invalid('Payout amount must be a positive number');
    }
    if (amountCents < MIN_PAYOUT_CENTS) {
      throw invalid(`Minimum payout is $${(MIN_PAYOUT_CENTS / 100).toFixed(2)}`);
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const wallet = await WalletModel.findOne({ ownerPublicId, isDeleted: false }).session(session);
      if (!wallet) throw new NotFoundError('Wallet');
      if (wallet.isLocked) throw new AppError(`Wallet is locked: ${wallet.lockedReason}`, 403);

      // Only money the user actually earned is withdrawable — purchased, demo and
      // bonus credits are spendable on the platform but never cashable out.
      if (wallet.earnedCreditsCents < amountCents) {
        throw new AppError('Payout exceeds withdrawable earnings', 402);
      }
      if (wallet.balanceCents < amountCents) {
        throw new AppError('Insufficient balance', 402);
      }

      const pending = await WalletTransactionModel.countDocuments({
        ownerPublicId,
        type: TransactionType.PAYOUT,
        status: TransactionStatus.PENDING,
      }).session(session);
      if (pending > 0) {
        throw new AppError('You already have a payout awaiting review', 409);
      }

      const balanceBefore = wallet.balanceCents;
      const balanceAfter = balanceBefore - amountCents;

      await WalletModel.findByIdAndUpdate(
        wallet._id,
        { $inc: { balanceCents: -amountCents, earnedCreditsCents: -amountCents } },
        { session },
      );

      const [transaction] = await WalletTransactionModel.create(
        [{
          publicId: uuidv4(),
          idempotencyKey: `payout-request-${ownerPublicId}-${Date.now()}`,
          walletPublicId: wallet.publicId,
          ownerPublicId,
          type: TransactionType.PAYOUT,
          amountCents,
          balanceBeforeCents: balanceBefore,
          balanceAfterCents: balanceAfter,
          description: dto.note?.trim() || 'Payout request',
          referenceType: 'PAYOUT',
          metadata: {
            method: dto.method ?? 'BANK_TRANSFER',
            destination: dto.destination,
            requestedAt: new Date().toISOString(),
          },
          status: TransactionStatus.PENDING,
        }],
        { session },
      );

      await session.commitTransaction();
      domainEvents.emit(DomainEvent.PAYOUT_INITIATED, { ownerPublicId, amountCents });
      return transaction.toObject();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /** Admin queue — pending first, then most recent. */
  async listPayouts(
    filters: { status?: string; ownerPublicId?: string },
    query: PaginationQuery,
  ): Promise<PaginatedResult<IWalletTransaction & { ownerName: string; ownerEmail: string; ownerRole: string }>> {
    const { page, limit, skip } = parsePaginationQuery(query);

    const filter: Record<string, unknown> = { type: TransactionType.PAYOUT };
    if (filters.status) filter.status = filters.status;
    if (filters.ownerPublicId) filter.ownerPublicId = filters.ownerPublicId;

    const [items, total] = await Promise.all([
      WalletTransactionModel.find(filter)
        .sort({ status: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WalletTransactionModel.countDocuments(filter),
    ]);

    const hydrated = await this.hydrateOwners(items);
    return buildPaginatedResult(hydrated, total, page, limit);
  }

  async approvePayout(publicId: string, actor: PayoutActor, note?: string): Promise<IWalletTransaction> {
    const payout = await WalletTransactionModel.findOne({
      publicId,
      type: TransactionType.PAYOUT,
    }).lean();
    if (!payout) throw new NotFoundError('Payout');
    if (payout.status !== TransactionStatus.PENDING) {
      throw new AppError(`Payout is already ${payout.status.toLowerCase()}`, 409);
    }

    // The funds left the wallet when the request was made, so approving is purely
    // a state change — the money is settled out-of-band by finance.
    const updated = await WalletTransactionModel.findOneAndUpdate(
      { publicId, status: TransactionStatus.PENDING },
      {
        $set: {
          status: TransactionStatus.COMPLETED,
          'metadata.approvedBy': actor.publicId,
          'metadata.approvedAt': new Date().toISOString(),
          ...(note ? { 'metadata.approvalNote': note } : {}),
        },
      },
      { new: true },
    ).lean();
    if (!updated) throw new AppError('Payout was already processed', 409);

    await auditService.log({
      actorId: actor.publicId,
      actorRole: actor.role,
      action: 'PAYOUT_APPROVED',
      resourceType: 'WalletTransaction',
      resourceId: publicId,
      ip: actor.ip,
      userAgent: actor.userAgent,
      before: { status: payout.status },
      after: { status: TransactionStatus.COMPLETED, amountCents: payout.amountCents, note },
    });

    domainEvents.emit(DomainEvent.PAYOUT_COMPLETED, {
      ownerPublicId: payout.ownerPublicId,
      amountCents: payout.amountCents,
    });

    return updated;
  }

  /** Rejecting returns the held funds to the wallet in the same transaction. */
  async rejectPayout(publicId: string, actor: PayoutActor, reason?: string): Promise<IWalletTransaction> {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const payout = await WalletTransactionModel.findOne({
        publicId,
        type: TransactionType.PAYOUT,
      }).session(session);
      if (!payout) throw new NotFoundError('Payout');
      if (payout.status !== TransactionStatus.PENDING) {
        throw new AppError(`Payout is already ${payout.status.toLowerCase()}`, 409);
      }

      await WalletModel.updateOne(
        { ownerPublicId: payout.ownerPublicId, isDeleted: false },
        { $inc: { balanceCents: payout.amountCents, earnedCreditsCents: payout.amountCents } },
        { session },
      );

      payout.status = TransactionStatus.FAILED;
      payout.metadata = {
        ...(payout.metadata ?? {}),
        rejectedBy: actor.publicId,
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason,
      };
      await payout.save({ session });

      await session.commitTransaction();

      await auditService.log({
        actorId: actor.publicId,
        actorRole: actor.role,
        action: 'PAYOUT_REJECTED',
        resourceType: 'WalletTransaction',
        resourceId: publicId,
        ip: actor.ip,
        userAgent: actor.userAgent,
        before: { status: TransactionStatus.PENDING },
        after: { status: TransactionStatus.FAILED, amountCents: payout.amountCents, reason },
      });

      domainEvents.emit(DomainEvent.PAYOUT_FAILED, {
        ownerPublicId: payout.ownerPublicId,
        amountCents: payout.amountCents,
      });

      return payout.toObject();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /** Platform-wide ledger with the filters an admin actually reaches for. */
  async listTransactions(
    filters: {
      ownerPublicId?: string;
      type?: string;
      status?: string;
      from?: string;
      to?: string;
      minCents?: number;
    },
    query: PaginationQuery,
  ) {
    const { page, limit, skip } = parsePaginationQuery(query);

    const filter: Record<string, unknown> = {};
    if (filters.ownerPublicId) filter.ownerPublicId = filters.ownerPublicId;
    if (filters.type) filter.type = filters.type;
    if (filters.status) filter.status = filters.status;
    if (filters.minCents) filter.amountCents = { $gte: filters.minCents };

    const createdAt: Record<string, Date> = {};
    if (filters.from) createdAt.$gte = new Date(filters.from);
    if (filters.to) createdAt.$lte = new Date(filters.to);
    if (Object.keys(createdAt).length > 0) filter.createdAt = createdAt;

    const [items, total, totals] = await Promise.all([
      WalletTransactionModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WalletTransactionModel.countDocuments(filter),
      WalletTransactionModel.aggregate([
        { $match: filter },
        { $group: { _id: '$type', totalCents: { $sum: '$amountCents' }, count: { $sum: 1 } } },
        { $sort: { totalCents: -1 } },
      ]),
    ]);

    const hydrated = await this.hydrateOwners(items);
    return {
      ...buildPaginatedResult(hydrated, total, page, limit),
      totalsByType: totals.map((t: { _id: string; totalCents: number; count: number }) => ({
        type: t._id,
        totalCents: t.totalCents,
        count: t.count,
      })),
    };
  }

  /** Ledger rows store only an owner id; the UI needs a name to be usable. */
  private async hydrateOwners<T extends { ownerPublicId: string }>(rows: T[]) {
    if (rows.length === 0) return [] as (T & { ownerName: string; ownerEmail: string; ownerRole: string })[];

    const ownerIds = [...new Set(rows.map((r) => r.ownerPublicId))];
    const users = await UserModel.find(
      { publicId: { $in: ownerIds } },
      { publicId: 1, firstName: 1, lastName: 1, email: 1, role: 1 },
    ).lean();
    const byId = new Map(users.map((u) => [u.publicId, u]));

    return rows.map((r) => {
      const u = byId.get(r.ownerPublicId);
      return {
        ...r,
        ownerName: u ? `${u.firstName} ${u.lastName}` : 'Unknown',
        ownerEmail: u?.email ?? '',
        ownerRole: u?.role ?? '',
      };
    });
  }
}

export const payoutService = new PayoutService();
