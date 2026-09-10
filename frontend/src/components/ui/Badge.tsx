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

/** purple/brand fold onto the single accent — this system has one hot colour. */
const soft: Record<BadgeVariant, string> = {
  default: 'bg-surface-sunk text-ink-2',
  success: 'bg-ok-wash text-ok',
  warning: 'bg-warn-wash text-warn',
  danger:  'bg-danger-wash text-danger',
  info:    'bg-info-wash text-info',
  purple:  'bg-accent-wash text-accent',
  brand:   'bg-accent-wash text-accent',
};

const solid: Record<BadgeVariant, string> = {
  default: 'bg-ink text-paper',
  success: 'bg-ok text-white',
  warning: 'bg-warn text-white',
  danger:  'bg-danger text-white',
  info:    'bg-info text-white',
  purple:  'bg-accent text-accent-ink',
  brand:   'bg-accent text-accent-ink',
};

const outline: Record<BadgeVariant, string> = {
  default: 'text-ink-2 ring-1 ring-inset ring-rule-strong',
  success: 'text-ok ring-1 ring-inset ring-ok/35',
  warning: 'text-warn ring-1 ring-inset ring-warn/35',
  danger:  'text-danger ring-1 ring-inset ring-danger/35',
  info:    'text-info ring-1 ring-inset ring-info/35',
  purple:  'text-accent ring-1 ring-inset ring-accent/35',
  brand:   'text-accent ring-1 ring-inset ring-accent/35',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-ink-muted',
  success: 'bg-ok',
  warning: 'bg-warn',
  danger:  'bg-danger',
  info:    'bg-info',
  purple:  'bg-accent',
  brand:   'bg-accent',
};

const sizes: Record<BadgeSize, string> = {
  sm: 'h-5 px-1.5 text-[10px] gap-1',
  md: 'h-6 px-2 text-xs gap-1.5',
};

export function Badge({
  variant = 'default',
  tone = 'soft',
  size = 'md',
  dot,
  className,
  children,
  ...props
}: BadgeProps) {
  const toneMap = tone === 'solid' ? solid : tone === 'outline' ? outline : soft;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm font-semibold uppercase tracking-[0.04em]',
        sizes[size],
        toneMap[variant],
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
