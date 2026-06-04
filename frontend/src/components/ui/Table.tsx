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
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card dark:bg-slate-900 dark:border-slate-700">
      <table className="w-full text-sm text-left">
        <thead className="border-b border-slate-100 bg-slate-50/80 dark:bg-slate-800/40 dark:border-slate-700">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={`${headPad} text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${col.headerClassName ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center">
                <div className="flex justify-center"><Spinner /></div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-slate-400">
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
                    ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    : ''
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`${cellPad} text-sm font-medium text-slate-700 dark:text-slate-200 ${col.className ?? ''}`}
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
