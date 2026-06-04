import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'brand';
type BadgeTone = 'soft' | 'solid' | 'outline';
type BadgeSize = 'sm' | 'md';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  tone?: BadgeTone;
  size?: BadgeSize;
  dot?: boolean;
}

const soft: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  danger:  'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
  info:    'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  purple:  'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  brand:   'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
};

const solid: Record<BadgeVariant, string> = {
  default: 'bg-slate-700 text-white',
  success: 'bg-emerald-500 text-white',
  warning: 'bg-amber-500 text-white',
  danger:  'bg-rose-500 text-white',
  info:    'bg-sky-500 text-white',
  purple:  'bg-violet-500 text-white',
  brand:   'bg-indigo-600 text-white',
};

const outline: Record<BadgeVariant, string> = {
  default: 'border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300',
  success: 'border border-emerald-300 text-emerald-700 dark:border-emerald-600/60 dark:text-emerald-400',
  warning: 'border border-amber-300 text-amber-700 dark:border-amber-600/60 dark:text-amber-400',
  danger:  'border border-rose-300 text-rose-600 dark:border-rose-600/60 dark:text-rose-400',
  info:    'border border-sky-300 text-sky-600 dark:border-sky-600/60 dark:text-sky-400',
  purple:  'border border-violet-300 text-violet-600 dark:border-violet-600/60 dark:text-violet-400',
  brand:   'border border-indigo-300 text-indigo-600 dark:border-indigo-600/60 dark:text-indigo-400',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-slate-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger:  'bg-rose-500',
  info:    'bg-sky-500',
  purple:  'bg-violet-500',
  brand:   'bg-indigo-500',
};

const sizes: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-0.5 text-xs',
};

export function Badge({
  className,
  variant = 'default',
  tone = 'soft',
  size = 'md',
  dot,
  children,
  ...props
}: BadgeProps) {
  const toneMap = tone === 'solid' ? solid : tone === 'outline' ? outline : soft;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide',
        toneMap[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            tone === 'solid' ? 'bg-white/80' : dotColors[variant],
            dot && 'animate-pulse',
          )}
        />
      )}
      {children}
    </span>
  );
}
