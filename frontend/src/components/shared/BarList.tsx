import { VizTokens } from './viz-tokens';

export interface BarListItem {
  label: string;
  value: number;
  /** Optional secondary text shown under the label. */
  sublabel?: string;
}

interface BarListProps {
  items: BarListItem[];
  formatValue?: (n: number) => string;
  emptyMessage?: string;
  /** Scale bars against this instead of the largest item (e.g. a funnel's first stage). */
  max?: number;
}

/**
 * Magnitude by bar length, identity by label — one series, one color. A value
 * ramp here would double-encode length as hue, so every bar shares the series
 * step. Values are direct-labelled, so no tooltip is required to read them.
 */
export function BarList({
  items,
  formatValue = (n) => n.toLocaleString(),
  emptyMessage = 'No data yet.',
  max,
}: BarListProps) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">{emptyMessage}</p>;
  }

  const ceiling = max ?? Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="viz-root space-y-3">
      <VizTokens />
      {items.map((item) => {
        const pct = ceiling > 0 ? Math.max(2, Math.round((item.value / ceiling) * 100)) : 0;
        return (
          <div key={item.label}>
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{item.label}</p>
                {item.sublabel && <p className="truncate text-xs text-slate-400">{item.sublabel}</p>}
              </div>
              <span className="flex-shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatValue(item.value)}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: 'var(--viz-series, #4f46e5)' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
