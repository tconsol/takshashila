import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  eyebrow?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Sub-page header: eyebrow, serif title, hairline close — matches DashboardHero's grammar at a smaller scale. */
export function PageHeader({ title, description, subtitle, eyebrow, icon, actions, className }: PageHeaderProps) {
  const sub = description ?? subtitle;
  return (
    <div className={cn('mb-6 pb-5 border-b border-rule', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-rule bg-surface-sunk text-accent">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow mb-0.5">{eyebrow}</p>}
            <h1 className="font-display text-xl font-semibold text-ink sm:text-2xl">
              {title}
            </h1>
            {sub && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{sub}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
