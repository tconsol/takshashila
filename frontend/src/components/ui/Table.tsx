import type { ReactNode } from 'react';
import { Spinner } from './Loading';

export interface TableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  width?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyField: keyof T;
  loading?: boolean;
  emptyMessage?: string;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  /** Show a compact, denser variant */
  dense?: boolean;
}

export function Table<T>({
  columns,
  data,
  keyField,
  loading,
  emptyMessage = 'No data yet.',
  emptyState,
  onRowClick,
  dense,
}: TableProps<T>) {
  const cellPad = dense ? 'px-4 py-2.5' : 'px-5 py-3.5';
  const headPad = dense ? 'px-4 py-2.5' : 'px-5 py-3';
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-sm shadow-gray-200/40 dark:border-gray-800 dark:bg-gray-900 dark:shadow-black/20">
      <table className="w-full text-sm text-left">
        <thead className="border-b border-gray-200/70 bg-gray-50/60 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={`${headPad} ${col.headerClassName ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center">
                <div className="flex justify-center">
                  <Spinner />
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                {emptyState ?? emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={String(row[keyField])}
                onClick={() => onRowClick?.(row)}
                className={`transition-colors ${
                  onRowClick
                    ? 'cursor-pointer hover:bg-brand-50/40 dark:hover:bg-brand-900/10'
                    : ''
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`${cellPad} text-sm text-gray-700 dark:text-gray-200 ${col.className ?? ''}`}
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
