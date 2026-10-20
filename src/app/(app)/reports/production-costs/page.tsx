'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { ShareList } from '@/components/shared/Charts';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, StatCard } from '@/components/shared/Display';
import { DateRangeFilter, presetRange } from '@/components/shared/DateRange';
import { ProductPicker } from '@/components/shared/Pickers';
import { reportsApi } from '@/api/endpoints/other';
import { humanize } from '@/api/mappers';
import { ItemType } from '@/api/enums';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatMoney, formatPercent, formatQty } from '@/lib/format';
import { ReportLayout } from '@/features/reports/ReportLayout';
import type { ProductionCostByProductDto } from '@/api/dto/reports';
import { useBranchFilter } from '@/features/branches/branches';

const columns: ColumnDef<ProductionCostByProductDto, unknown>[] = [
  { header: 'Product', accessorKey: 'productName', cell: ({ row }) => <span className="font-medium">{row.original.productName}</span> },
  { header: 'Runs', accessorKey: 'runCount', meta: { align: 'right' } },
  { header: 'Produced', accessorKey: 'quantityProduced', meta: { align: 'right' }, cell: ({ row }) => formatQty(row.original.quantityProduced, row.original.unitSymbol) },
  { header: 'Yield', accessorKey: 'yieldPercent', meta: { align: 'right' }, cell: ({ row }) => formatPercent(row.original.yieldPercent) },
  { header: 'Total cost', accessorKey: 'totalCost', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.totalCost} currency={false} /> },
  { header: 'Avg / unit', accessorKey: 'averageCostPerUnit', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.averageCostPerUnit} currency={false} className="font-medium" /> },
  { header: 'Low–high', id: 'range', meta: { align: 'right' }, cell: ({ row }) => <span className="tabular text-xs">{formatMoney(row.original.lowestCostPerUnit, { currency: false })} – {formatMoney(row.original.highestCostPerUnit, { currency: false })}</span> },
  { header: 'Latest', accessorKey: 'latestCostPerUnit', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.latestCostPerUnit} currency={false} /> },
];

function ProductionCosts() {
  const key = useQueryKey();
  const branch = useBranchFilter();
  const [range, setRange] = useState(() => presetRange('month'));
  const [productId, setProductId] = useState<string | null>(null);
  const q = useQuery({ queryKey: key('reports', { productionCosts: range, productId, branchId: branch.branchId }), queryFn: () => reportsApi.productionCosts(range.from, range.to, productId ?? undefined, branch.scope) });
  const r = q.data;
  return (
    <ReportLayout
      branchFilter={branch}
      title="Production costs"
      description="What each product cost to make, and where the money went."
      filters={<><DateRangeFilter value={range} onChange={setRange} /><div className="w-64"><ProductPicker value={productId} filter={{ itemType: ItemType.FinishedGood }} onChange={(id) => setProductId(id)} placeholder="All products" clearable /></div></>}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
      kpis={r && (
        <>
          <StatCard label="Runs" value={r.runCount} />
          <StatCard label="Materials" value={formatMoney(r.materialCost)} />
          <StatCard label="Other costs" value={formatMoney(r.additionalCost)} />
          <StatCard label="Total" value={formatMoney(r.totalCost)} />
        </>
      )}
    >
      {r && (
        <>
          <DataTable
            columns={columns}
            data={r.byProduct}
            getRowId={(p) => `${p.productId}-${p.unitOfMeasureId}`}
            emptyTitle="No production in this period"
            csv={{
              fileName: `production-costs-${range.from}-${range.to}`,
              columns: [
                { header: 'SKU', value: (p) => p.sku }, { header: 'Product', value: (p) => p.productName }, { header: 'Runs', value: (p) => p.runCount },
                { header: 'Produced', value: (p) => p.quantityProduced }, { header: 'Unit', value: (p) => p.unitSymbol }, { header: 'Yield %', value: (p) => p.yieldPercent },
                { header: 'Material cost', value: (p) => p.materialCost }, { header: 'Other cost', value: (p) => p.additionalCost }, { header: 'Total cost', value: (p) => p.totalCost },
                { header: 'Average per unit', value: (p) => p.averageCostPerUnit }, { header: 'Latest per unit', value: (p) => p.latestCostPerUnit },
              ],
            }}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Top ingredients by cost</CardTitle></CardHeader>
              <CardContent><ShareList items={r.topIngredients.map((i) => ({ label: i.ingredientName, value: i.totalCost, percent: i.percentOfMaterialCost, hint: formatQty(i.quantityInBaseUnits, i.baseUnitSymbol) }))} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Other costs by type</CardTitle></CardHeader>
              <CardContent>
                {r.additionalCostsByType.length ? <ShareList items={r.additionalCostsByType.map((c) => ({ label: humanize(c.costType), value: c.amount, percent: c.percentOfAdditionalCost }))} /> : <p className="text-sm text-muted-foreground">None recorded.</p>}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </ReportLayout>
  );
}

export default function Page() {
  return <PermissionRoute permission="ProductionReports.View" module="production"><ProductionCosts /></PermissionRoute>;
}
