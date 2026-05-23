import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  /** Tiny chip rendered above the title e.g. "OVERVIEW" */
  eyebrow?: string;
  /** Icon shown to the left of the title in a soft tile */
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  subtitle,
  eyebrow,
  icon,
  actions,
  className,
}: PageHeaderProps) {
  const sub = description ?? subtitle;
  return (
    <div className={cn('mb-7 flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="flex items-start gap-4 min-w-0">
        {icon && (
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-violet-50 text-brand-600 ring-1 ring-brand-100/70 dark:from-brand-900/30 dark:to-violet-900/30 dark:text-brand-300 dark:ring-brand-900/40">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            {title}
          </h1>
          {sub && (
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
              {sub}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
