import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { WalletModel } from './wallet.model';
import { WalletTransactionModel } from './wallet-transaction.model';
import {
  TransactionType,
  TransactionStatus,
  CreditType,
} from './wallet.types';
import type {
  IWallet,
  IWalletTransaction,
  CreditWalletDto,
  DebitWalletDto,
} from './wallet.types';
import { AppError, NotFoundError, ConflictError } from '../../utils/error';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';

const DEMO_INITIAL_CREDITS_CENTS = 300_00;

export class WalletService {
  async createWallet(ownerPublicId: string): Promise<IWallet> {
    const existing = await WalletModel.findOne({ ownerPublicId });
    if (existing) throw new ConflictError('Wallet already exists for this user');

    const wallet = await WalletModel.create({ ownerPublicId });
    return wallet.toObject();
  }

  async getOrCreateWallet(ownerPublicId: string): Promise<IWallet> {
    const wallet = await WalletModel.findOne({ ownerPublicId, isDeleted: false });
    if (wallet) return wallet.toObject();
    const created = await WalletModel.create({ ownerPublicId });
    return created.toObject();
  }

  async getWallet(ownerPublicId: string): Promise<IWallet> {
    return this.getOrCreateWallet(ownerPublicId);
  }

  async creditWallet(dto: CreditWalletDto): Promise<IWalletTransaction> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const existing = await WalletTransactionModel.findOne({
        idempotencyKey: dto.idempotencyKey,
      }).session(session);

      if (existing) {
        await session.abortTransaction();
        return existing.toObject();
      }

      const wallet = await WalletModel.findOne({
        ownerPublicId: dto.ownerPublicId,
        isDeleted: false,
      }).session(session);

      if (!wallet) throw new NotFoundError('Wallet');
      if (wallet.isLocked) throw new AppError(`Wallet is locked: ${wallet.lockedReason}`, 403);

      const balanceBefore = wallet.balanceCents;
      const balanceAfter = balanceBefore + dto.amountCents;

      const creditField = this.getCreditField(dto.creditType);

      const incFields: Record<string, number> = {
        balanceCents: dto.amountCents,
        [creditField]: dto.amountCents,
      };
      if (dto.creditType === CreditType.EARNED_CREDITS) {
        incFields.totalEarnedCents = dto.amountCents;
      }

      await WalletModel.findByIdAndUpdate(
        wallet._id,
        { $inc: incFields },
        { session },
      );

      const transaction = await WalletTransactionModel.create(
        [
          {
            publicId: uuidv4(),
            idempotencyKey: dto.idempotencyKey,
            walletPublicId: wallet.publicId,
            ownerPublicId: dto.ownerPublicId,
            type: TransactionType.CREDIT,
            creditType: dto.creditType,
            amountCents: dto.amountCents,
            balanceBeforeCents: balanceBefore,
            balanceAfterCents: balanceAfter,
            description: dto.description,
            referenceId: dto.referenceId,
            referenceType: dto.referenceType,
            metadata: dto.metadata,
            status: TransactionStatus.COMPLETED,
          },
        ],
        { session },
      );

      await session.commitTransaction();

      domainEvents.emit(DomainEvent.CREDITS_ADDED, {
        ownerPublicId: dto.ownerPublicId,
        amountCents: dto.amountCents,
        creditType: dto.creditType,
      });

      return transaction[0].toObject();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async debitWallet(dto: DebitWalletDto): Promise<IWalletTransaction> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const existing = await WalletTransactionModel.findOne({
        idempotencyKey: dto.idempotencyKey,
      }).session(session);

      if (existing) {
        await session.abortTransaction();
        return existing.toObject();
      }

      const wallet = await WalletModel.findOne({
        ownerPublicId: dto.ownerPublicId,
        isDeleted: false,
      }).session(session);

      if (!wallet) throw new NotFoundError('Wallet');
      if (wallet.isLocked) throw new AppError(`Wallet is locked: ${wallet.lockedReason}`, 403);
      if (wallet.balanceCents < dto.amountCents) {
        throw new AppError('Insufficient credits', 402);
      }

      const balanceBefore = wallet.balanceCents;
      const balanceAfter = balanceBefore - dto.amountCents;

      await WalletModel.findByIdAndUpdate(
        wallet._id,
        {
          $inc: {
            balanceCents: -dto.amountCents,
            totalSpentCents: dto.amountCents,
          },
        },
        { session },
      );

      const transaction = await WalletTransactionModel.create(
        [
          {
            publicId: uuidv4(),
            idempotencyKey: dto.idempotencyKey,
            walletPublicId: wallet.publicId,
            ownerPublicId: dto.ownerPublicId,
            type: TransactionType.DEBIT,
            amountCents: dto.amountCents,
            balanceBeforeCents: balanceBefore,
            balanceAfterCents: balanceAfter,
            description: dto.description,
            referenceId: dto.referenceId,
            referenceType: dto.referenceType,
            metadata: dto.metadata,
            status: TransactionStatus.COMPLETED,
          },
        ],
        { session },
      );

      await session.commitTransaction();

      domainEvents.emit(DomainEvent.CREDITS_DEDUCTED, {
        ownerPublicId: dto.ownerPublicId,
        amountCents: dto.amountCents,
      });

      return transaction[0].toObject();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getTransactionHistory(
    ownerPublicId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<IWalletTransaction>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter = { ownerPublicId };

    const [items, total] = await Promise.all([
      WalletTransactionModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WalletTransactionModel.countDocuments(filter),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  }

  async initializeDemoCredits(ownerPublicId: string): Promise<void> {
    const wallet = await WalletModel.findOne({ ownerPublicId });
    if (!wallet) {
      await this.createWallet(ownerPublicId);
    }

    await this.creditWallet({
      ownerPublicId,
      amountCents: DEMO_INITIAL_CREDITS_CENTS,
      creditType: CreditType.DEMO_CREDITS,
      description: 'Welcome demo credits',
      idempotencyKey: `demo-init-${ownerPublicId}`,
    });
  }

  private getCreditField(creditType: CreditType): string {
    const map: Record<CreditType, string> = {
      DEMO_CREDITS: 'demoCreditsCents',
      PURCHASED_CREDITS: 'purchasedCreditsCents',
      BONUS_CREDITS: 'bonusCreditsCents',
      EARNED_CREDITS: 'earnedCreditsCents',
    };
    return map[creditType];
  }
}

export const walletService = new WalletService();
