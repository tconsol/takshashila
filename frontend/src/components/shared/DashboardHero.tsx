import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { Role } from '../../types';

interface DashboardHeroProps {
  role: Role;
  eyebrow: string;
  title: string;
  description?: string;
  icon: ReactNode;
  /** Buttons / links rendered on the right (desktop) or below (mobile). */
  actions?: ReactNode;
  className?: string;
}

/**
 * A masthead, not a gradient banner. The role only shows up as a one-word
 * eyebrow — every dashboard opens the same way: label, a large serif title,
 * a rule that closes the block. The icon is a small ink mark, not a glassy
 * chip; nothing here competes with the accent, which is reserved for data.
 */
export function DashboardHero({ role: _role, eyebrow, title, description, icon, actions, className }: DashboardHeroProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn('pb-6', className)}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded border border-rule bg-surface-sunk text-accent">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="font-display mt-0.5 text-3xl font-semibold leading-[1.1] text-ink sm:text-4xl">
              {title}
            </h1>
            {description && (
              <p className="mt-2 max-w-xl text-[13px] text-ink-muted">{description}</p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>
        )}
      </div>
      <div className="mt-5 h-px w-full bg-rule" />
    </motion.div>
  );
}
