import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type Tone = 'default' | 'soft' | 'gradient';
type Pad = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: Pad;
  tone?: Tone;
  hoverable?: boolean;
}

const paddings: Record<Pad, string> = {
  none: '',
  sm:   'p-4',
  md:   'p-5',
  lg:   'p-7',
};

/** `gradient` becomes a thin accent top-rule — the only place a card gets colour. */
const tones: Record<Tone, string> = {
  default:  'bg-surface border border-rule',
  soft:     'bg-surface-sunk border border-rule',
  gradient: 'bg-surface border border-rule border-t-2 border-t-accent',
};

export function Card({
  className,
  padding = 'md',
  tone = 'default',
  hoverable = false,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded transition-colors duration-150',
        tones[tone],
        paddings[padding],
        hoverable && 'hover:bg-surface-hover cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3 border-b border-rule pb-3.5', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('font-display text-base font-semibold text-ink', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('mt-1 text-xs text-ink-muted', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('text-ink-2', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-5 flex items-center justify-between border-t border-rule pt-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}
