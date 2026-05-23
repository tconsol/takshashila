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
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const tones: Record<Tone, string> = {
  default:
    'bg-white border border-gray-200/70 dark:bg-gray-900 dark:border-gray-800',
  soft:
    'bg-gradient-to-br from-gray-50 via-white to-gray-50 border border-gray-200/70 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800/60 dark:border-gray-800',
  gradient:
    'bg-gradient-to-br from-brand-50 via-white to-violet-50 border border-brand-100/60 dark:from-brand-900/20 dark:via-gray-900 dark:to-violet-900/20 dark:border-brand-900/40',
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
        'rounded-2xl shadow-sm shadow-gray-200/40 dark:shadow-black/20 transition-all',
        tones[tone],
        paddings[padding],
        hoverable && 'hover:shadow-md hover:shadow-brand-200/30 hover:-translate-y-0.5 dark:hover:shadow-brand-900/20',
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
    <div
      className={cn('mb-5 flex items-start justify-between gap-3', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'text-base font-semibold tracking-tight text-gray-900 dark:text-white',
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('mt-1 text-sm text-gray-500 dark:text-gray-400', className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('text-gray-700 dark:text-gray-300', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mt-5 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
