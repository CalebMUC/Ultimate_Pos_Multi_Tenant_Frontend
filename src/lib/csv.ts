// Client-side CSV export: the API has no export endpoints.
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

function escape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const head = columns.map((c) => escape(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => escape(c.value(row))).join(','));
  return [head, ...body].join('\r\n');
}

export function downloadCsv<T>(fileName: string, rows: readonly T[], columns: readonly CsvColumn<T>[]) {
  // A BOM so Excel opens UTF-8 correctly.
  const blob = new Blob(['﻿', toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(href);
}
