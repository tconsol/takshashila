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
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border-2.5 border-clay-ink bg-clay-mint text-clay-ink shadow-clay-sm">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-extrabold uppercase tracking-wider text-clay-green-dark">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-extrabold tracking-tight text-clay-ink dark:text-white sm:text-3xl">
            {title}
          </h1>
          {sub && (
            <p className="mt-1.5 text-sm font-semibold text-clay-ink/60 dark:text-gray-400 max-w-2xl">
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
