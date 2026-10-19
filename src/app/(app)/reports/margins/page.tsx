'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText } from '@/components/shared/Display';
import { EnumSelect } from '@/components/shared/Pickers';
import { costingApi } from '@/api/endpoints/inventory';
import { humanize } from '@/api/mappers';
import { labels, type PriceType } from '@/api/enums';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatPercent } from '@/lib/format';
import { ReportLayout } from '@/features/reports/ReportLayout';
import type { MarginRowDto } from '@/api/dto/inventory';
import { useBranchFilter } from '@/features/branches/branches';

const columns: ColumnDef<MarginRowDto, unknown>[] = [
  { header: 'Product', accessorKey: 'productName', cell: ({ row }) => <span className="font-medium">{row.original.productName}</span> },
  { header: 'Unit', accessorKey: 'unitSymbol' },
  { header: 'Price list', accessorKey: 'priceType', cell: ({ row }) => humanize(row.original.priceType) },
  { header: 'Price', accessorKey: 'price', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.price} currency={false} /> },
  { header: 'Unit cost', accessorKey: 'unitCost', meta: { align: 'right' }, cell: ({ row }) => (row.original.costMissing ? <Badge variant="warning">No cost</Badge> : <MoneyText value={row.original.unitCost} currency={false} />) },
  { header: 'Margin', accessorKey: 'margin', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.margin} currency={false} className="font-medium" /> },
  { header: 'Margin %', accessorKey: 'marginPercent', meta: { align: 'right' }, cell: ({ row }) => <span className={(row.original.marginPercent ?? 0) < 0 ? 'text-destructive' : ''}>{formatPercent(row.original.marginPercent)}</span> },
];

function Margins() {
  const key = useQueryKey();
  const branch = useBranchFilter();
  const [priceType, setPriceType] = useState<PriceType | null>(null);
  const q = useQuery({ queryKey: key('reports', { margins: priceType, branchId: branch.branchId }), queryFn: () => costingApi.margins(priceType ?? undefined, branch.scope) });
  return (
    <ReportLayout
      branchFilter={branch}
      title="Margins"
      description="Current price against average cost, per product, unit and price list. Negative margins sell at a loss."
      filters={<EnumSelect map={labels.priceType} value={priceType} onChange={setPriceType} placeholder="All price lists" className="w-40" aria-label="Price list" />}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
    >
      <DataTable
        columns={columns}
        data={q.data}
        getRowId={(r) => `${r.productId}-${r.unitOfMeasureId}-${r.priceType}`}
        searchable
        rowClassName={(r) => (r.margin < 0 ? 'bg-destructive/5' : r.costMissing ? 'bg-warning/5' : undefined)}
        emptyTitle="No priced products"
        csv={{
          fileName: 'margins',
          columns: [
            { header: 'SKU', value: (r) => r.sku }, { header: 'Product', value: (r) => r.productName }, { header: 'Unit', value: (r) => r.unitSymbol },
            { header: 'Price list', value: (r) => r.priceType }, { header: 'Price', value: (r) => r.price }, { header: 'Unit cost', value: (r) => r.unitCost },
            { header: 'Margin', value: (r) => r.margin }, { header: 'Margin %', value: (r) => r.marginPercent }, { header: 'Cost missing', value: (r) => r.costMissing },
          ],
        }}
      />
    </ReportLayout>
  );
}

export default function Page() {
  return <PermissionRoute permission="Costing.View"><Margins /></PermissionRoute>;
}
