import { api } from '../lib/axios';

export interface Payout {
  publicId: string;
  ownerPublicId: string;
  ownerName: string;
  ownerEmail: string;
  ownerRole: string;
  amountCents: number;
  description: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface LedgerEntry {
  publicId: string;
  ownerPublicId: string;
  ownerName: string;
  ownerEmail: string;
  ownerRole: string;
  type: string;
  creditType?: string;
  amountCents: number;
  balanceBeforeCents: number;
  balanceAfterCents: number;
  description: string;
  referenceType?: string;
  referenceId?: string;
  status: string;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface LedgerPage extends Paginated<LedgerEntry> {
  totalsByType: { type: string; totalCents: number; count: number }[];
}

export interface RefundableClass {
  publicId: string;
  title: string;
  status: string;
  startUTC: string;
  costCents: number;
  durationMinutes: number;
  isRefunded: boolean;
  tutorName: string;
  studentName: string;
}

export interface LedgerFilters {
  page?: number;
  limit?: number;
  ownerPublicId?: string;
  type?: string;
  status?: string;
  from?: string;
  to?: string;
}

function toParams(filters: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  return params.toString();
}

export const financeService = {
  listPayouts: (status: string, page = 1): Promise<Paginated<Payout>> =>
    api.get(`/wallets/payouts?${toParams({ status, page, limit: 20 })}`).then((r) => r.data.data),

  approvePayout: (publicId: string, note?: string): Promise<Payout> =>
    api.post(`/wallets/payouts/${publicId}/approve`, { note }).then((r) => r.data.data),

  rejectPayout: (publicId: string, reason?: string): Promise<Payout> =>
    api.post(`/wallets/payouts/${publicId}/reject`, { reason }).then((r) => r.data.data),

  requestPayout: (amountCents: number, note?: string): Promise<Payout> =>
    api.post('/wallets/me/payouts', { amountCents, note }).then((r) => r.data.data),

  listLedger: (filters: LedgerFilters): Promise<LedgerPage> =>
    api.get(`/wallets/transactions?${toParams({ ...filters, limit: filters.limit ?? 20 })}`)
      .then((r) => r.data.data),

  listRefundable: (page = 1): Promise<Paginated<RefundableClass>> =>
    api.get(`/classes/admin/list?${toParams({ refundable: true, page, limit: 20 })}`)
      .then((r) => r.data.data),

  refundClass: (classPublicId: string, reason: string): Promise<void> =>
    api.post(`/classes/${classPublicId}/refund`, { reason }).then(() => undefined),
};
