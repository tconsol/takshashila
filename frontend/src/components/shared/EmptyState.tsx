import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** Compact spacing for in-card empty states */
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4' : 'py-14 px-6',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 via-white to-violet-50 text-brand-600 ring-1 ring-brand-100/70 dark:from-brand-900/30 dark:via-gray-900 dark:to-violet-900/30 dark:text-brand-300 dark:ring-brand-900/40">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
