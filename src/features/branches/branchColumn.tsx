'use client';

import type { ColumnDef } from '@/components/shared/DataTable';
import { branchLabel } from './branches';

type Labelled = { kraBranchId?: string | null; branchName?: string | null; name?: string | null };

/**
 * A "Branch" column ("01 · Westlands"), inserted after the first column. `label` overrides the row's own fields (for DTOs that
 * carry only a branch id); `fallback` is shown when a row has no branch (a business-wide expense).
 */
export function withBranchColumn<T>(
  columns: ColumnDef<T, unknown>[],
  show: boolean,
  opts: { header?: string; label?: (row: T) => string | null; fallback?: string } = {},
): ColumnDef<T, unknown>[] {
  if (!show) return columns;
  const text = (row: T) => {
    const own = opts.label ? opts.label(row) : branchLabel(row as Labelled);
    return own && own !== '—' ? own : opts.fallback ?? '—';
  };
  const column: ColumnDef<T, unknown> = {
    header: opts.header ?? 'Branch',
    id: 'branch',
    accessorFn: (row) => text(row),
    cell: ({ row }) => <span className="whitespace-nowrap text-sm">{text(row.original)}</span>,
  };
  return [columns[0], column, ...columns.slice(1)];
}
