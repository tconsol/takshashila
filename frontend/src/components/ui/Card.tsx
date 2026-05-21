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

// Claymorphism — dark outline + hard offset shadow + pillowy rounded corners
const tones: Record<Tone, string> = {
  default:
    'bg-white border-2.5 border-clay-ink shadow-clay dark:bg-gray-900',
  soft:
    'bg-clay-bg border-2.5 border-clay-ink shadow-clay dark:bg-gray-900',
  gradient:
    'bg-gradient-to-br from-clay-mint via-white to-clay-sky border-2.5 border-clay-ink shadow-clay dark:from-brand-900/30 dark:via-gray-900 dark:to-violet-900/30',
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
        'rounded-[28px] transition-all',
        tones[tone],
        paddings[padding],
        hoverable && 'hover:-translate-y-1 hover:translate-x-[-1px] hover:shadow-clay-lg',
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
        'text-base font-extrabold tracking-tight text-clay-ink dark:text-white',
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
      className={cn('mt-1 text-sm text-gray-600 dark:text-gray-400', className)}
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
        'mt-5 flex items-center justify-between border-t-2 border-dashed border-gray-200 pt-4 dark:border-gray-800',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
