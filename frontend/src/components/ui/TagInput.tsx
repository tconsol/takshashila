import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** Offered as one-tap chips; the field still accepts anything typed. */
  suggestions?: string[];
  placeholder?: string;
  label?: string;
  hint?: string;
  disabled?: boolean;
  maxTags?: number;
}

/**
 * Free-text tag entry with suggestions. Tutors can type a subject we have
 * never heard of and it is kept; the server canonicalises the spelling on save,
 * so "maths" and "Mathematics" end up as one value without the tutor having to
 * pick from a list that will never be complete.
 *
 * Enter or comma commits; Backspace on an empty field removes the last tag.
 */
export function TagInput({
  value, onChange, suggestions = [], placeholder = 'Type and press Enter…',
  label, hint, disabled, maxTags = 30,
}: TagInputProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const has = (tag: string) => value.some((v) => v.toLowerCase() === tag.toLowerCase());

  const add = (raw: string) => {
    const tag = raw.trim().replace(/,+$/, '').trim();
    if (!tag || has(tag) || value.length >= maxTags) { setDraft(''); return; }
    onChange([...value, tag]);
    setDraft('');
  };

  const remove = (tag: string) => onChange(value.filter((v) => v !== tag));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      remove(value[value.length - 1]);
    }
  };

  // Only suggest what isn't already picked, and narrow as they type.
  const available = useMemo(() => {
    const query = draft.trim().toLowerCase();
    return suggestions
      .filter((s) => !has(s))
      .filter((s) => (query ? s.toLowerCase().includes(query) : true))
      .slice(0, 12);
  }, [suggestions, value, draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const canAddDraft = draft.trim().length > 0 && !has(draft.trim());

  return (
    <div>
      {label && <p className="eyebrow mb-2">{label}</p>}

      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          'flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-t-[3px] border-0 border-b-2 border-rule-strong bg-surface-sunk px-2.5 py-2',
          'cursor-text transition-colors focus-within:border-accent focus-within:bg-surface-hover',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-sm bg-accent-wash px-2 py-1 text-xs font-semibold text-accent"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(tag); }}
              aria-label={`Remove ${tag}`}
              className="text-accent/70 transition-colors hover:text-accent"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="min-w-[120px] flex-1 border-0 bg-transparent p-0 text-sm text-ink outline-none placeholder:text-ink-faint"
        />

        {canAddDraft && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); add(draft); }}
            className="inline-flex items-center gap-1 rounded-sm border border-rule-strong px-1.5 py-0.5 text-[11px] font-semibold text-ink-2 hover:border-accent hover:text-accent"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        )}
      </div>

      {available.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {available.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-sm border border-rule px-2 py-1 text-xs text-ink-muted transition-colors hover:border-accent hover:bg-accent-wash hover:text-accent"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {hint && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
