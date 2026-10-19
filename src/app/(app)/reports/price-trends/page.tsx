'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, StatCard } from '@/components/shared/Display';
import { DateRangeFilter, presetRange } from '@/components/shared/DateRange';
import { ProductPicker, SupplierPicker } from '@/components/shared/Pickers';
import { reportsApi } from '@/api/endpoints/other';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateOnly, formatPercent } from '@/lib/format';
import { ReportLayout } from '@/features/reports/ReportLayout';
import type { PriceTrendDto } from '@/api/dto/reports';
import { useBranchFilter } from '@/features/branches/branches';

const columns: ColumnDef<PriceTrendDto, unknown>[] = [
  { header: 'Product', accessorKey: 'productName', cell: ({ row }) => <span><span className="font-medium">{row.original.productName}</span><span className="block text-xs text-muted-foreground">per {row.original.unitSymbol}</span></span> },
  { header: 'Buys', accessorKey: 'purchaseCount', meta: { align: 'right' } },
  { header: 'First', accessorKey: 'firstUnitCost', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.firstUnitCost} currency={false} /> },
  { header: 'Latest', accessorKey: 'latestUnitCost', meta: { align: 'right' }, cell: ({ row }) => <span><MoneyText value={row.original.latestUnitCost} currency={false} className="font-medium" /><span className="block text-xs text-muted-foreground">{row.original.latestSupplier} · {formatDateOnly(row.original.latestDate)}</span></span> },
  {
    header: 'Change',
    accessorKey: 'changePercent',
    meta: { align: 'right' },
    cell: ({ row }) => <span className={`tabular ${(row.original.changePercent ?? 0) > 0 ? 'text-destructive' : (row.original.changePercent ?? 0) < 0 ? 'text-success' : ''}`}>{row.original.changePercent !== null && row.original.changePercent > 0 ? '+' : ''}{formatPercent(row.original.changePercent)}</span>,
  },
  { header: 'Lowest', accessorKey: 'lowestUnitCost', meta: { align: 'right' }, cell: ({ row }) => <span><MoneyText value={row.original.lowestUnitCost} currency={false} /><span className="block text-xs text-muted-foreground">{row.original.lowestSupplier}</span></span> },
  { header: 'Highest', accessorKey: 'highestUnitCost', meta: { align: 'right' }, cell: ({ row }) => <span><MoneyText value={row.original.highestUnitCost} currency={false} /><span className="block text-xs text-muted-foreground">{row.original.highestSupplier}</span></span> },
];

function PriceTrends() {
  const key = useQueryKey();
  const branch = useBranchFilter();
  const [range, setRange] = useState(() => presetRange('year'));
  const [productId, setProductId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const q = useQuery({ queryKey: key('reports', { priceTrends: range, productId, supplierId, branchId: branch.branchId }), queryFn: () => reportsApi.priceTrends(range.from, range.to, productId ?? undefined, supplierId ?? undefined, branch.scope) });
  const r = q.data;
  const rising = r?.items.filter((i) => (i.changePercent ?? 0) > 0).length ?? 0;
  return (
    <ReportLayout
      branchFilter={branch}
      title="Purchase price trends"
      description="How what you pay per unit has moved, and which supplier was cheapest."
      filters={
        <>
          <DateRangeFilter value={range} onChange={setRange} />
          <div className="w-56"><ProductPicker value={productId} onChange={(id) => setProductId(id)} placeholder="All products" clearable /></div>
          <div className="w-56"><SupplierPicker value={supplierId} onChange={(id) => setSupplierId(id)} placeholder="All suppliers" clearable /></div>
        </>
      }
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
      kpis={r && (
        <>
          <StatCard label="Products bought" value={r.productCount} />
          <StatCard label="Price went up" value={rising} tone={rising ? 'warning' : 'default'} />
        </>
      )}
    >
      {r && (
        <DataTable
          columns={columns}
          data={r.items}
          getRowId={(i) => `${i.productId}-${i.unitOfMeasureId}`}
          searchable
          emptyTitle="No purchases in this period"
          csv={{
            fileName: `price-trends-${range.from}-${range.to}`,
            columns: [
              { header: 'SKU', value: (i) => i.sku }, { header: 'Product', value: (i) => i.productName }, { header: 'Unit', value: (i) => i.unitSymbol },
              { header: 'Buys', value: (i) => i.purchaseCount }, { header: 'First', value: (i) => i.firstUnitCost }, { header: 'Latest', value: (i) => i.latestUnitCost },
              { header: 'Change %', value: (i) => i.changePercent }, { header: 'Average', value: (i) => i.averageUnitCost }, { header: 'Lowest', value: (i) => i.lowestUnitCost },
              { header: 'Lowest supplier', value: (i) => i.lowestSupplier }, { header: 'Highest', value: (i) => i.highestUnitCost }, { header: 'Highest supplier', value: (i) => i.highestSupplier },
            ],
          }}
        />
      )}
    </ReportLayout>
  );
}

export default function Page() {
  return <PermissionRoute permission="PurchaseReports.View"><PriceTrends /></PermissionRoute>;
}
