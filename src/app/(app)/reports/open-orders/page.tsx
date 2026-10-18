'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, StatCard } from '@/components/shared/Display';
import { SupplierPicker } from '@/components/shared/Pickers';
import { reportsApi } from '@/api/endpoints/other';
import { humanize } from '@/api/mappers';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateOnly, formatMoney } from '@/lib/format';
import { ReportLayout } from '@/features/reports/ReportLayout';
import type { OpenOrderDto } from '@/api/dto/reports';

const columns: ColumnDef<OpenOrderDto, unknown>[] = [
  { header: 'Order', accessorKey: 'orderNumber', cell: ({ row }) => <span className="font-medium">{row.original.orderNumber}</span> },
  { header: 'Supplier', accessorKey: 'supplierName' },
  { header: 'Status', accessorKey: 'status', cell: ({ row }) => humanize(row.original.status) },
  { header: 'Ordered', accessorKey: 'orderDate', cell: ({ row }) => `${formatDateOnly(row.original.orderDate)} (${row.original.ageDays}d)` },
  {
    header: 'Expected',
    accessorKey: 'expectedDeliveryDate',
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        {formatDateOnly(row.original.expectedDeliveryDate)}
        {row.original.isOverdue && <Badge variant="destructive">{row.original.daysOverdue}d late</Badge>}
      </span>
    ),
  },
  { header: 'Lines open', id: 'lines', cell: ({ row }) => row.original.lines.filter((l) => l.quantityOutstanding > 0).length },
  { header: 'Outstanding', accessorKey: 'outstandingValue', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.outstandingValue} className="font-medium" /> },
];

function OpenOrders() {
  const router = useRouter();
  const key = useQueryKey();
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const q = useQuery({ queryKey: key('reports', { openOrders: supplierId }), queryFn: () => reportsApi.openOrders(supplierId ?? undefined) });
  const r = q.data;
  return (
    <ReportLayout
      title="Open orders"
      description="Orders not fully received yet. Late ones first."
      filters={<div className="w-56"><SupplierPicker value={supplierId} onChange={(id) => setSupplierId(id)} placeholder="All suppliers" clearable /></div>}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
      kpis={r && (
        <>
          <StatCard label="Open orders" value={r.orderCount} />
          <StatCard label="Outstanding" value={formatMoney(r.outstandingValue)} />
          <StatCard label="Overdue" value={r.overdueCount} tone={r.overdueCount ? 'destructive' : 'success'} />
          <StatCard label="Overdue value" value={formatMoney(r.overdueValue)} />
        </>
      )}
    >
      {r && (
        <DataTable
          columns={columns}
          data={[...r.orders].sort((a, b) => b.daysOverdue - a.daysOverdue)}
          getRowId={(o) => o.purchaseOrderId}
          onRowClick={(o) => router.push(`/purchase-orders/${o.purchaseOrderId}`)}
          searchable
          rowClassName={(o) => (o.isOverdue ? 'bg-destructive/5' : undefined)}
          emptyTitle="No open orders"
          csv={{
            fileName: 'open-orders',
            columns: [
              { header: 'Order', value: (o) => o.orderNumber }, { header: 'Supplier', value: (o) => o.supplierName }, { header: 'Status', value: (o) => o.status },
              { header: 'Ordered', value: (o) => o.orderDate }, { header: 'Expected', value: (o) => o.expectedDeliveryDate }, { header: 'Days overdue', value: (o) => o.daysOverdue },
              { header: 'Outstanding', value: (o) => o.outstandingValue },
            ],
          }}
        />
      )}
    </ReportLayout>
  );
}

export default function Page() {
  return <PermissionRoute permission="PurchaseReports.View"><OpenOrders /></PermissionRoute>;
}
