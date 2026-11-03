'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { Badge, Skeleton } from '@/components/ui/primitives';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import type { DateRangeValue } from '@/components/shared/DateRange';
import { MoneyText, QuantityText, StatCard } from '@/components/shared/Display';
import { costingApi } from '@/api/endpoints/inventory';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateOnly, formatMoney, formatPercent } from '@/lib/format';
import { useReturnFocus } from '@/features/dashboard/useReturnFocus';
import { dayBounds } from '@/features/reports/ReportLayout';
import type { BranchFilter } from '@/features/branches/branches';
import type { ProfitRowDto } from '@/api/dto/inventory';

/** The goods behind the dashboard's Cost of goods sold card, for the same dates and branch. */
export function CostOfGoodsDialog({ open, onOpenChange, range, branch }: { open: boolean; onOpenChange(open: boolean): void; range: DateRangeValue; branch: BranchFilter }) {
  const key = useQueryKey();
  const canProducts = usePermission('Products.View');
  const returnFocus = useReturnFocus();
  const { start, end } = dayBounds(range.from, range.to);
  const q = useQuery({
    queryKey: key('dashboard', { costOfGoods: range, branchId: branch.branchId }),
    queryFn: () => costingApi.profit(start, end, undefined, branch.scope),
    enabled: open,
  });
  const r = q.data;
  const rows = useMemo(() => r && [...r.items].sort((a, b) => b.cost - a.cost), [r]);

  const columns = useMemo<ColumnDef<ProfitRowDto, unknown>[]>(() => [
    {
      header: 'Product',
      accessorKey: 'productName',
      cell: ({ row }) => (
        <span className="flex flex-wrap items-center gap-2">
          {canProducts
            ? <Link href={`/products/${row.original.productId}`} className="font-medium hover:underline">{row.original.productName}</Link>
            : <span className="font-medium">{row.original.productName}</span>}
          {row.original.uncostedRevenue > 0 && <Badge variant="warning" title="Some of these sales have no recorded cost, so they are left out of Cost.">No cost recorded</Badge>}
        </span>
      ),
    },
    { header: 'Qty sold', accessorKey: 'quantitySoldInBaseUnits', meta: { align: 'right' }, cell: ({ row }) => <QuantityText value={row.original.quantitySoldInBaseUnits} unit={row.original.baseUnitSymbol} /> },
    { header: 'Cost', accessorKey: 'cost', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.cost} currency={false} className="font-medium" /> },
    { header: 'Revenue', accessorKey: 'revenue', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.revenue} currency={false} /> },
    { header: 'Gross profit', accessorKey: 'grossProfit', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.grossProfit} currency={false} /> },
    { header: 'Margin', accessorKey: 'marginPercent', meta: { align: 'right' }, cell: ({ row }) => formatPercent(row.original.marginPercent) },
  ], [canProducts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="grid-cols-[minmax(0,1fr)]" {...returnFocus}>
        <DialogHeader>
          <DialogTitle>Cost of goods sold</DialogTitle>
          <DialogDescription>{formatDateOnly(range.from)} – {formatDateOnly(range.to)}. Revenue excludes VAT.</DialogDescription>
        </DialogHeader>
        {r ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Total cost" value={formatMoney(r.totalCost)} />
          </div>
        ) : q.isLoading && <Skeleton className="h-[88px]" />}
        <DataTable
          columns={columns}
          data={rows}
          isLoading={q.isLoading}
          error={q.error}
          onRetry={() => q.refetch()}
          getRowId={(x) => x.productId}
          searchable
          emptyTitle="No sales in this period."
          csv={{
            fileName: `cost-of-goods-${range.from}-${range.to}`,
            columns: [
              { header: 'SKU', value: (x) => x.sku }, { header: 'Product', value: (x) => x.productName }, { header: 'Qty', value: (x) => x.quantitySoldInBaseUnits },
              { header: 'Unit', value: (x) => x.baseUnitSymbol }, { header: 'Cost', value: (x) => x.cost }, { header: 'Revenue', value: (x) => x.revenue },
              { header: 'Gross profit', value: (x) => x.grossProfit }, { header: 'Margin %', value: (x) => x.marginPercent }, { header: 'Uncosted revenue', value: (x) => x.uncostedRevenue },
            ],
          }}
        />
        <DialogFooter>
          <Button variant="link" asChild><Link href="/reports/profit">Profit by product</Link></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
