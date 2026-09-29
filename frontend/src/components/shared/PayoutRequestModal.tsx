import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { financeService } from '../../services/finance.service';

interface PayoutRequestModalProps {
  open: boolean;
  onClose: () => void;
  /** Only earned credits are cashable — purchased and bonus credits are not. */
  withdrawableCents: number;
}

const MIN_PAYOUT_CENTS = 10_00;

function money(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function PayoutRequestModal({ open, onClose, withdrawableCents }: PayoutRequestModalProps) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) { setAmount(''); setNote(''); }
  }, [open]);

  const { mutate: request, isPending, error, reset } = useMutation({
    mutationFn: () => financeService.requestPayout(Math.round(Number(amount) * 100), note.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      onClose();
    },
  });

  const cents = Math.round(Number(amount) * 100);
  const tooSmall = amount !== '' && cents < MIN_PAYOUT_CENTS;
  const tooLarge = cents > withdrawableCents;
  const canSubmit = amount !== '' && Number.isFinite(cents) && !tooSmall && !tooLarge;
  // Not an error: the request still goes through. But a remainder under the minimum
  // can only be withdrawn once earnings bring it back up to the minimum.
  const remainderCents = withdrawableCents - cents;
  const leavesStuckRemainder = canSubmit && remainderCents > 0 && remainderCents < MIN_PAYOUT_CENTS;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request Payout"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={isPending} disabled={!canSubmit} onClick={() => { reset(); request(); }}>
            Request {canSubmit ? money(cents) : 'payout'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-900/20">
          <Banknote className="h-5 w-5 flex-shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              {money(withdrawableCents)} available to withdraw
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Only credits you earned teaching can be paid out. Earnings from the last 48 hours are held in
              case a class is refunded, so they appear here once the hold ends.
            </p>
          </div>
        </div>

        <Input
          label="Amount (USD)"
          type="number"
          min={MIN_PAYOUT_CENTS / 100}
          max={withdrawableCents / 100}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={
            tooSmall ? `Minimum payout is ${money(MIN_PAYOUT_CENTS)}`
              : tooLarge ? `You can withdraw at most ${money(withdrawableCents)}`
                : undefined
          }
        />

        {withdrawableCents >= MIN_PAYOUT_CENTS && (
          <button
            type="button"
            onClick={() => setAmount((withdrawableCents / 100).toFixed(2))}
            className="-mt-2 text-xs font-semibold text-emerald-700 underline dark:text-emerald-300"
          >
            Withdraw everything available ({money(withdrawableCents)})
          </button>
        )}

        {leavesStuckRemainder && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
            <p className="font-semibold">Caution: {money(remainderCents)} will be left in your wallet.</p>
            <p className="mt-0.5">
              The minimum payout is {money(MIN_PAYOUT_CENTS)}, so you will not be able to withdraw that {money(remainderCents)} until
              your earnings bring it up to {money(MIN_PAYOUT_CENTS)}. To avoid this, withdraw everything available or leave at
              least {money(MIN_PAYOUT_CENTS)}.
            </p>
          </div>
        )}

        <Input
          label="Note (optional)"
          placeholder="Anything the finance team should know"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <p className="text-xs text-slate-500">
          The amount leaves your wallet as soon as you request it, so it cannot be spent while
          the request is under review. If it is rejected, the full amount is returned.
        </p>

        {error && <p className="text-sm font-medium text-rose-500">{(error as Error).message}</p>}
      </div>
    </Modal>
  );
}
