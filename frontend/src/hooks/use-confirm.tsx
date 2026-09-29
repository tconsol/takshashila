import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';

export interface ConfirmOptions {
  title: string;
  /** What will happen, who is affected, and whether it can be undone. */
  message: string;
  confirmLabel?: string;
  /** Ask the person to type this word before the button enables (money, delete). */
  confirmPhrase?: string;
  reasonLabel?: string;
  tone?: 'danger' | 'primary';
}

/**
 * One shared confirmation step for anything that moves money, approves or
 * rejects a person, suspends, publishes or otherwise cannot be undone easily.
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   const ok = await confirm({ title: 'Approve payout?', message: '...', tone: 'primary' });
 *   if (!ok.confirmed) return;
 *   ...
 *   return <>{...}{confirmDialog}</>;
 *
 * Levels: plain confirm (default), + reasonLabel for a reason box,
 * + confirmPhrase for "type the word" on the riskiest actions.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((r: { confirmed: boolean; reason?: string }) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    return new Promise<{ confirmed: boolean; reason?: string }>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const finish = (result: { confirmed: boolean; reason?: string }) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  };

  const confirmDialog: ReactNode = (
    <ConfirmDialog
      open={!!options}
      title={options?.title ?? ''}
      message={options?.message ?? ''}
      confirmLabel={options?.confirmLabel}
      confirmPhrase={options?.confirmPhrase}
      reasonLabel={options?.reasonLabel}
      tone={options?.tone}
      onCancel={() => finish({ confirmed: false })}
      onConfirm={(reason) => finish({ confirmed: true, reason })}
    />
  );

  return { confirm, confirmDialog };
}
