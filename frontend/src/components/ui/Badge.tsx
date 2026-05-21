import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'brand';

type BadgeTone = 'soft' | 'solid' | 'outline';
type BadgeSize = 'sm' | 'md';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  tone?: BadgeTone;
  size?: BadgeSize;
  dot?: boolean;
}

// Claymorphism — vibrant pastel fills + dark outline
const soft: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-clay-ink border-2 border-clay-ink dark:bg-gray-800 dark:text-gray-300',
  success: 'bg-clay-mint text-clay-ink border-2 border-clay-ink dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-clay-yellow text-clay-ink border-2 border-clay-ink dark:bg-amber-900/30 dark:text-amber-400',
  danger:  'bg-clay-coral text-clay-ink border-2 border-clay-ink dark:bg-rose-900/30 dark:text-rose-400',
  info:    'bg-clay-sky text-clay-ink border-2 border-clay-ink dark:bg-sky-900/30 dark:text-sky-400',
  purple:  'bg-clay-purple text-clay-ink border-2 border-clay-ink dark:bg-violet-900/30 dark:text-violet-400',
  brand:   'bg-clay-pink text-clay-ink border-2 border-clay-ink dark:bg-brand-900/30 dark:text-brand-400',
};

const solid: Record<BadgeVariant, string> = {
  default: 'bg-gray-900 text-white',
  success: 'bg-emerald-600 text-white',
  warning: 'bg-amber-500 text-white',
  danger:  'bg-rose-600 text-white',
  info:    'bg-sky-600 text-white',
  purple:  'bg-violet-600 text-white',
  brand:   'bg-brand-600 text-white',
};

const outline: Record<BadgeVariant, string> = {
  default: 'border border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300',
  success: 'border border-emerald-300 text-emerald-700 dark:border-emerald-700/60 dark:text-emerald-400',
  warning: 'border border-amber-300 text-amber-800 dark:border-amber-700/60 dark:text-amber-400',
  danger:  'border border-rose-300 text-rose-700 dark:border-rose-700/60 dark:text-rose-400',
  info:    'border border-sky-300 text-sky-700 dark:border-sky-700/60 dark:text-sky-400',
  purple:  'border border-violet-300 text-violet-700 dark:border-violet-700/60 dark:text-violet-400',
  brand:   'border border-brand-300 text-brand-700 dark:border-brand-700/60 dark:text-brand-400',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-gray-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger:  'bg-rose-500',
  info:    'bg-sky-500',
  purple:  'bg-violet-500',
  brand:   'bg-brand-500',
};

const sizes: Record<BadgeSize, string> = {
  sm: 'px-2.5 py-0.5 text-[10px]',
  md: 'px-3 py-1 text-xs',
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
        'inline-flex items-center gap-1.5 rounded-full font-extrabold tracking-wide',
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
            tone === 'solid' ? 'bg-white/90' : dotColors[variant],
            dot && 'animate-pulse',
          )}
        />
      )}
      {children}
    </span>
  );
}
