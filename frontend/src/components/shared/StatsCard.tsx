import type { ReactNode } from 'react';
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
}

const accents: Record<Accent, { iconBg: string; iconText: string; strip: string }> = {
  brand:  { iconBg: 'bg-indigo-100',   iconText: 'text-indigo-600',  strip: 'bg-indigo-500' },
  green:  { iconBg: 'bg-emerald-100',  iconText: 'text-emerald-600', strip: 'bg-emerald-500' },
  violet: { iconBg: 'bg-violet-100',   iconText: 'text-violet-600',  strip: 'bg-violet-500' },
  amber:  { iconBg: 'bg-amber-100',    iconText: 'text-amber-600',   strip: 'bg-amber-500' },
  rose:   { iconBg: 'bg-rose-100',     iconText: 'text-rose-600',    strip: 'bg-rose-500' },
  sky:    { iconBg: 'bg-sky-100',      iconText: 'text-sky-600',     strip: 'bg-sky-500' },
  pink:   { iconBg: 'bg-pink-100',     iconText: 'text-pink-600',    strip: 'bg-pink-500' },
  orange: { iconBg: 'bg-orange-100',   iconText: 'text-orange-600',  strip: 'bg-orange-500' },
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

export function StatsCard({ title, value, change, icon, accent, iconBg, hint, className }: StatsCardProps) {
  const a = accents[accent ?? inferAccent(iconBg)];

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-card p-5',
        'transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5',
        className,
      )}
    >
      {/* Colored top strip */}
      <div className={cn('absolute top-0 left-0 right-0 h-1 rounded-t-2xl', a.strip)} />

      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
          {hint && !change && (
            <p className="mt-1.5 text-xs text-slate-400">{hint}</p>
          )}
          {change && (
            <div
              className={cn(
                'mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                change.positive
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-600',
              )}
            >
              {change.positive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {change.value}
            </div>
          )}
        </div>
        <div
          className={cn(
            'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110',
            a.iconBg,
            a.iconText,
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
