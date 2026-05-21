import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2)}`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-2 block text-sm font-extrabold text-clay-ink dark:text-gray-300">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-3.5 z-10 flex items-center text-clay-ink">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-2xl border-2.5 border-clay-ink bg-white px-4 py-3 text-sm font-semibold text-clay-ink placeholder:text-gray-400 transition-colors shadow-clay-sm',
              'focus:outline-none focus:bg-clay-bg/50 focus:shadow-clay',
              'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
              'dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500',
              error && 'border-rose-500',
              leftIcon && 'pl-11',
              rightIcon && 'pr-11',
              className,
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-3.5 z-10 flex items-center text-clay-ink">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="mt-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">{error}</p>}
        {!error && hint && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
