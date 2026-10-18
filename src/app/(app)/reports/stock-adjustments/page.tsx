'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, StatCard } from '@/components/shared/Display';
import { DateRangeFilter, presetRange } from '@/components/shared/DateRange';
import { ProductPicker } from '@/components/shared/Pickers';
import { reportsApi } from '@/api/endpoints/other';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateTime, formatMoney, formatQty } from '@/lib/format';
import { ReportLayout } from '@/features/reports/ReportLayout';
import type { StockAdjustmentItemDto } from '@/api/dto/reports';

const columns: ColumnDef<StockAdjustmentItemDto, unknown>[] = [
  { header: 'When', accessorKey: 'createdAt', cell: ({ row }) => formatDateTime(row.original.createdAt) },
  { header: 'Product', accessorKey: 'productName', cell: ({ row }) => <span className="font-medium">{row.original.productName}</span> },
  {
    header: 'Change',
    accessorKey: 'quantityChange',
    meta: { align: 'right' },
    cell: ({ row }) => <span className={`tabular font-medium ${row.original.quantityChange < 0 ? 'text-destructive' : 'text-success'}`}>{row.original.quantityChange > 0 ? '+' : ''}{formatQty(row.original.quantityChange, row.original.baseUnitSymbol)}</span>,
  },
  { header: 'Value', accessorKey: 'value', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.value} currency={false} /> },
  { header: 'Reason', accessorKey: 'reason', meta: { className: 'max-w-xs truncate' }, cell: ({ row }) => row.original.reason ?? '' },
  { header: 'By', accessorKey: 'adjustedBy', cell: ({ row }) => row.original.adjustedBy ?? '—' },
];

function StockAdjustments() {
  const key = useQueryKey();
  const [range, setRange] = useState(() => presetRange('month'));
  const [productId, setProductId] = useState<string | null>(null);
  const q = useQuery({ queryKey: key('reports', { adjustments: range, productId }), queryFn: () => reportsApi.stockAdjustments(range.from, range.to, productId ?? undefined) });
  const r = q.data;
  const money = (v: number | null) => (v === null ? '—' : formatMoney(v));
  return (
    <ReportLayout
      title="Stock adjustments"
      description="Every manual change to stock, who made it and why."
      filters={<><DateRangeFilter value={range} onChange={setRange} /><div className="w-64"><ProductPicker value={productId} onChange={(id) => setProductId(id)} placeholder="All products" clearable /></div></>}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
      kpis={r && (
        <>
          <StatCard label="Adjustments" value={r.adjustmentCount} hint={`${r.increaseCount} in · ${r.decreaseCount} out`} />
          <StatCard label="Added (value)" value={money(r.increaseValue)} />
          <StatCard label="Removed (value)" value={money(r.decreaseValue)} />
          <StatCard label="Net" value={money(r.netValue)} tone={(r.netValue ?? 0) < 0 ? 'destructive' : 'default'} />
        </>
      )}
    >
      {r?.truncated && <Alert variant="warning"><AlertTriangle /><AlertDescription>Only the most recent adjustments are listed. Narrow the dates to see them all.</AlertDescription></Alert>}
      {r && (
        <DataTable
          columns={columns}
          data={r.items}
          getRowId={(i) => i.stockMovementId}
          searchable
          emptyTitle="No adjustments in this period"
          csv={{
            fileName: `stock-adjustments-${range.from}-${range.to}`,
            columns: [
              { header: 'When', value: (i) => i.createdAt }, { header: 'SKU', value: (i) => i.sku }, { header: 'Product', value: (i) => i.productName },
              { header: 'Change', value: (i) => i.quantityChange }, { header: 'Unit', value: (i) => i.baseUnitSymbol }, { header: 'Unit cost', value: (i) => i.unitCost },
              { header: 'Value', value: (i) => i.value }, { header: 'Reason', value: (i) => i.reason }, { header: 'By', value: (i) => i.adjustedBy },
            ],
          }}
        />
      )}
    </ReportLayout>
  );
}

export default function Page() {
  return <PermissionRoute permission="InventoryReports.View"><StockAdjustments /></PermissionRoute>;
}
