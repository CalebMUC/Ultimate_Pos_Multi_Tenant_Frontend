'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Boxes, Coins } from 'lucide-react';
import { Badge } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, PageHeader, QuantityText, StatCard } from '@/components/shared/Display';
import { EnumSelect } from '@/components/shared/Pickers';
import { costingApi } from '@/api/endpoints/inventory';
import { humanize } from '@/api/mappers';
import { labels, type ItemType } from '@/api/enums';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatMoney } from '@/lib/format';
import type { StockValuationRowDto } from '@/api/dto/inventory';
import { useBranchFilter } from '@/features/branches/branches';

const columns: ColumnDef<StockValuationRowDto, unknown>[] = [
  { header: 'Product', accessorKey: 'productName', cell: ({ row }) => <span className="font-medium">{row.original.productName}</span> },
  { header: 'SKU', accessorKey: 'sku', cell: ({ row }) => <code className="text-xs">{row.original.sku}</code> },
  { header: 'Type', accessorKey: 'itemType', cell: ({ row }) => humanize(row.original.itemType) },
  { header: 'On hand', accessorKey: 'quantityOnHand', meta: { align: 'right' }, cell: ({ row }) => <QuantityText value={row.original.quantityOnHand} /> },
  {
    header: 'Avg unit cost',
    accessorKey: 'averageUnitCost',
    meta: { align: 'right' },
    cell: ({ row }) => (row.original.costMissing ? <Badge variant="warning">No cost</Badge> : <MoneyText value={row.original.averageUnitCost} currency={false} />),
  },
  { header: 'Value', accessorKey: 'stockValue', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.stockValue} className="font-medium" /> },
];

function Valuation() {
  const router = useRouter();
  const key = useQueryKey();
  const branch = useBranchFilter();
  const [itemType, setItemType] = useState<ItemType | null>(null);
  const query = useQuery({ queryKey: key('stock', { valuation: itemType, branchId: branch.branchId }), queryFn: () => costingApi.stockValuation(itemType ?? undefined, branch.scope) });
  const d = query.data;
  return (
    <>
      <PageHeader title="Stock valuation" description="What stock on hand is worth at weighted-average cost." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total stock value" value={d ? formatMoney(d.totalStockValue) : '—'} icon={<Coins />} />
        {d?.totalsByItemType.map((t) => (
          <StatCard key={t.itemType} label={humanize(t.itemType)} value={formatMoney(t.stockValue)} hint={`${t.productCount} product(s)`} icon={<Boxes />} />
        ))}
        {d && d.productsMissingCost > 0 && <StatCard label="Missing cost" value={d.productsMissingCost} hint="Valued at zero: revalue them." icon={<AlertTriangle />} tone="warning" />}
      </div>
      <DataTable
        branchFilter={branch}
        columns={columns}
        data={d?.items}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        getRowId={(r) => r.productId}
        onRowClick={(r) => router.push(`/products/${r.productId}`)}
        searchable
        rowClassName={(r) => (r.costMissing ? 'bg-warning/5' : undefined)}
        toolbar={<EnumSelect map={labels.itemType} value={itemType} onChange={setItemType} placeholder="All item types" className="w-40" aria-label="Item type" />}
        emptyTitle="No stock to value"
        csv={{
          fileName: 'stock-valuation',
          columns: [
            { header: 'SKU', value: (r) => r.sku },
            { header: 'Product', value: (r) => r.productName },
            { header: 'Type', value: (r) => r.itemType },
            { header: 'On hand', value: (r) => r.quantityOnHand },
            { header: 'Average unit cost', value: (r) => r.averageUnitCost },
            { header: 'Value', value: (r) => r.stockValue },
            { header: 'Cost missing', value: (r) => r.costMissing },
          ],
        }}
      />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Costing.View"><Valuation /></PermissionRoute>;
}
