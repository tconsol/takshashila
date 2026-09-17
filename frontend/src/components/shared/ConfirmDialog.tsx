import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What the action does, in plain terms — say if it is reversible. */
  message: string;
  confirmLabel?: string;
  /** When set, the confirm button stays disabled until this text is typed back. */
  confirmPhrase?: string;
  /** Collect an optional free-text reason that goes into the audit record. */
  reasonLabel?: string;
  loading?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmPhrase,
  reasonLabel,
  loading,
  error,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) { setTyped(''); setReason(''); }
  }, [open]);

  const blocked = !!confirmPhrase && typed.trim() !== confirmPhrase;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button
            variant="danger"
            loading={loading}
            disabled={blocked}
            onClick={() => onConfirm(reason.trim() || undefined)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-900/50 dark:bg-amber-900/20">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500" />
          <p className="text-sm text-amber-900 dark:text-amber-200">{message}</p>
        </div>

        {reasonLabel && (
          <Input
            label={reasonLabel}
            placeholder="Recorded in the audit log (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}

        {confirmPhrase && (
          <Input
            label={`Type "${confirmPhrase}" to confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
        )}

        {error && <p className="text-sm font-medium text-rose-500">{error}</p>}
      </div>
    </Modal>
  );
}
