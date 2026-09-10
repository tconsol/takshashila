import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * Underline field, not a boxed pill: a flat sunk well with a hairline base
 * that turns to the accent on focus. Reads as a form built for data entry,
 * not a marketing site.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2)}`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="eyebrow mb-1.5 block">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center text-ink-faint">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-surface-sunk px-3 py-2 text-sm text-ink placeholder:text-ink-faint',
              'border-0 border-b-2 border-rule-strong rounded-t-[3px]',
              'transition-colors duration-150 ease-editorial',
              'focus:outline-none focus:border-accent focus:bg-surface-hover',
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              error && 'border-b-danger focus:border-b-danger',
              props.disabled && 'opacity-50 cursor-not-allowed',
              className,
            )}
            {...props}
          />
          {rightIcon && (
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-faint">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="mt-1.5 text-xs font-medium text-danger">{error}</p>}
        {hint && !error && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
