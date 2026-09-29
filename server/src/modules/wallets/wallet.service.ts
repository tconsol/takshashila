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
import { settingsService } from '../settings/settings.service';

/** Fallback only — initializeDemoCredits normally reads the live figure from
 *  platform settings (demoCreditCents) so an admin's configured value is what
 *  new users actually get. */
const DEMO_INITIAL_CREDITS_CENTS = 100_00;

/**
 * What a wallet can spend on anything other than a demo class. Free demo
 * credits sit inside balanceCents but are only spendable on demo classes, so
 * they are excluded here. Without this, a student could spend free credits on
 * a paid class and the tutor would earn withdrawable money from them.
 */
export function spendableCents(wallet: { balanceCents: number; demoCreditsCents?: number }): number {
  return Math.max(0, wallet.balanceCents - Math.max(0, wallet.demoCreditsCents ?? 0));
}

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
      // `allowNegative` is for penalties the user cannot opt out of by being
      // broke — a cancellation fee has to land or it isn't a deterrent.
      if (!dto.allowNegative) {
        const available = dto.bucketField ? wallet.balanceCents : spendableCents(wallet);
        if (available < dto.amountCents) {
          throw new AppError('Insufficient credits', 402);
        }
      }
      // A bucket debit must also fit within that specific bucket — otherwise
      // e.g. a demo-class charge can push demoCreditsCents negative just
      // because the wallet has *other* funds covering the total balance.
      if (dto.bucketField && (wallet[dto.bucketField] ?? 0) < dto.amountCents) {
        throw new AppError('Insufficient credits', 402);
      }

      const balanceBefore = wallet.balanceCents;
      const balanceAfter = balanceBefore - dto.amountCents;

      const incFields: Record<string, number> = {
        balanceCents: -dto.amountCents,
        totalSpentCents: dto.amountCents,
      };
      // Optionally draw down a specific sub-bucket (e.g. demo credits).
      if (dto.bucketField) {
        incFields[dto.bucketField] = -dto.amountCents;
      }

      await WalletModel.findByIdAndUpdate(wallet._id, { $inc: incFields }, { session });

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

  /** Refund money back into a wallet (e.g. a charged class was reversed). */
  async refundWallet(dto: DebitWalletDto): Promise<IWalletTransaction> {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const existing = await WalletTransactionModel.findOne({ idempotencyKey: dto.idempotencyKey }).session(session);
      if (existing) { await session.abortTransaction(); return existing.toObject(); }

      const wallet = await WalletModel.findOne({ ownerPublicId: dto.ownerPublicId, isDeleted: false }).session(session);
      if (!wallet) throw new NotFoundError('Wallet');

      const balanceBefore = wallet.balanceCents;
      const balanceAfter = balanceBefore + dto.amountCents;

      await WalletModel.findByIdAndUpdate(
        wallet._id,
        { $inc: { balanceCents: dto.amountCents, totalSpentCents: -dto.amountCents } },
        { session },
      );

      const tx = await WalletTransactionModel.create([{
        publicId: uuidv4(),
        idempotencyKey: dto.idempotencyKey,
        walletPublicId: wallet.publicId,
        ownerPublicId: dto.ownerPublicId,
        type: TransactionType.REFUND,
        amountCents: dto.amountCents,
        balanceBeforeCents: balanceBefore,
        balanceAfterCents: balanceAfter,
        description: dto.description,
        referenceId: dto.referenceId,
        referenceType: dto.referenceType,
        metadata: dto.metadata,
        status: TransactionStatus.COMPLETED,
      }], { session });

      await session.commitTransaction();
      domainEvents.emit(DomainEvent.CREDITS_ADDED, {
        ownerPublicId: dto.ownerPublicId,
        amountCents: dto.amountCents,
        creditType: CreditType.PURCHASED_CREDITS,
      });
      return tx[0].toObject();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /** Reverse a credit out of a wallet (e.g. claw back tutor earnings on refund). */
  async reverseWallet(dto: DebitWalletDto): Promise<IWalletTransaction> {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const existing = await WalletTransactionModel.findOne({ idempotencyKey: dto.idempotencyKey }).session(session);
      if (existing) { await session.abortTransaction(); return existing.toObject(); }

      const wallet = await WalletModel.findOne({ ownerPublicId: dto.ownerPublicId, isDeleted: false }).session(session);
      if (!wallet) throw new NotFoundError('Wallet');
      if (wallet.balanceCents < dto.amountCents) {
        throw new AppError('Insufficient balance to reverse', 402);
      }

      const balanceBefore = wallet.balanceCents;
      const balanceAfter = balanceBefore - dto.amountCents;

      await WalletModel.findByIdAndUpdate(
        wallet._id,
        { $inc: { balanceCents: -dto.amountCents, earnedCreditsCents: -dto.amountCents, totalEarnedCents: -dto.amountCents } },
        { session },
      );

      const tx = await WalletTransactionModel.create([{
        publicId: uuidv4(),
        idempotencyKey: dto.idempotencyKey,
        walletPublicId: wallet.publicId,
        ownerPublicId: dto.ownerPublicId,
        type: TransactionType.REVERSAL,
        amountCents: dto.amountCents,
        balanceBeforeCents: balanceBefore,
        balanceAfterCents: balanceAfter,
        description: dto.description,
        referenceId: dto.referenceId,
        referenceType: dto.referenceType,
        metadata: dto.metadata,
        status: TransactionStatus.COMPLETED,
      }], { session });

      await session.commitTransaction();
      domainEvents.emit(DomainEvent.CREDITS_DEDUCTED, {
        ownerPublicId: dto.ownerPublicId,
        amountCents: dto.amountCents,
      });
      return tx[0].toObject();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Debit one wallet and credit another as a single all-or-nothing operation.
   * Unlike calling debitWallet()+creditWallet() back to back (each opens its
   * own transaction), a failure on either side rolls back both — there is no
   * state where the payer was charged but the payee was never paid.
   */
  async transferWallet(dto: {
    fromOwnerPublicId: string;
    toOwnerPublicId: string;
    /** What leaves the payer's wallet. */
    debitAmountCents: number;
    /** What lands in the payee's wallet. May be less than debitAmountCents —
     *  the platform keeps the difference (e.g. its fee) without it going
     *  anywhere else. */
    creditAmountCents: number;
    debitDescription: string;
    creditDescription: string;
    creditType: CreditType;
    debitIdempotencyKey: string;
    creditIdempotencyKey: string;
    referenceId?: string;
    referenceType?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ debit: IWalletTransaction; credit: IWalletTransaction }> {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const existingDebit = await WalletTransactionModel.findOne({
        idempotencyKey: dto.debitIdempotencyKey,
      }).session(session);
      const existingCredit = await WalletTransactionModel.findOne({
        idempotencyKey: dto.creditIdempotencyKey,
      }).session(session);
      if (existingDebit && existingCredit) {
        await session.abortTransaction();
        return { debit: existingDebit.toObject(), credit: existingCredit.toObject() };
      }

      const fromWallet = await WalletModel.findOne({
        ownerPublicId: dto.fromOwnerPublicId,
        isDeleted: false,
      }).session(session);
      if (!fromWallet) throw new NotFoundError('Wallet');
      if (fromWallet.isLocked) throw new AppError(`Wallet is locked: ${fromWallet.lockedReason}`, 403);
      if (spendableCents(fromWallet) < dto.debitAmountCents) {
        throw new AppError('Insufficient credits', 402);
      }

      const toWallet = await WalletModel.findOne({
        ownerPublicId: dto.toOwnerPublicId,
        isDeleted: false,
      }).session(session);
      if (!toWallet) throw new NotFoundError('Wallet');
      if (toWallet.isLocked) throw new AppError(`Wallet is locked: ${toWallet.lockedReason}`, 403);

      const fromBalanceBefore = fromWallet.balanceCents;
      const fromBalanceAfter = fromBalanceBefore - dto.debitAmountCents;
      await WalletModel.findByIdAndUpdate(
        fromWallet._id,
        { $inc: { balanceCents: -dto.debitAmountCents, totalSpentCents: dto.debitAmountCents } },
        { session },
      );

      const toBalanceBefore = toWallet.balanceCents;
      const toBalanceAfter = toBalanceBefore + dto.creditAmountCents;
      const creditField = this.getCreditField(dto.creditType);
      const toIncFields: Record<string, number> = {
        balanceCents: dto.creditAmountCents,
        [creditField]: dto.creditAmountCents,
      };
      if (dto.creditType === CreditType.EARNED_CREDITS) {
        toIncFields.totalEarnedCents = dto.creditAmountCents;
      }
      await WalletModel.findByIdAndUpdate(toWallet._id, { $inc: toIncFields }, { session });

      const [debitTx] = await WalletTransactionModel.create(
        [
          {
            publicId: uuidv4(),
            idempotencyKey: dto.debitIdempotencyKey,
            walletPublicId: fromWallet.publicId,
            ownerPublicId: dto.fromOwnerPublicId,
            type: TransactionType.DEBIT,
            amountCents: dto.debitAmountCents,
            balanceBeforeCents: fromBalanceBefore,
            balanceAfterCents: fromBalanceAfter,
            description: dto.debitDescription,
            referenceId: dto.referenceId,
            referenceType: dto.referenceType,
            metadata: dto.metadata,
            status: TransactionStatus.COMPLETED,
          },
        ],
        { session },
      );

      const [creditTx] = await WalletTransactionModel.create(
        [
          {
            publicId: uuidv4(),
            idempotencyKey: dto.creditIdempotencyKey,
            walletPublicId: toWallet.publicId,
            ownerPublicId: dto.toOwnerPublicId,
            type: TransactionType.CREDIT,
            creditType: dto.creditType,
            amountCents: dto.creditAmountCents,
            balanceBeforeCents: toBalanceBefore,
            balanceAfterCents: toBalanceAfter,
            description: dto.creditDescription,
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
        ownerPublicId: dto.fromOwnerPublicId,
        amountCents: dto.debitAmountCents,
      });
      domainEvents.emit(DomainEvent.CREDITS_ADDED, {
        ownerPublicId: dto.toOwnerPublicId,
        amountCents: dto.creditAmountCents,
        creditType: dto.creditType,
      });

      return { debit: debitTx.toObject(), credit: creditTx.toObject() };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Run `fn` inside a Mongo transaction that first WRITES to the owner's
   * wallet ($inc bookingSeq). That write takes a document lock, so two
   * concurrent callers for the same wallet cannot both read the balance and
   * pass a check: the loser gets a WriteConflict and withTransaction retries
   * it from the top, where it sees the winner's committed rows. Used by
   * bookClass so parallel bookings for one student serialize.
   */
  async runWithBookingLock<T>(
    ownerPublicId: string,
    fn: (ctx: { session: mongoose.ClientSession; wallet: IWallet }) => Promise<T>,
  ): Promise<T> {
    const session = await mongoose.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        const wallet = await WalletModel.findOneAndUpdate(
          { ownerPublicId, isDeleted: false },
          { $inc: { bookingSeq: 1 } },
          { new: true, session },
        ).lean();
        if (!wallet) throw new NotFoundError('Wallet');
        result = await fn({ session, wallet: wallet as unknown as IWallet });
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Refund the student and claw back the tutor's earning as ONE transaction
   * (same guarantees as transferWallet). Each leg keeps its own idempotency
   * key and is skipped if already recorded, so a retry is safe.
   * If the tutor cannot cover the full clawback (or has no wallet) the
   * clawback is skipped entirely, never partially applied, while the student
   * is still refunded in full; `clawbackSkipped` lets the caller log it.
   */
  async refundWithClawback(dto: {
    studentOwnerPublicId: string;
    tutorOwnerPublicId: string;
    refundAmountCents: number;
    clawbackAmountCents: number;
    refundDescription: string;
    clawbackDescription: string;
    refundIdempotencyKey: string;
    clawbackIdempotencyKey: string;
    referenceId?: string;
    referenceType?: string;
  }): Promise<{ refund: IWalletTransaction; reversal?: IWalletTransaction; clawbackSkipped: boolean }> {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const existingRefund = await WalletTransactionModel.findOne({ idempotencyKey: dto.refundIdempotencyKey }).session(session);
      const existingReversal = dto.clawbackAmountCents > 0
        ? await WalletTransactionModel.findOne({ idempotencyKey: dto.clawbackIdempotencyKey }).session(session)
        : null;

      let refundTx: IWalletTransaction | undefined = existingRefund?.toObject();
      let reversalTx: IWalletTransaction | undefined = existingReversal?.toObject();
      let clawbackSkipped = false;
      const events: Array<() => void> = [];

      if (!existingRefund) {
        const wallet = await WalletModel.findOne({ ownerPublicId: dto.studentOwnerPublicId, isDeleted: false }).session(session);
        if (!wallet) throw new NotFoundError('Wallet');
        const before = wallet.balanceCents;
        await WalletModel.findByIdAndUpdate(
          wallet._id,
          { $inc: { balanceCents: dto.refundAmountCents, totalSpentCents: -dto.refundAmountCents } },
          { session },
        );
        const [tx] = await WalletTransactionModel.create([{
          publicId: uuidv4(),
          idempotencyKey: dto.refundIdempotencyKey,
          walletPublicId: wallet.publicId,
          ownerPublicId: dto.studentOwnerPublicId,
          type: TransactionType.REFUND,
          amountCents: dto.refundAmountCents,
          balanceBeforeCents: before,
          balanceAfterCents: before + dto.refundAmountCents,
          description: dto.refundDescription,
          referenceId: dto.referenceId,
          referenceType: dto.referenceType,
          status: TransactionStatus.COMPLETED,
        }], { session });
        refundTx = tx.toObject();
        events.push(() => domainEvents.emit(DomainEvent.CREDITS_ADDED, {
          ownerPublicId: dto.studentOwnerPublicId,
          amountCents: dto.refundAmountCents,
          creditType: CreditType.PURCHASED_CREDITS,
        }));
      }

      if (dto.clawbackAmountCents > 0 && !existingReversal) {
        const tWallet = await WalletModel.findOne({ ownerPublicId: dto.tutorOwnerPublicId, isDeleted: false }).session(session);
        if (!tWallet || tWallet.balanceCents < dto.clawbackAmountCents) {
          clawbackSkipped = true;
        } else {
          const before = tWallet.balanceCents;
          await WalletModel.findByIdAndUpdate(
            tWallet._id,
            { $inc: { balanceCents: -dto.clawbackAmountCents, earnedCreditsCents: -dto.clawbackAmountCents, totalEarnedCents: -dto.clawbackAmountCents } },
            { session },
          );
          const [tx] = await WalletTransactionModel.create([{
            publicId: uuidv4(),
            idempotencyKey: dto.clawbackIdempotencyKey,
            walletPublicId: tWallet.publicId,
            ownerPublicId: dto.tutorOwnerPublicId,
            type: TransactionType.REVERSAL,
            amountCents: dto.clawbackAmountCents,
            balanceBeforeCents: before,
            balanceAfterCents: before - dto.clawbackAmountCents,
            description: dto.clawbackDescription,
            referenceId: dto.referenceId,
            referenceType: dto.referenceType,
            status: TransactionStatus.COMPLETED,
          }], { session });
          reversalTx = tx.toObject();
          events.push(() => domainEvents.emit(DomainEvent.CREDITS_DEDUCTED, {
            ownerPublicId: dto.tutorOwnerPublicId,
            amountCents: dto.clawbackAmountCents,
          }));
        }
      }

      await session.commitTransaction();
      events.forEach((e) => e());
      return { refund: refundTx as IWalletTransaction, reversal: reversalTx, clawbackSkipped };
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

    const settings = await settingsService.get();
    const amountCents = settings.demoCreditCents ?? DEMO_INITIAL_CREDITS_CENTS;

    await this.creditWallet({
      ownerPublicId,
      amountCents,
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
