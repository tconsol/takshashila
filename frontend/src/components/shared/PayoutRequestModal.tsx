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
              Only credits you earned teaching can be paid out.
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
