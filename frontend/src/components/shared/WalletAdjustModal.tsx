import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusCircle, MinusCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { walletAdminService, type CreditType } from '../../services/wallet-admin.service';

interface WalletAdjustModalProps {
  open: boolean;
  onClose: () => void;
  /** Whoever this wallet belongs to — shown for confirmation, not sent to the API. */
  targetPublicId: string;
  targetName: string;
  /** Withdrawable earnings shown for context; deduction is capped by the server regardless. */
  currentBalanceCents?: number;
}

const CREDIT_TYPE_OPTIONS: { value: CreditType; label: string; hint: string }[] = [
  { value: 'BONUS_CREDITS', label: 'Bonus', hint: 'Goodwill credit, promo, one-off adjustment' },
  { value: 'PURCHASED_CREDITS', label: 'Purchased', hint: 'Treated as if the user bought it' },
  { value: 'DEMO_CREDITS', label: 'Demo', hint: 'Extends their free-trial allowance' },
  { value: 'EARNED_CREDITS', label: 'Earned', hint: 'Counts toward payout-eligible balance — use only to correct a teaching-earnings dispute' },
];

function money(cents: number) {
  const n = Number(cents);
  return Number.isFinite(n) ? (n / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '';
}

/**
 * Manual wallet grant/deduct, reachable from a user's detail view. Grant is the
 * primary action (the whole point of this modal); deduct exists alongside it so
 * a mis-keyed grant has an undo path that doesn't require a database console.
 */
export function WalletAdjustModal({
  open, onClose, targetPublicId, targetName, currentBalanceCents,
}: WalletAdjustModalProps) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'grant' | 'deduct'>('grant');
  const [amount, setAmount] = useState('');
  const [creditType, setCreditType] = useState<CreditType>('BONUS_CREDITS');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setMode('grant');
    setAmount('');
    setCreditType('BONUS_CREDITS');
    setReason('');
  }, [open]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['user-detail', targetPublicId] });
    qc.invalidateQueries({ queryKey: ['wallet'] });
  };

  const { mutate: grant, isPending: granting, error: grantError, reset: resetGrant } = useMutation({
    mutationFn: () => walletAdminService.grant(targetPublicId, {
      amountCents: Math.round(Number(amount) * 100),
      creditType,
      reason: reason.trim(),
    }),
    onSuccess: () => { invalidate(); onClose(); },
  });

  const { mutate: deduct, isPending: deducting, error: deductError, reset: resetDeduct } = useMutation({
    mutationFn: () => walletAdminService.deduct(targetPublicId, {
      amountCents: Math.round(Number(amount) * 100),
      reason: reason.trim(),
    }),
    onSuccess: () => { invalidate(); onClose(); },
  });

  const cents = Math.round(Number(amount) * 100);
  const canSubmit = amount.trim() !== '' && Number.isFinite(cents) && cents > 0 && reason.trim().length > 0;
  const pending = granting || deducting;
  const error = mode === 'grant' ? grantError : deductError;

  const handleSubmit = () => {
    if (mode === 'grant') { resetGrant(); grant(); }
    else { resetDeduct(); deduct(); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjust Wallet"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant={mode === 'deduct' ? 'danger' : 'primary'}
            loading={pending}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {mode === 'grant' ? 'Grant credits' : 'Deduct credits'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-2">
          {mode === 'grant' ? 'Adding' : 'Removing'} credits for{' '}
          <span className="font-semibold text-ink">{targetName}</span>
          {currentBalanceCents !== undefined && (
            <span className="text-ink-muted"> · current balance {money(currentBalanceCents)}</span>
          )}
        </p>

        <div className="flex gap-1 rounded-md border border-rule bg-surface-sunk p-1">
          <button
            type="button"
            onClick={() => setMode('grant')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
              mode === 'grant' ? 'bg-surface text-ink shadow-lift' : 'text-ink-muted hover:text-ink-2'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" /> Grant
          </button>
          <button
            type="button"
            onClick={() => setMode('deduct')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
              mode === 'deduct' ? 'bg-surface text-danger shadow-lift' : 'text-ink-muted hover:text-ink-2'
            }`}
          >
            <MinusCircle className="h-3.5 w-3.5" /> Deduct
          </button>
        </div>

        <Input
          label="Amount (USD)"
          type="number"
          min={0.01}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 25.00"
        />

        {mode === 'grant' && (
          <div>
            <Select
              label="Credit type"
              options={CREDIT_TYPE_OPTIONS.map(({ value, label }) => ({ value, label }))}
              value={creditType}
              onChange={(e) => setCreditType(e.target.value as CreditType)}
            />
            <p className="mt-1.5 text-xs text-ink-muted">
              {CREDIT_TYPE_OPTIONS.find((o) => o.value === creditType)?.hint}
            </p>
          </div>
        )}

        <Input
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={mode === 'grant' ? 'e.g. Compensation for cancelled class' : 'e.g. Reversing accidental grant'}
          hint="Recorded on the transaction and in the audit log."
        />

        {error && <p className="text-sm font-medium text-danger">{(error as Error).message}</p>}
      </div>
    </Modal>
  );
}
