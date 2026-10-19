'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { NativeSelect } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, QuantityText, StatCard, StatusBadge } from '@/components/shared/Display';
import { CategorySelect, EnumSelect } from '@/components/shared/Pickers';
import { reportsApi } from '@/api/endpoints/other';
import { humanize } from '@/api/mappers';
import { labels, type ItemType, type StockStatus } from '@/api/enums';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatMoney, formatQty } from '@/lib/format';
import { ReportLayout } from '@/features/reports/ReportLayout';
import type { StockStatusItemDto } from '@/api/dto/reports';
import { useBranchFilter } from '@/features/branches/branches';

const columns: ColumnDef<StockStatusItemDto, unknown>[] = [
  { header: 'Product', accessorKey: 'productName', cell: ({ row }) => <span><span className="font-medium">{row.original.productName}</span><span className="block text-xs text-muted-foreground">{row.original.sku} · {row.original.category}</span></span> },
  { header: 'Type', accessorKey: 'itemType', cell: ({ row }) => humanize(row.original.itemType) },
  { header: 'On hand', accessorKey: 'quantityOnHand', meta: { align: 'right' }, cell: ({ row }) => <QuantityText value={row.original.quantityOnHand} unit={row.original.baseUnitSymbol} /> },
  { header: 'Reorder', accessorKey: 'reorderLevel', meta: { align: 'right' }, cell: ({ row }) => formatQty(row.original.reorderLevel) },
  { header: 'Short', accessorKey: 'shortfall', meta: { align: 'right' }, cell: ({ row }) => (row.original.shortfall > 0 ? formatQty(row.original.shortfall) : '') },
  { header: 'Daily use', accessorKey: 'averageDailyUsage', meta: { align: 'right' }, cell: ({ row }) => formatQty(row.original.averageDailyUsage) },
  { header: 'Days of cover', accessorKey: 'daysOfCover', meta: { align: 'right' }, cell: ({ row }) => (row.original.daysOfCover === null ? '∞' : Math.round(row.original.daysOfCover)) },
  { header: 'Value', accessorKey: 'stockValue', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.stockValue} currency={false} /> },
  { header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge kind="stock" value={row.original.status as StockStatus} /> },
];

function StockStatusReport() {
  const router = useRouter();
  const key = useQueryKey();
  const branch = useBranchFilter();
  const [itemType, setItemType] = useState<ItemType | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<StockStatus | ''>('');
  const [usageDays, setUsageDays] = useState(30);
  const params = { itemType: itemType ?? undefined, categoryId: categoryId || undefined, status: status || undefined, usageDays };
  const q = useQuery({ queryKey: key('reports', { stockStatus: params, branchId: branch.branchId }), queryFn: () => reportsApi.stockStatus({ ...params, ...branch.scope }) });
  const r = q.data;
  return (
    <ReportLayout
      branchFilter={branch}
      title="Stock status"
      description="What is in stock, low or out, and how many days it will last at recent usage."
      filters={
        <>
          <EnumSelect map={labels.itemType} value={itemType} onChange={setItemType} placeholder="All types" className="w-36" aria-label="Item type" />
          <CategorySelect value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder="All categories" className="w-44" aria-label="Category" />
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as StockStatus | '')} className="w-36" aria-label="Status">
            <option value="">Any status</option><option value="InStock">In stock</option><option value="LowStock">Low stock</option><option value="OutOfStock">Out of stock</option>
          </NativeSelect>
          <NativeSelect value={usageDays} onChange={(e) => setUsageDays(Number(e.target.value))} className="w-44" aria-label="Usage period">
            {[7, 30, 60, 90].map((d) => <option key={d} value={d}>Usage over {d} days</option>)}
          </NativeSelect>
        </>
      }
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
      kpis={r && (
        <>
          <StatCard label="Products" value={r.productCount} hint={`${r.inStockCount} in stock`} />
          <StatCard label="Low stock" value={r.lowStockCount} tone={r.lowStockCount ? 'warning' : 'success'} />
          <StatCard label="Out of stock" value={r.outOfStockCount} tone={r.outOfStockCount ? 'destructive' : 'success'} />
          <StatCard label="Stock value" value={r.totalStockValue === null ? '—' : formatMoney(r.totalStockValue)} hint={r.productsMissingCost ? `${r.productsMissingCost} missing cost` : undefined} />
        </>
      )}
    >
      {r && (
        <DataTable
          columns={columns}
          data={r.items}
          getRowId={(i) => i.productId}
          onRowClick={(i) => router.push(`/products/${i.productId}`)}
          searchable
          rowClassName={(i) => (i.status === 'OutOfStock' ? 'bg-destructive/5' : i.status === 'LowStock' ? 'bg-warning/5' : undefined)}
          emptyTitle="No products match"
          csv={{
            fileName: 'stock-status',
            columns: [
              { header: 'SKU', value: (i) => i.sku }, { header: 'Product', value: (i) => i.productName }, { header: 'Type', value: (i) => i.itemType },
              { header: 'Category', value: (i) => i.category }, { header: 'On hand', value: (i) => i.quantityOnHand }, { header: 'Unit', value: (i) => i.baseUnitSymbol },
              { header: 'Reorder level', value: (i) => i.reorderLevel }, { header: 'Shortfall', value: (i) => i.shortfall }, { header: 'Daily usage', value: (i) => i.averageDailyUsage },
              { header: 'Days of cover', value: (i) => i.daysOfCover }, { header: 'Value', value: (i) => i.stockValue }, { header: 'Status', value: (i) => i.status },
            ],
          }}
        />
      )}
    </ReportLayout>
  );
}

export default function Page() {
  return <PermissionRoute permission="InventoryReports.View"><StockStatusReport /></PermissionRoute>;
}
