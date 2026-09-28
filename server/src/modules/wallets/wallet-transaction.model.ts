import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { TransactionType, TransactionStatus, CreditType } from './wallet.types';
import type { IWalletTransaction } from './wallet.types';

const walletTransactionSchema = new Schema<IWalletTransaction>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    walletPublicId: { type: String, required: true, index: true },
    ownerPublicId: { type: String, required: true, index: true },
    type: { type: String, enum: Object.values(TransactionType), required: true },
    creditType: { type: String, enum: Object.values(CreditType) },
    amountCents: { type: Number, required: true },
    balanceBeforeCents: { type: Number, required: true },
    balanceAfterCents: { type: Number, required: true },
    description: { type: String, required: true },
    referenceId: { type: String, index: true },
    referenceType: { type: String },
    metadata: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.COMPLETED,
    },
    reversedTransactionId: { type: String },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

walletTransactionSchema.index({ ownerPublicId: 1, createdAt: -1 });
walletTransactionSchema.index({ walletPublicId: 1, type: 1 });
// DB-level backstop for "only one payout request pending review at a time":
// the app-level countDocuments check in payout.service.ts is a read, not a
// lock, so two near-simultaneous requests could both pass it. This index
// makes a second concurrent PENDING payout for the same owner fail to insert.
walletTransactionSchema.index(
  { ownerPublicId: 1, type: 1, status: 1 },
  { unique: true, partialFilterExpression: { type: TransactionType.PAYOUT, status: TransactionStatus.PENDING } },
);

export const WalletTransactionModel = mongoose.model<IWalletTransaction>(
  'WalletTransaction',
  walletTransactionSchema,
);
