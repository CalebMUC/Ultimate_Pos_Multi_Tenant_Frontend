'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/primitives';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText } from '@/components/shared/Display';
import { labels, LicenseKind, LicenseState } from '@/api/enums';
import { formatDateOnly, formatDateTime } from '@/lib/format';
import type { BusinessLicenseDto } from '@/api/dto/platform';

const kindVariant = { [LicenseKind.Trial]: 'info', [LicenseKind.Paid]: 'success', [LicenseKind.Complimentary]: 'violet' } as const;

/** A business's licence history, newest period first. Cancelled periods stay listed, struck through. */
export function LicenseTable({ licenses, isLoading, error, onRetry, actions }: {
  licenses: BusinessLicenseDto[] | undefined;
  isLoading?: boolean;
  error?: unknown;
  onRetry?(): void;
  /** Row actions (the platform's Cancel). */
  actions?: (l: BusinessLicenseDto) => ReactNode;
}) {
  const columns: ColumnDef<BusinessLicenseDto, unknown>[] = [
    { header: 'Licence', accessorKey: 'licenseNumber', cell: ({ row }) => <span className="font-medium">{row.original.licenseNumber}</span> },
    { header: 'Kind', accessorKey: 'kind', cell: ({ row }) => <Badge variant={kindVariant[row.original.kind] ?? 'secondary'}>{labels.licenseKind[row.original.kind]}</Badge> },
    { header: 'Plan', accessorKey: 'planName' },
    {
      header: 'Period',
      id: 'period',
      accessorFn: (l) => l.startsOn,
      cell: ({ row }) => <span className={row.original.state === LicenseState.Cancelled ? 'line-through opacity-60' : ''}>{formatDateOnly(row.original.startsOn)} – {formatDateOnly(row.original.endsOn)}</span>,
    },
    { header: 'Users', accessorKey: 'maxUsers', cell: ({ row }) => row.original.maxUsers ?? 'Unlimited' },
    { header: 'Branches', accessorKey: 'maxBranches', cell: ({ row }) => row.original.maxBranches ?? 'Unlimited' },
    { header: 'Amount', accessorKey: 'amount', meta: { align: 'right' }, cell: ({ row }) => (row.original.amount ? <MoneyText value={row.original.amount} /> : <span className="text-muted-foreground">—</span>) },
    {
      header: 'Payment',
      id: 'payment',
      cell: ({ row }) => [row.original.paymentMethod !== null ? labels.settlementMethod[row.original.paymentMethod] : null, row.original.paymentReference].filter(Boolean).join(' · ') || '—',
    },
    {
      header: 'State',
      accessorKey: 'state',
      cell: ({ row }) => row.original.state === LicenseState.Cancelled
        ? <span title={[row.original.cancelReason, row.original.cancelledAt ? formatDateTime(row.original.cancelledAt) : null].filter(Boolean).join(' · ')}><Badge variant="secondary">Cancelled</Badge></span>
        : <Badge variant="success">Active</Badge>,
    },
    ...(actions ? [{ id: 'actions', header: '', meta: { align: 'right' as const }, cell: ({ row }: { row: { original: BusinessLicenseDto } }) => actions(row.original) }] : []),
  ];
  const sorted = licenses ? [...licenses].sort((a, b) => b.startsOn.localeCompare(a.startsOn)) : undefined;
  return (
    <DataTable
      columns={columns.map((c) => ({ ...c, enableSorting: false }))}
      data={sorted}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      getRowId={(l) => l.businessLicenseId}
      rowClassName={(l) => (l.state === LicenseState.Cancelled ? 'text-muted-foreground' : undefined)}
      emptyTitle="No licences yet"
      renderExpanded={(l) => (l.notes || l.cancelReason ? (
        <div className="space-y-1 py-2 text-sm">
          {l.notes && <p><span className="text-muted-foreground">Notes: </span>{l.notes}</p>}
          {l.cancelReason && <p><span className="text-muted-foreground">Cancelled{l.cancelledAt ? ` ${formatDateTime(l.cancelledAt)}` : ''}: </span>{l.cancelReason}</p>}
        </div>
      ) : <p className="py-2 text-sm text-muted-foreground">No notes.</p>)}
    />
  );
}
