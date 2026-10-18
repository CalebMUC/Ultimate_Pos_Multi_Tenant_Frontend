'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, QuantityText, StatCard } from '@/components/shared/Display';
import { DateRangeFilter, presetRange } from '@/components/shared/DateRange';
import { SupplierPicker } from '@/components/shared/Pickers';
import { ShareList } from '@/components/shared/Charts';
import { reportsApi } from '@/api/endpoints/other';
import { humanize } from '@/api/mappers';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatMoney } from '@/lib/format';
import { sum } from '@/lib/utils';
import { ReportLayout } from '@/features/reports/ReportLayout';
import type { PurchaseByProductDto, PurchaseBySupplierDto } from '@/api/dto/reports';

const suppliers: ColumnDef<PurchaseBySupplierDto, unknown>[] = [
  { header: 'Supplier', accessorKey: 'supplierName', cell: ({ row }) => <span className="font-medium">{row.original.supplierName}</span> },
  { header: 'Orders', accessorKey: 'orderCount', meta: { align: 'right' } },
  { header: 'Ordered', accessorKey: 'orderedValue', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.orderedValue} currency={false} /> },
  { header: 'Received', accessorKey: 'receivedValue', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.receivedValue} currency={false} /> },
  { header: 'Outstanding', accessorKey: 'outstandingValue', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.outstandingValue} currency={false} /> },
  { header: 'Share', accessorKey: 'percentOfOrdered', meta: { align: 'right' }, cell: ({ row }) => `${row.original.percentOfOrdered.toFixed(1)}%` },
];
const products: ColumnDef<PurchaseByProductDto, unknown>[] = [
  { header: 'Product', accessorKey: 'productName', cell: ({ row }) => <span className="font-medium">{row.original.productName}</span> },
  { header: 'Ordered', accessorKey: 'quantityOrdered', meta: { align: 'right' }, cell: ({ row }) => <QuantityText value={row.original.quantityOrdered} unit={row.original.unitSymbol} /> },
  { header: 'Received', accessorKey: 'quantityReceived', meta: { align: 'right' }, cell: ({ row }) => <QuantityText value={row.original.quantityReceived} unit={row.original.unitSymbol} /> },
  { header: 'Avg cost', accessorKey: 'averageUnitCost', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.averageUnitCost} currency={false} /> },
  { header: 'Value', accessorKey: 'orderedValue', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.orderedValue} currency={false} /> },
];

function Purchases() {
  const key = useQueryKey();
  const [range, setRange] = useState(() => presetRange('month'));
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const q = useQuery({ queryKey: key('reports', { purchases: range, supplierId }), queryFn: () => reportsApi.purchaseSummary(range.from, range.to, supplierId ?? undefined) });
  const r = q.data;
  const statusTotal = r ? sum(r.byStatus, (s) => s.orderedValue) : 0;
  return (
    <ReportLayout
      title="Purchases"
      description="What was ordered and received, by supplier and product."
      filters={<><DateRangeFilter value={range} onChange={setRange} /><div className="w-56"><SupplierPicker value={supplierId} onChange={(id) => setSupplierId(id)} placeholder="All suppliers" clearable /></div></>}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
      kpis={r && (
        <>
          <StatCard label="Ordered" value={formatMoney(r.orderedValue)} hint={`${r.orderCount} order(s)`} />
          <StatCard label="Received" value={formatMoney(r.receivedValue)} />
          <StatCard label="Still to come" value={formatMoney(r.outstandingValue)} tone={r.outstandingValue ? 'warning' : 'default'} />
          <StatCard label="Cancelled" value={formatMoney(r.cancelledValue)} hint={`${r.cancelledCount} order(s)`} />
        </>
      )}
    >
      {r && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>By status</CardTitle></CardHeader>
              <CardContent><ShareList items={r.byStatus.map((s) => ({ label: humanize(s.status), value: s.orderedValue, percent: statusTotal ? (s.orderedValue / statusTotal) * 100 : 0, hint: `${s.orderCount}` }))} /></CardContent>
            </Card>
            <div className="space-y-2 lg:col-span-2">
              <h2 className="font-semibold">By supplier</h2>
              <DataTable columns={suppliers} data={r.bySupplier} getRowId={(s) => s.supplierId} emptyTitle="No purchases" csv={{ fileName: `purchases-by-supplier-${range.from}-${range.to}`, columns: [{ header: 'Supplier', value: (s) => s.supplierName }, { header: 'Orders', value: (s) => s.orderCount }, { header: 'Ordered', value: (s) => s.orderedValue }, { header: 'Received', value: (s) => s.receivedValue }, { header: 'Outstanding', value: (s) => s.outstandingValue }] }} />
            </div>
          </div>
          <h2 className="font-semibold">Top products</h2>
          <DataTable columns={products} data={r.topProducts} getRowId={(p) => `${p.productId}-${p.unitOfMeasureId}`} emptyTitle="No purchases" csv={{ fileName: `purchases-by-product-${range.from}-${range.to}`, columns: [{ header: 'SKU', value: (p) => p.sku }, { header: 'Product', value: (p) => p.productName }, { header: 'Unit', value: (p) => p.unitSymbol }, { header: 'Ordered', value: (p) => p.quantityOrdered }, { header: 'Received', value: (p) => p.quantityReceived }, { header: 'Avg cost', value: (p) => p.averageUnitCost }, { header: 'Value', value: (p) => p.orderedValue }] }} />
        </>
      )}
    </ReportLayout>
  );
}

export default function Page() {
  return <PermissionRoute permission="PurchaseReports.View"><Purchases /></PermissionRoute>;
}
