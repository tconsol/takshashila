import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Coins, TrendingUp, Gift, BookOpen, Star, Plus, Banknote } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatsCard } from '../../components/shared/StatsCard';
import { PayoutRequestModal } from '../../components/shared/PayoutRequestModal';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TopUpModal } from '../../features/payments/TopUpModal';
import { formatCredits } from '../../lib/billing';
import { api } from '../../lib/axios';

interface WalletData {
  publicId: string;
  balanceCents: number;
  demoCreditsCents: number;
  purchasedCreditsCents: number;
  bonusCreditsCents: number;
  earnedCreditsCents: number;
  earningsCents?: number;
  totalEarnedCents?: number;
  totalSpentCents?: number;
}

interface WalletTransaction {
  publicId: string;
  type: string;
  creditType: string;
  amountCents: number;
  description: string;
  balanceAfterCents: number;
  createdAt: string;
}

interface PaginatedTransactions {
  items: WalletTransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type TxVariant = 'success' | 'danger' | 'default';

const txTypeVariant: Record<string, TxVariant> = {
  CREDIT: 'success',
  DEBIT: 'danger',
  REFUND: 'success',
};

function centsToDisplay(cents: number): string {
  return `${formatCredits(cents)} cr`;
}

interface WalletPageProps {
  title?: string;
  subtitle?: string;
  showEarnings?: boolean;
  /** Allow buying credits. Off for roles that only earn (e.g. tutors). */
  allowTopUp?: boolean;
  /** Allow withdrawing earnings. On for the roles that can be paid out. */
  allowPayout?: boolean;
}

export function WalletPage({
  title = 'Wallet',
  subtitle = 'Balance and transaction history',
  showEarnings = false,
  allowTopUp = true,
  allowPayout = false,
}: WalletPageProps) {
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const { data: wallet, isLoading: walletLoading } = useQuery<WalletData>({
    queryKey: ['wallet', 'me'],
    queryFn: () => api.get('/wallets/me').then((r) => r.data.data),
  });

  const { data: txData, isLoading: txLoading } = useQuery<PaginatedTransactions>({
    queryKey: ['wallet', 'transactions'],
    queryFn: () => api.get('/wallets/me/transactions').then((r) => r.data.data),
  });

  const transactions = txData?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex gap-2">
            {allowPayout && (
              <Button variant="outline" onClick={() => setPayoutOpen(true)}>
                <Banknote className="h-4 w-4" /> Request Payout
              </Button>
            )}
            {allowTopUp && (
              <Button variant="gradient" onClick={() => setTopUpOpen(true)}>
                <Plus className="h-4 w-4" /> Add Credits
              </Button>
            )}
          </div>
        }
      />
      {allowTopUp && <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />}
      {allowPayout && (
        <PayoutRequestModal
          open={payoutOpen}
          onClose={() => setPayoutOpen(false)}
          withdrawableCents={wallet?.earnedCreditsCents ?? 0}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Balance"
          value={walletLoading ? '' : centsToDisplay(wallet?.balanceCents ?? 0)}
          icon={<Coins className="h-5 w-5 text-brand-600" />}
        />
        {showEarnings ? (
          <StatsCard
            title="Total Earnings"
            value={walletLoading ? '' : centsToDisplay(wallet?.earnedCreditsCents ?? wallet?.earningsCents ?? 0)}
            icon={<TrendingUp className="h-5 w-5 text-green-600" />}
            iconBg="bg-green-50 dark:bg-green-900/20"
          />
        ) : (
          <StatsCard
            title="Demo Credits"
            value={walletLoading ? '' : centsToDisplay(wallet?.demoCreditsCents ?? 0)}
            icon={<Gift className="h-5 w-5 text-pink-600" />}
            iconBg="bg-pink-50 dark:bg-pink-900/20"
          />
        )}
        <StatsCard
          title="Purchased Credits"
          value={walletLoading ? '' : centsToDisplay(wallet?.purchasedCreditsCents ?? 0)}
          icon={<BookOpen className="h-5 w-5 text-sky-600" />}
          iconBg="bg-sky-50 dark:bg-sky-900/20"
        />
        <StatsCard
          title="Bonus Credits"
          value={walletLoading ? '' : centsToDisplay(wallet?.bonusCreditsCents ?? 0)}
          icon={<Star className="h-5 w-5 text-amber-500" />}
          iconBg="bg-amber-50 dark:bg-amber-900/20"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">Transaction History</h3>
          {txData && (
            <span className="text-sm text-gray-400">{txData.total} total</span>
          )}
        </div>
        <div className="p-4">
          <Table
            columns={[
              {
                key: 'createdAt',
                header: 'Date',
                render: (tx) => (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {format(new Date(tx.createdAt), 'MMM d, yyyy h:mm a')}
                  </span>
                ),
              },
              {
                key: 'type',
                header: 'Type',
                render: (tx) => (
                  <Badge variant={txTypeVariant[tx.type] ?? 'default'}>{tx.type}</Badge>
                ),
              },
              { key: 'description', header: 'Description' },
              {
                key: 'amountCents',
                header: 'Amount',
                render: (tx) => (
                  <span className={`font-semibold tabular-nums ${tx.type === 'DEBIT' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {tx.type === 'DEBIT' ? '-' : '+'}{centsToDisplay(tx.amountCents)}
                  </span>
                ),
              },
              {
                key: 'balanceAfterCents',
                header: 'Balance After',
                render: (tx) => (
                  <span className="tabular-nums text-gray-600 dark:text-gray-400">
                    {centsToDisplay(tx.balanceAfterCents)}
                  </span>
                ),
              },
            ]}
            data={transactions}
            keyField="publicId"
            loading={txLoading}
            emptyMessage="No transactions yet"
          />
        </div>
      </div>
    </div>
  );
}
