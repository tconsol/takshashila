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

// Claymorphism — pillowy buttons with dark outline + hard offset shadow.
// Hover translates 2px toward shadow (shadow shrinks). Active fully presses in.
const CLAY_PRESS =
  'hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-clay-pressed ' +
  'active:translate-x-[6px] active:translate-y-[6px] active:shadow-none';

const variants: Record<Variant, string> = {
  primary:
    `bg-clay-green text-white hover:bg-clay-green-dark border-2.5 border-clay-ink shadow-clay ${CLAY_PRESS} ` +
    'focus-visible:ring-clay-ink disabled:bg-clay-green/60',
  gradient:
    `bg-gradient-to-r from-clay-green via-emerald-500 to-teal-500 text-white border-2.5 border-clay-ink shadow-clay ${CLAY_PRESS} ` +
    'focus-visible:ring-clay-ink',
  secondary:
    `bg-clay-coral text-clay-ink hover:bg-clay-coral-strong border-2.5 border-clay-ink shadow-clay ${CLAY_PRESS} ` +
    'focus-visible:ring-clay-ink',
  ghost:
    'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 focus-visible:ring-gray-300',
  danger:
    `bg-rose-500 text-white hover:bg-rose-600 border-2.5 border-clay-ink shadow-clay ${CLAY_PRESS} focus-visible:ring-clay-ink`,
  success:
    `bg-clay-green text-white hover:bg-clay-green-dark border-2.5 border-clay-ink shadow-clay ${CLAY_PRESS} focus-visible:ring-clay-ink`,
  outline:
    `bg-white text-clay-ink hover:bg-gray-50 border-2.5 border-clay-ink shadow-clay ${CLAY_PRESS} focus-visible:ring-clay-ink ` +
    'dark:bg-gray-900 dark:text-gray-200',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-xs rounded-2xl',
  md: 'h-11 px-5 text-sm rounded-2xl',
  lg: 'h-13 px-7 text-base rounded-[20px] py-3',
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
        'inline-flex items-center justify-center gap-2 font-extrabold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
