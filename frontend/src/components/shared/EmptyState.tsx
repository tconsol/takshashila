import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center border border-dashed border-rule-strong text-center',
        compact ? 'px-4 py-8' : 'px-6 py-16',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded border border-rule bg-surface-sunk text-ink-faint">
          {icon}
        </div>
      )}
      <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
