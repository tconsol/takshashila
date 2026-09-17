import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';

type Accent = 'brand' | 'green' | 'violet' | 'amber' | 'rose' | 'sky' | 'pink' | 'orange';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: { value: string; positive: boolean };
  icon: ReactNode;
  accent?: Accent;
  hint?: string;
  iconBg?: string;
  className?: string;
  /** Stagger position when several StatsCards render together (0-based). */
  index?: number;
}

/**
 * A ledger tile, not a gradient badge card: the number is the whole point,
 * set large in the display serif with tabular figures. `accent` no longer
 * picks a rainbow — every card is flat ink/paper and the icon only ever
 * carries the one system accent, so nothing competes with real data colour
 * (the trend chip, which uses ok/danger).
 */
export function StatsCard({ title, value, change, icon, hint, className, index = 0 }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: index * 0.05 }}
      className={cn(
        'group relative border border-rule bg-surface p-4 transition-colors duration-150',
        'hover:border-rule-strong hover:bg-surface-hover',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{title}</p>
        <span className="text-ink-faint transition-colors group-hover:text-accent">{icon}</span>
      </div>

      <p className="font-display mt-2.5 text-[28px] font-semibold leading-none tracking-[-0.01em] text-ink tabular-nums">
        {value}
      </p>

      <div className="mt-2.5 flex h-[18px] items-center">
        {hint && !change && <p className="text-xs text-ink-muted">{hint}</p>}
        {change && (
          <div
            className={cn(
              'inline-flex items-center gap-1 text-xs font-semibold',
              change.positive ? 'text-ok' : 'text-danger',
            )}
          >
            {change.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {change.value}
          </div>
        )}
      </div>

      {/* Accent tick, top-left — the one piece of colour, present only on hover */}
      <div className="pointer-events-none absolute left-0 top-0 h-0.5 w-6 origin-left scale-x-0 bg-accent transition-transform duration-200 ease-editorial group-hover:scale-x-100" />
    </motion.div>
  );
}
