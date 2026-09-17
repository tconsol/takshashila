import type { ReactNode } from 'react';
import { Spinner } from './Loading';
import { cn } from '../../lib/utils';

export interface TableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  width?: string;
  /** Right-aligns header + cell — use for numeric/currency columns. */
  numeric?: boolean;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyField: keyof T;
  loading?: boolean;
  emptyMessage?: string;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  dense?: boolean;
  /** Adds a hairline every 5 rows to help the eye track across a wide table. */
  banded?: boolean;
}

/**
 * A ledger, not a card grid: hairline rules between rows (not a border round
 * the whole block), an all-caps mono-adjacent header, numeric columns set in
 * tabular figures and right-aligned by default via `numeric`.
 */
export function Table<T>({
  columns,
  data,
  keyField,
  loading,
  emptyMessage = 'Nothing here yet.',
  emptyState,
  onRowClick,
  dense,
  banded,
}: TableProps<T>) {
  const cellPad = dense ? 'px-3 py-2' : 'px-4 py-3';
  const headPad = dense ? 'px-3 py-2' : 'px-4 py-2.5';

  return (
    <div className="w-full overflow-x-auto rounded border border-rule bg-surface">
      <table className="w-full min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-rule-strong">
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  headPad,
                  'eyebrow whitespace-nowrap font-semibold',
                  col.numeric && 'text-right',
                  col.headerClassName,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-16 text-center">
                <div className="flex justify-center"><Spinner /></div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-16 text-center text-sm text-ink-faint">
                {emptyState ?? emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={String(row[keyField])}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'border-b border-rule transition-colors duration-100',
                  onRowClick && 'cursor-pointer hover:bg-surface-hover',
                  banded && (i + 1) % 5 === 0 && 'border-b-rule-strong',
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      cellPad,
                      'align-middle text-ink-2',
                      col.numeric && 'text-right tabular-nums',
                      col.className,
                    )}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
