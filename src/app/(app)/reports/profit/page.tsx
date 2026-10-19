'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { DateRangeFilter, presetRange } from '@/components/shared/DateRange';
import { MoneyText, QuantityText, StatCard } from '@/components/shared/Display';
import { ProductPicker } from '@/components/shared/Pickers';
import { costingApi } from '@/api/endpoints/inventory';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatMoney, formatPercent } from '@/lib/format';
import { dayBounds, ReportLayout } from '@/features/reports/ReportLayout';
import type { ProfitRowDto } from '@/api/dto/inventory';
import { useBranchFilter } from '@/features/branches/branches';

const columns: ColumnDef<ProfitRowDto, unknown>[] = [
  { header: 'Product', accessorKey: 'productName', cell: ({ row }) => <span className="font-medium">{row.original.productName}</span> },
  { header: 'Qty sold', accessorKey: 'quantitySoldInBaseUnits', meta: { align: 'right' }, cell: ({ row }) => <QuantityText value={row.original.quantitySoldInBaseUnits} /> },
  { header: 'Revenue', accessorKey: 'revenue', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.revenue} currency={false} /> },
  { header: 'Cost', accessorKey: 'cost', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.cost} currency={false} /> },
  { header: 'Gross profit', accessorKey: 'grossProfit', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.grossProfit} currency={false} className="font-medium" /> },
  { header: 'Margin', accessorKey: 'marginPercent', meta: { align: 'right' }, cell: ({ row }) => formatPercent(row.original.marginPercent) },
  { header: 'Uncosted', accessorKey: 'uncostedRevenue', meta: { align: 'right' }, cell: ({ row }) => (row.original.uncostedRevenue ? <MoneyText value={row.original.uncostedRevenue} currency={false} className="text-warning" /> : '') },
];

function Profit() {
  const key = useQueryKey();
  const branch = useBranchFilter();
  const [range, setRange] = useState(() => presetRange('month'));
  const [productId, setProductId] = useState<string | null>(null);
  const { start, end } = dayBounds(range.from, range.to);
  const q = useQuery({ queryKey: key('reports', { profit: range, productId, branchId: branch.branchId }), queryFn: () => costingApi.profit(start, end, productId ?? undefined, branch.scope) });
  const r = q.data;
  return (
    <ReportLayout
      branchFilter={branch}
      title="Profit by product"
      description="Revenue, cost and margin per product sold. Up to 366 days at a time."
      filters={<><DateRangeFilter value={range} onChange={setRange} /><div className="w-64"><ProductPicker value={productId} onChange={(id) => setProductId(id)} placeholder="All products" clearable /></div></>}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
      kpis={r && (
        <>
          <StatCard label="Revenue" value={formatMoney(r.totalRevenue)} />
          <StatCard label="Cost" value={formatMoney(r.totalCost)} />
          <StatCard label="Gross profit" value={formatMoney(r.grossProfit)} hint={`Margin ${formatPercent(r.marginPercent)}`} tone={r.grossProfit < 0 ? 'destructive' : 'success'} />
          <StatCard label="Uncosted revenue" value={formatMoney(r.uncostedRevenue)} tone={r.uncostedRevenue ? 'warning' : 'default'} />
        </>
      )}
    >
      {r && (
        <DataTable
          columns={columns}
          data={r.items}
          getRowId={(x) => x.productId}
          searchable
          emptyTitle="No sales in this period"
          csv={{
            fileName: `profit-${range.from}-${range.to}`,
            columns: [
              { header: 'SKU', value: (x) => x.sku }, { header: 'Product', value: (x) => x.productName }, { header: 'Qty', value: (x) => x.quantitySoldInBaseUnits },
              { header: 'Revenue', value: (x) => x.revenue }, { header: 'Cost', value: (x) => x.cost }, { header: 'Gross profit', value: (x) => x.grossProfit },
              { header: 'Margin %', value: (x) => x.marginPercent }, { header: 'Uncosted revenue', value: (x) => x.uncostedRevenue },
            ],
          }}
        />
      )}
    </ReportLayout>
  );
}

export default function Page() {
  return <PermissionRoute permission="Costing.View"><Profit /></PermissionRoute>;
}
