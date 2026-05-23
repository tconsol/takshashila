import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import type { IWallet } from './wallet.types';

const walletSchema = new Schema<IWallet>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    ownerPublicId: { type: String, required: true, unique: true, index: true },
    balanceCents: { type: Number, required: true, default: 0, min: 0 },
    demoCreditsCents: { type: Number, default: 0, min: 0 },
    purchasedCreditsCents: { type: Number, default: 0, min: 0 },
    bonusCreditsCents: { type: Number, default: 0, min: 0 },
    earnedCreditsCents: { type: Number, default: 0, min: 0 },
    totalEarnedCents: { type: Number, default: 0, min: 0 },
    totalSpentCents: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USD' },
    isLocked: { type: Boolean, default: false },
    lockedReason: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const WalletModel = mongoose.model<IWallet>('Wallet', walletSchema);
