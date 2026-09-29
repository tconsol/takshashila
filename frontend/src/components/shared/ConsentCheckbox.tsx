import { forwardRef, type InputHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';

interface ConsentCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: string;
  /** Child accounts: a parent or guardian agrees on the child's behalf. */
  onBehalfOfChild?: boolean;
}

/**
 * The required "I agree to the Terms of Use and Privacy Policy" box shown on
 * every sign-up form. Works with react-hook-form's register() (forwards ref).
 */
export const ConsentCheckbox = forwardRef<HTMLInputElement, ConsentCheckboxProps>(
  ({ error, onBehalfOfChild, className = '', ...props }, ref) => (
    <div className={className}>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
        <input
          ref={ref}
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          aria-invalid={!!error}
          {...props}
        />
        <span>
          {onBehalfOfChild
            ? "I am this child's parent or legal guardian and I agree, for them and for me, to the "
            : 'I agree to the '}
          <Link to="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-600 underline">
            Terms of Use
          </Link>{' '}
          and{' '}
          <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-600 underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      {error && <p className="mt-1 text-xs font-medium text-rose-500">{error}</p>}
    </div>
  ),
);
ConsentCheckbox.displayName = 'ConsentCheckbox';
