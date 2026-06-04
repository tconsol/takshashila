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

const tones: Record<Tone, string> = {
  default:  'bg-white border border-slate-200/80 shadow-card',
  soft:     'bg-slate-50/70 border border-slate-200/60',
  gradient: 'bg-white border border-slate-200/80 shadow-card',
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
        'rounded-2xl transition-all duration-200',
        tones[tone],
        paddings[padding],
        hoverable && 'hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer',
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
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-base font-bold tracking-tight text-slate-900 dark:text-slate-100', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('mt-1 text-sm text-slate-500 dark:text-slate-400', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('text-slate-700 dark:text-slate-300', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-5 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800', className)}
      {...props}
    >
      {children}
    </div>
  );
}
