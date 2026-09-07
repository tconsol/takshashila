import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Banknote, ChevronLeft, ChevronRight, Check, X, Undo2,
  Clock, CheckCircle2, XCircle, ScrollText,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatsCard } from '../../components/shared/StatsCard';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Tabs } from '../../components/ui/Tabs';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import {
  financeService, type Payout, type LedgerEntry, type RefundableClass,
} from '../../services/finance.service';

const TABS = [
  { key: 'payouts', label: 'Payout Queue' },
  { key: 'ledger', label: 'Transaction Ledger' },
  { key: 'refunds', label: 'Refunds' },
];

const PAYOUT_STATUS_TABS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'COMPLETED', label: 'Approved' },
  { value: 'FAILED', label: 'Rejected' },
  { value: '', label: 'All' },
];

const LEDGER_TYPES = [
  { value: '', label: 'All types' },
  { value: 'CREDIT', label: 'Credit' },
  { value: 'DEBIT', label: 'Debit' },
  { value: 'REFUND', label: 'Refund' },
  { value: 'REVERSAL', label: 'Reversal' },
  { value: 'COMMISSION', label: 'Commission' },
  { value: 'PAYOUT', label: 'Payout' },
];

const LEDGER_STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REVERSED', label: 'Reversed' },
];

type Variant = 'success' | 'danger' | 'warning' | 'info' | 'default';

const STATUS_VARIANT: Record<string, Variant> = {
  COMPLETED: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
  REVERSED: 'default',
};

const TYPE_VARIANT: Record<string, Variant> = {
  CREDIT: 'success',
  DEBIT: 'info',
  REFUND: 'warning',
  REVERSAL: 'default',
  COMMISSION: 'info',
  PAYOUT: 'danger',
};

