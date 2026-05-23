export const CreditType = {
  DEMO_CREDITS: 'DEMO_CREDITS',
  PURCHASED_CREDITS: 'PURCHASED_CREDITS',
  BONUS_CREDITS: 'BONUS_CREDITS',
  EARNED_CREDITS: 'EARNED_CREDITS',
} as const;
export type CreditType = (typeof CreditType)[keyof typeof CreditType];

export const TransactionType = {
  CREDIT: 'CREDIT',
  DEBIT: 'DEBIT',
  REFUND: 'REFUND',
  REVERSAL: 'REVERSAL',
  COMMISSION: 'COMMISSION',
  PAYOUT: 'PAYOUT',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const TransactionStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REVERSED: 'REVERSED',
} as const;
export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

export interface IWallet {
  _id: string;
  publicId: string;
  ownerPublicId: string;
  balanceCents: number;
  demoCreditsCents: number;
  purchasedCreditsCents: number;
  bonusCreditsCents: number;
  earnedCreditsCents: number;
  totalEarnedCents: number;
  totalSpentCents: number;
  currency: string;
  isLocked: boolean;
  lockedReason?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWalletTransaction {
  _id: string;
  publicId: string;
  idempotencyKey: string;
  walletPublicId: string;
  ownerPublicId: string;
  type: TransactionType;
  creditType?: CreditType;
  amountCents: number;
  balanceBeforeCents: number;
  balanceAfterCents: number;
  description: string;
  referenceId?: string;
  referenceType?: string;
  metadata?: Record<string, unknown>;
  status: TransactionStatus;
  reversedTransactionId?: string;
  createdAt: Date;
}

export interface CreditWalletDto {
  ownerPublicId: string;
  amountCents: number;
  creditType: CreditType;
  description: string;
  idempotencyKey: string;
  referenceId?: string;
  referenceType?: string;
  metadata?: Record<string, unknown>;
}

export interface DebitWalletDto {
  ownerPublicId: string;
  amountCents: number;
  description: string;
  idempotencyKey: string;
  referenceId?: string;
  referenceType?: string;
  metadata?: Record<string, unknown>;
}
