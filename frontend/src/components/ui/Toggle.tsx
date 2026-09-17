import { cn } from '../../lib/utils';

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  description?: string;
  danger?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const trackSize = { sm: 'h-4 w-7', md: 'h-5 w-9' };
const knobSize = { sm: 'h-3 w-3', md: 'h-4 w-4' };
const knobTravel = { sm: 'translate-x-3', md: 'translate-x-4' };

/**
 * A switch, not a pill-with-a-dot: square-ish track, hairline ring when off,
 * flat accent fill when on. No drop shadow on the knob — depth here comes from
 * a 1px inset ring, matching the rest of the system's hairline language.
 */
export function Toggle({
  checked, onChange, label, description, danger, disabled, size = 'md', className,
}: ToggleProps) {
  const switchEl = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-sm transition-colors duration-150 ease-editorial',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        trackSize[size],
        checked
          ? danger ? 'bg-danger' : 'bg-accent'
          : 'bg-transparent ring-1 ring-inset ring-rule-strong',
        disabled && 'opacity-40 pointer-events-none',
      )}
    >
      <span
        className={cn(
          'inline-block rounded-[1px] bg-surface transition-transform duration-150 ease-editorial',
          knobSize[size],
          checked ? knobTravel[size] : 'translate-x-0.5',
          !checked && 'bg-ink-faint',
        )}
      />
    </button>
  );

  if (!label && !description) return <span className={className}>{switchEl}</span>;

  return (
    <label
      className={cn(
        'flex cursor-pointer items-start justify-between gap-4 rounded border border-rule px-4 py-3.5',
        'transition-colors duration-150 hover:bg-surface-hover',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <div className="min-w-0">
        {label && <p className="text-sm font-semibold text-ink">{label}</p>}
        {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
      </div>
      {switchEl}
    </label>
  );
}