function money(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function Pager({
  page, totalPages, onChange,
}: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-xs text-slate-500">Page {page} of {totalPages}</p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" /> Previous
        </Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Next <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function FinanceOpsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('payouts');

  // ─── Payouts ──────────────────────────────────────────────────────────────
  const [payoutStatus, setPayoutStatus] = useState('PENDING');
  const [payoutPage, setPayoutPage] = useState(1);
  const [rejecting, setRejecting] = useState<Payout | null>(null);

  const { data: payouts, isLoading: payoutsLoading } = useQuery({
    queryKey: ['payouts', payoutStatus, payoutPage],
    queryFn: () => financeService.listPayouts(payoutStatus, payoutPage),
    staleTime: 15_000,
  });

  const { data: pendingPayouts } = useQuery({
    queryKey: ['payouts', 'PENDING', 1],
    queryFn: () => financeService.listPayouts('PENDING', 1),
    staleTime: 15_000,
  });

  const invalidatePayouts = () => {
    qc.invalidateQueries({ queryKey: ['payouts'] });
    qc.invalidateQueries({ queryKey: ['admin-overview'] });
  };

  const { mutate: approve, isPending: approving } = useMutation({
    mutationFn: (publicId: string) => financeService.approvePayout(publicId),
    onSuccess: invalidatePayouts,
  });
  const {
    mutate: reject, isPending: rejectingPending, error: rejectError, reset: resetReject,
  } = useMutation({
    mutationFn: ({ publicId, reason }: { publicId: string; reason?: string }) =>
      financeService.rejectPayout(publicId, reason),
    onSuccess: () => { invalidatePayouts(); setRejecting(null); },
  });

  const pendingTotal = (pendingPayouts?.items ?? []).reduce((s, p) => s + p.amountCents, 0);

  // ─── Ledger ───────────────────────────────────────────────────────────────
  const [ledgerType, setLedgerType] = useState('');
  const [ledgerStatus, setLedgerStatus] = useState('');
  const [ledgerFrom, setLedgerFrom] = useState('');
  const [ledgerTo, setLedgerTo] = useState('');
  const [ledgerPage, setLedgerPage] = useState(1);

  const ledgerFilters = useMemo(
    () => ({ type: ledgerType, status: ledgerStatus, from: ledgerFrom, to: ledgerTo, page: ledgerPage }),
    [ledgerType, ledgerStatus, ledgerFrom, ledgerTo, ledgerPage],
  );

  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ['ledger', ledgerFilters],
    queryFn: () => financeService.listLedger(ledgerFilters),
    enabled: tab === 'ledger',
    staleTime: 15_000,
  });

  // ─── Refunds ──────────────────────────────────────────────────────────────
  const [refundPage, setRefundPage] = useState(1);
  const [refunding, setRefunding] = useState<RefundableClass | null>(null);

  const { data: refundable, isLoading: refundableLoading } = useQuery({
    queryKey: ['refundable-classes', refundPage],
    queryFn: () => financeService.listRefundable(refundPage),
    enabled: tab === 'refunds',
    staleTime: 15_000,
  });

  const {
    mutate: refund, isPending: refundPending, error: refundError, reset: resetRefund,
  } = useMutation({
    mutationFn: ({ publicId, reason }: { publicId: string; reason: string }) =>
      financeService.refundClass(publicId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['refundable-classes'] });
      qc.invalidateQueries({ queryKey: ['ledger'] });
      setRefunding(null);
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Operations"
        eyebrow="Money"
        description="Review payouts, trace every ledger movement and reverse charged classes."
        icon={<Banknote className="h-5 w-5" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          index={0}
          title="Pending Payouts"
          value={(pendingPayouts?.pagination.total ?? 0).toLocaleString()}
          accent="amber"
          icon={<Clock className="h-5 w-5" />}
          hint={pendingTotal > 0 ? `${money(pendingTotal)} on this page` : 'Nothing awaiting review'}
        />
        <StatsCard
          index={1}
          title="Ledger Entries"
          value={(ledger?.pagination.total ?? 0).toLocaleString()}
          accent="brand"
          icon={<ScrollText className="h-5 w-5" />}
          hint={tab === 'ledger' ? 'Matching current filters' : 'Open the ledger tab'}
        />
        <StatsCard
          index={2}
          title="Refundable Classes"
          value={(refundable?.pagination.total ?? 0).toLocaleString()}
          accent="rose"
          icon={<Undo2 className="h-5 w-5" />}
          hint={tab === 'refunds' ? 'Completed, paid, not yet refunded' : 'Open the refunds tab'}
        />
        <StatsCard
          index={3}
          title="Credits Moved"
          value={money(
            (ledger?.totalsByType ?? []).reduce((s, t) => s + t.totalCents, 0),
          )}
          accent="green"
          icon={<CheckCircle2 className="h-5 w-5" />}
          hint="Across the filtered ledger"
        />
      </div>

      <Tabs tabs={TABS} activeTab={tab} onChange={setTab} />

      {tab === 'payouts' && (
        <Card padding="none">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div>
              <CardTitle>Payout Queue</CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                Requesting holds the funds; approving settles, rejecting returns them.
              </p>
            </div>
            <div className="flex gap-1.5">
              {PAYOUT_STATUS_TABS.map((s) => (
                <Button
                  key={s.value || 'all'}
                  size="sm"
                  variant={payoutStatus === s.value ? 'primary' : 'ghost'}
                  onClick={() => { setPayoutStatus(s.value); setPayoutPage(1); }}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="p-4">
            <Table<Payout>
              columns={[
                {
                  key: 'ownerName',
                  header: 'Requester',
                  render: (p) => (
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900 dark:text-white">{p.ownerName}</p>
                      <p className="truncate text-xs text-slate-400">{p.ownerEmail} · {p.ownerRole}</p>
                    </div>
                  ),
                },
                {
                  key: 'amountCents',
                  header: 'Amount',
                  render: (p) => (
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                      {money(p.amountCents)}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (p) => (
                    <Badge variant={STATUS_VARIANT[p.status] ?? 'default'} tone="soft">{p.status}</Badge>
                  ),
                },
                {
                  key: 'createdAt',
                  header: 'Requested',
                  render: (p) => (
                    <span className="text-xs text-slate-500">
                      {format(new Date(p.createdAt), 'MMM d, yyyy h:mm a')}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  header: '',
                  render: (p) =>
                    p.status === 'PENDING' ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="success" loading={approving} onClick={() => approve(p.publicId)}>
                          <Check className="h-3 w-3" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { resetReject(); setRejecting(p); }}>
                          <X className="h-3 w-3" /> Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="flex items-center justify-end gap-1.5 text-xs text-slate-400">
                        {p.status === 'COMPLETED'
                          ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Settled</>
                          : <><XCircle className="h-3.5 w-3.5 text-rose-500" /> Funds returned</>}
                      </span>
                    ),
                },
              ]}
              data={payouts?.items ?? []}
              keyField="publicId"
              loading={payoutsLoading}
              emptyMessage="No payouts in this state."
            />
            <Pager
              page={payouts?.pagination.page ?? 1}
              totalPages={payouts?.pagination.totalPages ?? 1}
              onChange={setPayoutPage}
            />
          </div>
        </Card>
      )}

      {tab === 'ledger' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select options={LEDGER_TYPES} value={ledgerType} onChange={(e) => { setLedgerType(e.target.value); setLedgerPage(1); }} />
            <Select options={LEDGER_STATUSES} value={ledgerStatus} onChange={(e) => { setLedgerStatus(e.target.value); setLedgerPage(1); }} />
            <Input type="date" label="From" value={ledgerFrom} onChange={(e) => { setLedgerFrom(e.target.value); setLedgerPage(1); }} />
            <Input type="date" label="To" value={ledgerTo} onChange={(e) => { setLedgerTo(e.target.value); setLedgerPage(1); }} />
          </div>

          {ledger && ledger.totalsByType.length > 0 && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Totals by Type</CardTitle>
                  <p className="mt-1 text-xs text-slate-500">Sum of the current filter selection</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {ledger.totalsByType.map((t) => (
                    <div key={t.type} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t.type}</p>
                      <p className="mt-1 text-base font-bold tabular-nums text-slate-900 dark:text-white">
                        {money(t.totalCents)}
                      </p>
                      <p className="text-xs text-slate-400">{t.count.toLocaleString()} entries</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Table<LedgerEntry>
            columns={[
              {
                key: 'createdAt',
                header: 'When',
                render: (t) => (
                  <span className="whitespace-nowrap text-xs text-slate-500">
                    {format(new Date(t.createdAt), 'MMM d, HH:mm')}
                  </span>
                ),
              },
              {
                key: 'ownerName',
                header: 'Owner',
                render: (t) => (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{t.ownerName}</p>
                    <p className="truncate text-xs text-slate-400">{t.ownerRole}</p>
                  </div>
                ),
              },
              {
                key: 'type',
                header: 'Type',
                render: (t) => <Badge variant={TYPE_VARIANT[t.type] ?? 'default'} tone="soft">{t.type}</Badge>,
              },
              {
                key: 'amountCents',
                header: 'Amount',
                render: (t) => (
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                    {money(t.amountCents)}
                  </span>
                ),
              },
              {
                key: 'balanceAfterCents',
                header: 'Balance after',
                render: (t) => (
                  <span className="text-xs tabular-nums text-slate-500">{money(t.balanceAfterCents)}</span>
                ),
              },
              {
                key: 'description',
                header: 'Description',
                render: (t) => (
                  <span className="block max-w-[240px] truncate text-xs text-slate-500" title={t.description}>
                    {t.description}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (t) => (
                  <Badge variant={STATUS_VARIANT[t.status] ?? 'default'} tone="soft">{t.status}</Badge>
                ),
              },
            ]}
            data={ledger?.items ?? []}
            keyField="publicId"
            loading={ledgerLoading}
            dense
            emptyMessage="No transactions match these filters."
          />
          <Pager
            page={ledger?.pagination.page ?? 1}
            totalPages={ledger?.pagination.totalPages ?? 1}
            onChange={setLedgerPage}
          />
        </div>
      )}

      {tab === 'refunds' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Only completed, paid classes that have not already been refunded appear here — the
            same set the refund endpoint will accept.
          </p>
          <Table<RefundableClass>
            columns={[
              {
                key: 'title',
                header: 'Class',
                render: (c) => (
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900 dark:text-white">{c.title}</p>
                    <p className="truncate text-xs text-slate-400">
                      {c.tutorName} → {c.studentName}
                    </p>
                  </div>
                ),
              },
              {
                key: 'startUTC',
                header: 'Held',
                render: (c) => (
                  <span className="whitespace-nowrap text-xs text-slate-500">
                    {format(new Date(c.startUTC), 'MMM d, yyyy')}
                  </span>
                ),
              },
              {
                key: 'costCents',
                header: 'Charged',
                render: (c) => (
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                    {money(c.costCents)}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: '',
                render: (c) => (
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => { resetRefund(); setRefunding(c); }}>
                      <Undo2 className="h-3 w-3" /> Refund
                    </Button>
                  </div>
                ),
              },
            ]}
            data={refundable?.items ?? []}
            keyField="publicId"
            loading={refundableLoading}
            emptyMessage="Nothing is currently refundable."
          />
          <Pager
            page={refundable?.pagination.page ?? 1}
            totalPages={refundable?.pagination.totalPages ?? 1}
            onChange={setRefundPage}
          />
        </div>
      )}

      <ConfirmDialog
        open={!!rejecting}
        title="Reject payout"
        message={
          rejecting
            ? `${money(rejecting.amountCents)} will be returned to ${rejecting.ownerName}'s wallet and the request marked rejected.`
            : ''
        }
        confirmLabel="Reject and return funds"
        reasonLabel="Reason"
        loading={rejectingPending}
        error={rejectError ? (rejectError as Error).message : undefined}
        onCancel={() => setRejecting(null)}
        onConfirm={(reason) => rejecting && reject({ publicId: rejecting.publicId, reason })}
      />

      <ConfirmDialog
        open={!!refunding}
        title="Refund class"
        message={
          refunding
            ? `${money(refunding.costCents)} plus the platform fee goes back to ${refunding.studentName}, and ${refunding.tutorName}'s earning for "${refunding.title}" is clawed back. This cannot be undone from here.`
            : ''
        }
        confirmLabel="Refund class"
        confirmPhrase="REFUND"
        reasonLabel="Reason"
        loading={refundPending}
        error={refundError ? (refundError as Error).message : undefined}
        onCancel={() => setRefunding(null)}
        onConfirm={(reason) =>
          refunding && refund({ publicId: refunding.publicId, reason: reason ?? 'Admin refund' })
        }
      />
    </div>
  );
}
