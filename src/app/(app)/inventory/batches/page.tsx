'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FocusBanner } from '@/components/shared/FocusBanner';
import { useQuery } from '@tanstack/react-query';
import { AlarmClock, PackageX } from 'lucide-react';
import { Checkbox } from '@/components/ui/overlays';
import { NativeSelect } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, PageHeader, QuantityText, StatCard, StatusBadge } from '@/components/shared/Display';
import { stockApi } from '@/api/endpoints/inventory';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateOnly, formatMoney } from '@/lib/format';
import type { StockBatchDto } from '@/api/dto/inventory';
import { branchLabel, useBranchFilter } from '@/features/branches/branches';
import { withBranchColumn } from '@/features/branches/branchColumn';

const columns: ColumnDef<StockBatchDto, unknown>[] = [
  { header: 'Product', accessorKey: 'productName', cell: ({ row }) => <span className="font-medium">{row.original.productName}</span> },
  { header: 'Batch', accessorKey: 'batchNumber' },
  { header: 'Expiry', accessorKey: 'expiryDate', cell: ({ row }) => formatDateOnly(row.original.expiryDate) },
  { header: 'Days left', accessorKey: 'daysToExpiry', meta: { align: 'right' }, cell: ({ row }) => row.original.daysToExpiry ?? '—' },
  { header: 'Status', accessorKey: 'expiryStatus', cell: ({ row }) => <StatusBadge kind="expiry" value={row.original.expiryStatus} /> },
  { header: 'On hand', accessorKey: 'quantityOnHand', meta: { align: 'right' }, cell: ({ row }) => <QuantityText value={row.original.quantityOnHand} unit={row.original.baseUnitSymbol} /> },
  { header: 'Unit cost', accessorKey: 'unitCost', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.unitCost} currency={false} /> },
];

function Batches() {
  const router = useRouter();
  const key = useQueryKey();
  const branch = useBranchFilter();
  const canReports = usePermission('InventoryReports.View');
  const [within, setWithin] = useState('');
  const [includeExpired, setIncludeExpired] = useState(true);
  const [includeEmpty, setIncludeEmpty] = useState(false);
  // ?batchId=… (expiry notifications) opens the list on one batch. Expired and empty batches are included so it is always found.
  const batchId = useSearchParams().get('batchId');
  const params = batchId
    ? { includeExpired: true, includeEmpty: true }
    : { expiringWithinDays: within ? Number(within) : undefined, includeExpired, includeEmpty };
  const query = useQuery({ queryKey: key('stock', { batches: params, branchId: branch.branchId }), queryFn: () => stockApi.batches({ ...params, ...branch.scope }) });
  const focused = batchId ? query.data?.filter((b) => b.stockBatchId === batchId) : undefined;
  const report = useQuery({ queryKey: key('stock', { expiry: 90 }), queryFn: () => stockApi.expiryReport(90), enabled: canReports });
  const r = report.data;
  return (
    <>
      <PageHeader title="Batches & expiry" description="Stock held per batch, soonest expiry first. Sales pick from the batch that expires first (FEFO)." />
      {r && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <StatCard label="Expired batches" value={r.expiredBatchCount} hint={r.expiredValue !== null ? `${formatMoney(r.expiredValue)} at cost: write them off` : undefined} icon={<PackageX />} tone={r.expiredBatchCount ? 'destructive' : 'success'} />
          <StatCard label={`Expiring within ${r.withinDays} days`} value={r.nearExpiryBatchCount} hint={r.nearExpiryValue !== null ? `${formatMoney(r.nearExpiryValue)} at cost` : undefined} icon={<AlarmClock />} tone={r.nearExpiryBatchCount ? 'warning' : 'success'} />
        </div>
      )}
      {batchId && (
        <FocusBanner>
          {focused?.length
            ? <>Showing batch <span className="font-medium">{focused[0].batchNumber}</span> of {focused[0].productName}.</>
            : query.isLoading ? 'Showing one batch.' : 'That batch was not found in this business.'}
        </FocusBanner>
      )}
      <DataTable
        branchFilter={branch}
        columns={withBranchColumn(columns, branch.visible && !branch.branchId)}
        data={batchId ? focused : query.data}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        getRowId={(b) => b.stockBatchId}
        onRowClick={(b) => router.push(`/products/${b.productId}`)}
        searchable
        searchPlaceholder="Product, SKU or batch…"
        rowClassName={(b) => (b.expiryStatus === 'Expired' ? 'bg-destructive/5' : b.expiryStatus === 'NearExpiry' ? 'bg-warning/5' : undefined)}
        emptyTitle="No batches"
        toolbar={!batchId && (
          <>
            <NativeSelect value={within} onChange={(e) => setWithin(e.target.value)} className="w-44" aria-label="Expiring within">
              <option value="">Any expiry</option>
              {[30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>Expiring within {d} days</option>)}
            </NativeSelect>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={includeExpired} onCheckedChange={(v) => setIncludeExpired(v === true)} />Expired</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={includeEmpty} onCheckedChange={(v) => setIncludeEmpty(v === true)} />Empty</label>
          </>
        )}
        csv={{
          fileName: 'batches',
          columns: [
            { header: 'Branch', value: (b) => branchLabel(b) },
            { header: 'SKU', value: (b) => b.sku },
            { header: 'Product', value: (b) => b.productName },
            { header: 'Batch', value: (b) => b.batchNumber },
            { header: 'Expiry', value: (b) => b.expiryDate },
            { header: 'Days left', value: (b) => b.daysToExpiry },
            { header: 'Status', value: (b) => b.expiryStatus },
            { header: 'On hand', value: (b) => b.quantityOnHand },
            { header: 'Unit cost', value: (b) => b.unitCost },
          ],
        }}
      />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Stock.View" module="batches"><Suspense><Batches /></Suspense></PermissionRoute>;
}
