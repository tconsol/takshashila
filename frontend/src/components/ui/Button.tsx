import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'gradient' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

/**
 * Buttons are cut, not pillowy: small radius, hairline borders, a 1px press
 * translate instead of a shadow bloom. Only `primary` carries the accent fill,
 * so at most one thing on a screen shouts.
 */
const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink border border-accent ' +
    'hover:bg-accent-hover hover:border-accent-hover',
  // Kept as an alias so legacy `gradient` call sites stay on-system.
  gradient:
    'bg-accent text-accent-ink border border-accent ' +
    'hover:bg-accent-hover hover:border-accent-hover',
  secondary:
    'bg-ink text-paper border border-ink hover:bg-ink-2 hover:border-ink-2',
  outline:
    'bg-surface text-ink-2 border border-rule-strong ' +
    'hover:bg-surface-hover hover:text-ink hover:border-ink-faint',
  ghost:
    'bg-transparent text-ink-muted border border-transparent ' +
    'hover:bg-surface-hover hover:text-ink',
  danger:
    'bg-danger text-white border border-danger hover:brightness-110',
  success:
    'bg-ok text-white border border-ok hover:brightness-110',
};

const sizes: Record<Size, string> = {
  sm: 'h-7  px-2.5 text-xs  gap-1.5 rounded',
  md: 'h-9  px-3.5 text-sm  gap-2   rounded',
  lg: 'h-11 px-5   text-base gap-2  rounded-md',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'primary', size = 'md', loading, fullWidth, disabled, children, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center whitespace-nowrap',
        'font-medium tracking-[-0.005em] transition-all duration-150 ease-editorial',
        'active:translate-y-px',
        'disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && (
        <svg
          className="h-3.5 w-3.5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path
            className="opacity-90"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
