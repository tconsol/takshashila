import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '../../lib/utils';

type Accent = 'brand' | 'green' | 'violet' | 'amber' | 'rose' | 'sky' | 'pink' | 'orange';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: { value: string; positive: boolean };
  icon: ReactNode;
  /** Visual accent drives icon container + top-edge gradient strip */
  accent?: Accent;
  /** Optional hint shown under the value */
  hint?: string;
  /** Legacy prop accepted but ignored in favour of `accent` */
  iconBg?: string;
  className?: string;
}

const accents: Record<
  Accent,
  { iconBg: string; iconText: string; strip: string; ring: string }
> = {
  brand:  { iconBg: 'bg-brand-50',  iconText: 'text-brand-600',  strip: 'from-brand-400/70 via-brand-500/40 to-transparent',   ring: 'ring-brand-100/70 dark:ring-brand-900/40' },
  green:  { iconBg: 'bg-emerald-50',iconText: 'text-emerald-600',strip: 'from-emerald-400/70 via-emerald-500/40 to-transparent',ring: 'ring-emerald-100/70 dark:ring-emerald-900/40' },
  violet: { iconBg: 'bg-violet-50', iconText: 'text-violet-600', strip: 'from-violet-400/70 via-violet-500/40 to-transparent',  ring: 'ring-violet-100/70 dark:ring-violet-900/40' },
  amber:  { iconBg: 'bg-amber-50',  iconText: 'text-amber-600',  strip: 'from-amber-400/70 via-amber-500/40 to-transparent',   ring: 'ring-amber-100/70 dark:ring-amber-900/40' },
  rose:   { iconBg: 'bg-rose-50',   iconText: 'text-rose-600',   strip: 'from-rose-400/70 via-rose-500/40 to-transparent',     ring: 'ring-rose-100/70 dark:ring-rose-900/40' },
  sky:    { iconBg: 'bg-sky-50',    iconText: 'text-sky-600',    strip: 'from-sky-400/70 via-sky-500/40 to-transparent',       ring: 'ring-sky-100/70 dark:ring-sky-900/40' },
  pink:   { iconBg: 'bg-pink-50',   iconText: 'text-pink-600',   strip: 'from-pink-400/70 via-pink-500/40 to-transparent',     ring: 'ring-pink-100/70 dark:ring-pink-900/40' },
  orange: { iconBg: 'bg-orange-50', iconText: 'text-orange-600', strip: 'from-orange-400/70 via-orange-500/40 to-transparent', ring: 'ring-orange-100/70 dark:ring-orange-900/40' },
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

export function StatsCard({
  title,
  value,
  change,
  icon,
  accent,
  iconBg,
  hint,
  className,
}: StatsCardProps) {
  const a = accents[accent ?? inferAccent(iconBg)];

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm shadow-gray-200/40 transition-all hover:shadow-md hover:shadow-brand-200/30 hover:-translate-y-0.5 dark:border-gray-800 dark:bg-gray-900 dark:shadow-black/20',
        className,
      )}
    >
      {/* Top accent strip */}
      <div className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', a.strip)} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {value}
          </p>
          {hint && !change && (
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
          )}
          {change && (
            <div
              className={cn(
                'mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                change.positive
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
              )}
            >
              {change.positive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {change.value}
            </div>
          )}
        </div>
        <div
          className={cn(
            'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ring-4 transition-transform group-hover:scale-105',
            a.iconBg,
            a.iconText,
            a.ring,
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
