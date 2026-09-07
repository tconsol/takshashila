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

const accents: Record<Accent, { chip: string; glow: string; blob: string }> = {
  brand:  { chip: 'from-indigo-500 to-blue-600',   glow: 'shadow-indigo-500/25',  blob: 'bg-indigo-400' },
  green:  { chip: 'from-emerald-500 to-teal-600',  glow: 'shadow-emerald-500/25', blob: 'bg-emerald-400' },
  violet: { chip: 'from-violet-500 to-purple-600', glow: 'shadow-violet-500/25',  blob: 'bg-violet-400' },
  amber:  { chip: 'from-amber-400 to-orange-500',  glow: 'shadow-amber-500/25',   blob: 'bg-amber-400' },
  rose:   { chip: 'from-rose-500 to-pink-600',     glow: 'shadow-rose-500/25',    blob: 'bg-rose-400' },
  sky:    { chip: 'from-sky-500 to-blue-600',      glow: 'shadow-sky-500/25',     blob: 'bg-sky-400' },
  pink:   { chip: 'from-pink-500 to-fuchsia-600',  glow: 'shadow-pink-500/25',    blob: 'bg-pink-400' },
  orange: { chip: 'from-orange-500 to-red-500',    glow: 'shadow-orange-500/25',  blob: 'bg-orange-400' },
};

function inferAccent(iconBg?: string): Accent {
  if (!iconBg) return 'brand';
  if (iconBg.includes('green') || iconBg.includes('emerald')) return 'green';
  if (iconBg.includes('violet') || iconBg.includes('purple')) return 'violet';
  if (iconBg.includes('amber') || iconBg.includes('yellow')) return 'amber';
  if (iconBg.includes('red') || iconBg.includes('rose')) return 'rose';
  if (iconBg.includes('sky') || iconBg.includes('blue')) return 'sky';
  if (iconBg.includes('pink')) return 'pink';
  if (iconBg.includes('orange')) return 'orange';
  return 'brand';
}

export function StatsCard({ title, value, change, icon, accent, iconBg, hint, className, index = 0 }: StatsCardProps) {
  const a = accents[accent ?? inferAccent(iconBg)];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24, delay: index * 0.06 }}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5',
        'shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-all duration-300',
        'hover:-translate-y-1 hover:shadow-xl hover:border-slate-200',
        'dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
    >
      {/* Soft glow blob, top-right — depth without a solid color block */}
      <div
        className={cn(
          'pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-[0.10] blur-2xl transition-opacity duration-300 group-hover:opacity-[0.18]',
          a.blob,
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{title}</p>
          <p className="mt-2 text-[28px] font-extrabold leading-none tracking-tight text-slate-900 tabular-nums dark:text-white">
            {value}
          </p>
          {hint && !change && (
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{hint}</p>
          )}
          {change && (
            <div
              className={cn(
                'mt-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                change.positive
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
              )}
            >
              {change.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {change.value}
            </div>
          )}
        </div>
        <div
          className={cn(
            'relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg',
            'transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3',
            a.chip,
            a.glow,
          )}
        >
          {icon}
        </div>
      </div>
    </motion.div>
  );
}
