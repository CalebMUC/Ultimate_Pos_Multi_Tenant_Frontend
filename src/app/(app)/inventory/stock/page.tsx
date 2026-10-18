'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/overlays';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/primitives';
import { PageHeader, QuantityText } from '@/components/shared/Display';
import { stockApi } from '@/api/endpoints/inventory';
import { useQueryKey } from '@/hooks/useSessionInfo';
import type { StockLevelDto } from '@/api/dto/inventory';

const columns: ColumnDef<StockLevelDto, unknown>[] = [
  { header: 'Product', accessorKey: 'productName', cell: ({ row }) => <span className="font-medium">{row.original.productName}</span> },
  { header: 'SKU', accessorKey: 'sku', cell: ({ row }) => <code className="text-xs">{row.original.sku}</code> },
  { header: 'On hand', accessorKey: 'quantityOnHand', meta: { align: 'right' }, cell: ({ row }) => <QuantityText value={row.original.quantityOnHand} unit={row.original.baseUnitSymbol} className="font-medium" /> },
  {
    header: 'Sellable',
    accessorKey: 'sellableQuantity',
    meta: { align: 'right' },
    cell: ({ row }) => (row.original.isBatchTracked ? <QuantityText value={row.original.sellableQuantity} unit={row.original.baseUnitSymbol} /> : <span className="text-muted-foreground">—</span>),
  },
  { header: 'Reorder at', accessorKey: 'reorderLevel', meta: { align: 'right' }, cell: ({ row }) => <QuantityText value={row.original.reorderLevel} unit={row.original.baseUnitSymbol} /> },
  {
    header: 'Status',
    id: 'status',
    accessorFn: (r) => (r.quantityOnHand <= 0 ? 0 : r.belowReorderLevel ? 1 : 2),
    cell: ({ row }) =>
      row.original.quantityOnHand <= 0 ? <Badge variant="destructive">Out of stock</Badge>
        : row.original.belowReorderLevel ? <Badge variant="warning">Reorder</Badge>
          : <Badge variant="success">OK</Badge>,
  },
];

function StockLevels() {
  const router = useRouter();
  const key = useQueryKey();
  const [lowOnly, setLowOnly] = useState(false);
  const query = useQuery({ queryKey: key('stock', { levels: true, lowOnly }), queryFn: () => stockApi.levels(lowOnly) });
  return (
    <>
      <PageHeader
        title="Stock levels"
        description="Quantity on hand per product, in its base unit. Batch-tracked products also show what is unexpired."
        actions={<Can permission="Stock.Adjust"><Button asChild><Link href="/inventory/adjustments"><SlidersHorizontal />Adjust stock</Link></Button></Can>}
      />
      <DataTable
        columns={columns}
        data={query.data}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        getRowId={(s) => s.productId}
        onRowClick={(s) => router.push(`/products/${s.productId}`)}
        searchable
        searchPlaceholder="Product or SKU…"
        emptyTitle={lowOnly ? 'Nothing below its reorder level' : 'No stock yet'}
        rowClassName={(s) => (s.quantityOnHand <= 0 ? 'bg-destructive/5' : s.belowReorderLevel ? 'bg-warning/5' : undefined)}
        toolbar={
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={lowOnly} onCheckedChange={(v) => setLowOnly(v === true)} />Below reorder level only
          </label>
        }
        csv={{
          fileName: 'stock-levels',
          columns: [
            { header: 'SKU', value: (s) => s.sku },
            { header: 'Product', value: (s) => s.productName },
            { header: 'On hand', value: (s) => s.quantityOnHand },
            { header: 'Sellable', value: (s) => s.sellableQuantity },
            { header: 'Unit', value: (s) => s.baseUnitSymbol },
            { header: 'Reorder level', value: (s) => s.reorderLevel },
            { header: 'Below reorder', value: (s) => s.belowReorderLevel },
          ],
        }}
      />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Stock.View"><StockLevels /></PermissionRoute>;
}
