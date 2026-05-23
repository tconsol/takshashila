import { api } from '../lib/api';
import type { WalletInfo, PaginatedTransactions, LedgerEntry } from '../types/api.types';

export const walletService = {
  getMyWallet: (): Promise<WalletInfo> =>
    api.get('/wallets/me').then((r) => {
      const d = r.data?.data ?? {};
      return {
        publicId: d.publicId ?? '',
        balanceCents: d.balanceCents ?? 0,
        demoCreditsCents: d.demoCreditsCents ?? 0,
        regularCreditsCents: d.regularCreditsCents ?? 0,
        bonusCreditsCents: d.bonusCreditsCents ?? 0,
        currency: d.currency ?? 'INR',
      };
    }),

  getTransactions: (params?: { limit?: string; page?: string }): Promise<PaginatedTransactions> =>
    api.get('/wallets/me/transactions', { params }).then((r) => {
      const d = r.data?.data;
      const items: LedgerEntry[] = Array.isArray(d) ? d : (d?.items ?? []);
      return {
        items, total: d?.total ?? items.length, page: d?.page ?? 1,
        limit: d?.limit ?? items.length, totalPages: d?.totalPages ?? 1,
      };
    }),
};
