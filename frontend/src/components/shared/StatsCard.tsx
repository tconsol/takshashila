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
  { iconBg: string; iconText: string }
> = {
  brand:  { iconBg: 'bg-clay-purple', iconText: 'text-clay-ink' },
  green:  { iconBg: 'bg-clay-mint',   iconText: 'text-clay-ink' },
  violet: { iconBg: 'bg-clay-purple', iconText: 'text-clay-ink' },
  amber:  { iconBg: 'bg-clay-yellow', iconText: 'text-clay-ink' },
  rose:   { iconBg: 'bg-clay-coral',  iconText: 'text-clay-ink' },
  sky:    { iconBg: 'bg-clay-sky',    iconText: 'text-clay-ink' },
  pink:   { iconBg: 'bg-clay-pink',   iconText: 'text-clay-ink' },
  orange: { iconBg: 'bg-clay-yellow', iconText: 'text-clay-ink' },
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
        'group relative overflow-hidden rounded-[28px] border-2.5 border-clay-ink bg-white p-5 shadow-clay transition-all hover:-translate-y-1 dark:bg-gray-900',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-wider text-clay-ink/60 dark:text-gray-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-black tracking-tight text-clay-ink dark:text-white">
            {value}
          </p>
          {hint && !change && (
            <p className="mt-1.5 text-xs font-semibold text-clay-ink/60 dark:text-gray-400">{hint}</p>
          )}
          {change && (
            <div
              className={cn(
                'mt-2 inline-flex items-center gap-1 rounded-full border-2 border-clay-ink px-2 py-0.5 text-xs font-extrabold',
                change.positive ? 'bg-clay-mint text-clay-ink' : 'bg-clay-coral text-clay-ink',
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
            'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border-2.5 border-clay-ink transition-transform group-hover:rotate-3',
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
