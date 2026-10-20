'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { NativeSelect } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, QuantityText, StatCard, StatusBadge } from '@/components/shared/Display';
import { stockApi } from '@/api/endpoints/inventory';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateOnly, formatMoney } from '@/lib/format';
import { ReportLayout } from '@/features/reports/ReportLayout';
import type { ExpiryReportItemDto } from '@/api/dto/inventory';
import { useBranchFilter } from '@/features/branches/branches';

const columns: ColumnDef<ExpiryReportItemDto, unknown>[] = [
  { header: 'Product', accessorKey: 'productName', cell: ({ row }) => <span className="font-medium">{row.original.productName}</span> },
  { header: 'Batch', accessorKey: 'batchNumber' },
  { header: 'Expiry', accessorKey: 'expiryDate', cell: ({ row }) => formatDateOnly(row.original.expiryDate) },
  { header: 'Days', accessorKey: 'daysToExpiry', meta: { align: 'right' } },
  { header: 'Status', accessorKey: 'expiryStatus', cell: ({ row }) => <StatusBadge kind="expiry" value={row.original.expiryStatus} /> },
  { header: 'On hand', accessorKey: 'quantityOnHand', meta: { align: 'right' }, cell: ({ row }) => <QuantityText value={row.original.quantityOnHand} unit={row.original.baseUnitSymbol} /> },
  { header: 'Value', accessorKey: 'value', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.value} currency={false} /> },
];

function Expiry() {
  const router = useRouter();
  const key = useQueryKey();
  const branch = useBranchFilter();
  const [within, setWithin] = useState(90);
  const q = useQuery({ queryKey: key('reports', { expiry: within, branchId: branch.branchId }), queryFn: () => stockApi.expiryReport(within, branch.scope) });
  const r = q.data;
  return (
    <ReportLayout
      branchFilter={branch}
      title="Expiry report"
      description={r ? `Expired batches and batches expiring by ${formatDateOnly(r.asOf)} + ${r.withinDays} days.` : 'Expired and soon-to-expire batches.'}
      filters={
        <NativeSelect value={within} onChange={(e) => setWithin(Number(e.target.value))} className="w-48" aria-label="Within">
          {[30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>Expiring within {d} days</option>)}
        </NativeSelect>
      }
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
      kpis={r && (
        <>
          <StatCard label="Expired batches" value={r.expiredBatchCount} tone={r.expiredBatchCount ? 'destructive' : 'success'} />
          <StatCard label="Expired value" value={r.expiredValue === null ? '—' : formatMoney(r.expiredValue)} />
          <StatCard label="Near expiry" value={r.nearExpiryBatchCount} tone={r.nearExpiryBatchCount ? 'warning' : 'success'} />
          <StatCard label="Near-expiry value" value={r.nearExpiryValue === null ? '—' : formatMoney(r.nearExpiryValue)} />
        </>
      )}
    >
      {r && (
        <DataTable
          columns={columns}
          data={r.items}
          getRowId={(i) => i.stockBatchId}
          onRowClick={(i) => router.push(`/products/${i.productId}`)}
          searchable
          rowClassName={(i) => (i.expiryStatus === 'Expired' ? 'bg-destructive/5' : undefined)}
          emptyTitle="Nothing expired or expiring soon"
          csv={{
            fileName: `expiry-${within}d`,
            columns: [
              { header: 'SKU', value: (i) => i.sku }, { header: 'Product', value: (i) => i.productName }, { header: 'Batch', value: (i) => i.batchNumber },
              { header: 'Expiry', value: (i) => i.expiryDate }, { header: 'Days', value: (i) => i.daysToExpiry }, { header: 'Status', value: (i) => i.expiryStatus },
              { header: 'On hand', value: (i) => i.quantityOnHand }, { header: 'Value', value: (i) => i.value },
            ],
          }}
        />
      )}
    </ReportLayout>
  );
}

export default function Page() {
  return <PermissionRoute permission="InventoryReports.View" module="batches"><Expiry /></PermissionRoute>;
}
