import { useState, useRef, useEffect, forwardRef, useCallback, useId } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: React.FocusEventHandler<HTMLSelectElement>;
  name?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  leftIcon?: React.ReactNode;
  searchThreshold?: number;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      label,
      error,
      options,
      placeholder = 'Select an option',
      value: controlledValue,
      defaultValue,
      onChange,
      onBlur,
      name,
      id,
      disabled = false,
      className,
      leftIcon,
      searchThreshold = 8,
    },
    ref,
  ) {
    const uid = useId();
    const inputId = id ?? uid;

    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [internalValue, setInternalValue] = useState<string>(
      controlledValue ?? defaultValue ?? '',
    );
    const [focusedIdx, setFocusedIdx] = useState(-1);

    const containerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const hiddenSelectRef = useRef<HTMLSelectElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
      if (controlledValue !== undefined) setInternalValue(controlledValue);
    }, [controlledValue]);

    useEffect(() => {
      if (!isOpen) return;
      const handler = (e: MouseEvent) => {
        if (!containerRef.current?.contains(e.target as Node)) {
          setIsOpen(false);
          setSearch('');
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    useEffect(() => {
      if (isOpen) {
        setTimeout(() => searchRef.current?.focus(), 30);
        setFocusedIdx(-1);
      }
    }, [isOpen]);

    const setRef = useCallback(
      (el: HTMLSelectElement | null) => {
        (hiddenSelectRef as React.MutableRefObject<HTMLSelectElement | null>).current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLSelectElement | null>).current = el;
      },
      [ref],
    );

    const showSearch = options.length > searchThreshold;
    const filtered = search
      ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
      : options;

    const selectedOption = options.find((o) => o.value === internalValue);

    const handleSelect = (optValue: string) => {
      setInternalValue(optValue);
      setIsOpen(false);
      setSearch('');
      setFocusedIdx(-1);
      if (onChange) {
        const syntheticEvent = {
          target: { value: optValue, name: name ?? '' },
          currentTarget: { value: optValue, name: name ?? '' },
          type: 'change',
          bubbles: true,
          nativeEvent: new Event('change'),
          isDefaultPrevented: () => false,
          isPropagationStopped: () => false,
          persist: () => {},
          preventDefault: () => {},
          stopPropagation: () => {},
        } as unknown as React.ChangeEvent<HTMLSelectElement>;
        onChange(syntheticEvent);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }
      if (e.key === 'Escape') { setIsOpen(false); setSearch(''); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && focusedIdx >= 0) {
        e.preventDefault();
        const opt = filtered[focusedIdx];
        if (opt) handleSelect(opt.value);
      }
    };

    useEffect(() => {
      if (focusedIdx >= 0 && listRef.current) {
        const el = listRef.current.children[focusedIdx] as HTMLElement;
        el?.scrollIntoView({ block: 'nearest' });
      }
    }, [focusedIdx]);

    return (
      <div className={cn('relative w-full', className)} ref={containerRef}>
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}

        <select
          ref={setRef}
          name={name}
          id={inputId}
          value={internalValue}
          onChange={() => {}}
          onBlur={onBlur}
          aria-hidden
          tabIndex={-1}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
        >
          <option value="" />
          {options.map((o) => <option key={o.value} value={o.value} />)}
        </select>

        <button
          type="button"
          id={`${inputId}-trigger`}
          onClick={() => !disabled && setIsOpen((v) => !v)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={label ? inputId : undefined}
          className={cn(
            'relative flex w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5',
            'text-sm font-medium text-left transition-colors duration-150 shadow-sm',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500',
            'dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100',
            isOpen && 'ring-2 ring-indigo-500/25 border-indigo-500',
            error && 'border-rose-400 focus:ring-rose-500/25',
            disabled && 'cursor-not-allowed bg-slate-50 opacity-60 dark:bg-slate-800',
          )}
        >
          {leftIcon && <span className="shrink-0 text-slate-400">{leftIcon}</span>}
          <span className={cn('flex-1 truncate', !selectedOption && 'text-slate-400')}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200', isOpen && 'rotate-180')} />
        </button>

        {isOpen && (
          <div
            className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:bg-slate-900 dark:border-slate-700"
            style={{ maxWidth: containerRef.current?.offsetWidth }}
            role="listbox"
            onKeyDown={handleKeyDown}
          >
            {showSearch && (
              <div className="border-b border-slate-100 p-2 dark:border-slate-800">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setFocusedIdx(0); }}
                    placeholder="Search…"
                    className="w-full rounded-lg border-0 bg-slate-50 py-1.5 pl-8 pr-3 text-sm outline-none placeholder:text-slate-400 dark:bg-slate-800 focus:ring-1 focus:ring-indigo-500/30"
                  />
                </div>
              </div>
            )}
            <ul ref={listRef} className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2.5 text-sm text-slate-400 text-center">No options found</li>
              ) : (
                filtered.map((opt, idx) => {
                  const isSelected = opt.value === internalValue;
                  const isFocused = idx === focusedIdx;
                  return (
                    <li
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(opt.value)}
                      onMouseEnter={() => setFocusedIdx(idx)}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors',
                        isFocused
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800',
                        isSelected && !isFocused && 'bg-indigo-50/60 font-semibold text-indigo-600 dark:bg-indigo-900/20',
                      )}
                    >
                      <span className="flex-1 truncate">{opt.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-600" strokeWidth={2.5} />}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}

        {error && <p className="mt-1.5 text-xs font-medium text-rose-500">{error}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';
