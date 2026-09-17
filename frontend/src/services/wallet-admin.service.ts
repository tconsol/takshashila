import { api } from '../lib/axios';

export type CreditType = 'DEMO_CREDITS' | 'PURCHASED_CREDITS' | 'BONUS_CREDITS' | 'EARNED_CREDITS';

export interface WalletTransaction {
  publicId: string;
  amountCents: number;
  creditType?: CreditType;
  description: string;
  balanceAfterCents: number;
}

export interface GrantCreditsPayload {
  amountCents: number;
  creditType: CreditType;
  reason: string;
}

export interface DeductCreditsPayload {
  amountCents: number;
  reason: string;
}

/** Super-admin-only manual wallet adjustments — see server wallet-admin.service.ts. */
export const walletAdminService = {
  grant: (userPublicId: string, payload: GrantCreditsPayload): Promise<WalletTransaction> =>
    api.post(`/wallets/${userPublicId}/credit`, payload).then((r) => r.data.data),

  deduct: (userPublicId: string, payload: DeductCreditsPayload): Promise<WalletTransaction> =>
    api.post(`/wallets/${userPublicId}/debit`, payload).then((r) => r.data.data),
};
