export interface CsvColumn<T> {
  key: keyof T & string;
  header: string;
  /** Override how the raw value is rendered (dates, nested objects, …). */
  format?: (value: unknown, row: T) => string;
}

/**
 * A field is quoted whenever it contains a delimiter, quote or newline, and inner
 * quotes are doubled — RFC 4180. A leading =, +, - or @ is also prefixed with a
 * quote so spreadsheet software treats the cell as text rather than a formula.
 */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  let text = value instanceof Date
    ? value.toISOString()
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);

  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Excel only detects UTF-8 when the file opens with a byte-order mark. Built from
 * its code point rather than typed literally, so the invisible character cannot be
 * lost or duplicated by an editor.
 */
const BOM = String.fromCharCode(0xfeff);

export function toCsv<T extends object>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(',');
  const body = rows.map((row) =>
    columns
      .map((c) => escapeCell(c.format ? c.format(row[c.key], row) : row[c.key]))
      .join(','),
  );
  // CRLF line endings keep the file valid per RFC 4180.
  return `${BOM}${[header, ...body].join('\r\n')}`;
}
