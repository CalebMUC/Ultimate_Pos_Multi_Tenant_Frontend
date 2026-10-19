'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { StatCard } from '@/components/shared/Display';
import { DateRangeFilter, presetRange } from '@/components/shared/DateRange';
import { ProductPicker } from '@/components/shared/Pickers';
import { reportsApi } from '@/api/endpoints/other';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatMoney, formatQty } from '@/lib/format';
import { ReportLayout } from '@/features/reports/ReportLayout';
import type { StockMovementReportRowDto } from '@/api/dto/reports';
import { useBranchFilter } from '@/features/branches/branches';

const qty = (pick: (r: StockMovementReportRowDto) => number, bold = false) => function QuantityCell({ row }: { row: { original: StockMovementReportRowDto } }) {
  const v = pick(row.original);
  return <span className={`tabular ${bold ? 'font-semibold' : ''} ${v === 0 && !bold ? 'text-muted-foreground' : ''}`}>{formatQty(v)}</span>;
};

const columns: ColumnDef<StockMovementReportRowDto, unknown>[] = [
  { header: 'Product', accessorKey: 'productName', cell: ({ row }) => <span><span className="font-medium">{row.original.productName}</span><span className="block text-xs text-muted-foreground">{row.original.sku} · {row.original.baseUnitSymbol}</span></span> },
  { header: 'Opening', accessorKey: 'opening', meta: { align: 'right' }, cell: qty((r) => r.opening, true) },
  { header: 'Received', accessorKey: 'received', meta: { align: 'right' }, cell: qty((r) => r.received) },
  { header: 'Produced', accessorKey: 'produced', meta: { align: 'right' }, cell: qty((r) => r.produced) },
  { header: 'Sold', accessorKey: 'sold', meta: { align: 'right' }, cell: qty((r) => r.sold) },
  { header: 'Consumed', accessorKey: 'consumed', meta: { align: 'right' }, cell: qty((r) => r.consumed) },
  { header: 'Adj. in', accessorKey: 'adjustedIn', meta: { align: 'right' }, cell: qty((r) => r.adjustedIn) },
  { header: 'Adj. out', accessorKey: 'adjustedOut', meta: { align: 'right' }, cell: qty((r) => r.adjustedOut) },
  { header: 'Closing', accessorKey: 'closing', meta: { align: 'right' }, cell: qty((r) => r.closing, true) },
];

function StockMovements() {
  const key = useQueryKey();
  const branch = useBranchFilter();
  const [range, setRange] = useState(() => presetRange('month'));
  const [productId, setProductId] = useState<string | null>(null);
  const q = useQuery({ queryKey: key('reports', { movements: range, productId, branchId: branch.branchId }), queryFn: () => reportsApi.stockMovements(range.from, range.to, productId ?? undefined, branch.scope) });
  const r = q.data;
  const money = (v: number | null) => (v === null ? '—' : formatMoney(v));
  return (
    <ReportLayout
      branchFilter={branch}
      title="Stock movements"
      description="Opening to closing stock per product: what came in, went out and why. Quantities are in base units."
      filters={<><DateRangeFilter value={range} onChange={setRange} /><div className="w-64"><ProductPicker value={productId} onChange={(id) => setProductId(id)} placeholder="All products" clearable /></div></>}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
      kpis={r && (
        <>
          <StatCard label="Received (value)" value={money(r.totalReceivedValue)} />
          <StatCard label="Sold (cost)" value={money(r.totalSoldCost)} />
          <StatCard label="Consumed (cost)" value={money(r.totalConsumedCost)} />
          <StatCard label="Adjustments (net)" value={money(r.totalAdjustmentNetValue)} />
        </>
      )}
    >
      {r && (
        <DataTable
          columns={columns}
          data={r.items}
          getRowId={(i) => i.productId}
          searchable
          emptyTitle="No movements in this period"
          csv={{
            fileName: `stock-movements-${range.from}-${range.to}`,
            columns: [
              { header: 'SKU', value: (i) => i.sku }, { header: 'Product', value: (i) => i.productName }, { header: 'Unit', value: (i) => i.baseUnitSymbol },
              { header: 'Opening', value: (i) => i.opening }, { header: 'Received', value: (i) => i.received }, { header: 'Produced', value: (i) => i.produced },
              { header: 'Sold', value: (i) => i.sold }, { header: 'Consumed', value: (i) => i.consumed }, { header: 'Adjusted in', value: (i) => i.adjustedIn },
              { header: 'Adjusted out', value: (i) => i.adjustedOut }, { header: 'Closing', value: (i) => i.closing },
              { header: 'Received value', value: (i) => i.receivedValue }, { header: 'Sold cost', value: (i) => i.soldCost },
            ],
          }}
        />
      )}
    </ReportLayout>
  );
}

export default function Page() {
  return <PermissionRoute permission="InventoryReports.View"><StockMovements /></PermissionRoute>;
}
