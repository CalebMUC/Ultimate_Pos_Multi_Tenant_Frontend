'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, PageHeader, StatusBadge } from '@/components/shared/Display';
import { EnumSelect, SupplierPicker } from '@/components/shared/Pickers';
import { purchaseOrdersApi } from '@/api/endpoints/inventory';
import { labels, type PurchaseOrderStatus } from '@/api/enums';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDate } from '@/lib/format';
import { orderValue } from '@/features/purchasing/orderValue';
import type { PurchaseOrderDto } from '@/api/dto/inventory';

const columns: ColumnDef<PurchaseOrderDto, unknown>[] = [
  { header: 'Order', accessorKey: 'orderNumber', cell: ({ row }) => <span className="font-medium">{row.original.orderNumber}</span> },
  { header: 'Supplier', accessorKey: 'supplierName', cell: ({ row }) => row.original.supplierName ?? '—' },
  { header: 'Ordered', accessorKey: 'orderDate', cell: ({ row }) => formatDate(row.original.orderDate) },
  { header: 'Expected', accessorKey: 'expectedDeliveryDate', cell: ({ row }) => formatDate(row.original.expectedDeliveryDate) },
  { header: 'Lines', id: 'lines', cell: ({ row }) => row.original.lines.length },
  { header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge kind="purchaseOrder" value={row.original.status} /> },
  { header: 'Value', id: 'value', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={orderValue(row.original)} className="font-medium" /> },
];

function PurchaseOrders() {
  const router = useRouter();
  const key = useQueryKey();
  const [status, setStatus] = useState<PurchaseOrderStatus | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const params = { page, pageSize, status: status ?? undefined, supplierId: supplierId ?? undefined };
  const query = useQuery({ queryKey: key('purchase-orders', params), queryFn: () => purchaseOrdersApi.list(params), placeholderData: keepPreviousData });
  return (
    <>
      <PageHeader
        title="Purchase orders"
        description="Orders to suppliers. Receiving an order puts the stock on hand and bills the supplier."
        actions={<Can permission="PurchaseOrders.Create"><Button asChild><Link href="/purchase-orders/new"><Plus />New order</Link></Button></Can>}
      />
      <DataTable
        mode="server"
        columns={columns}
        data={query.data?.items}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        getRowId={(po) => po.purchaseOrderId}
        onRowClick={(po) => router.push(`/purchase-orders/${po.purchaseOrderId}`)}
        page={page}
        pageSize={pageSize}
        totalCount={query.data?.meta.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        emptyTitle="No purchase orders"
        toolbar={
          <>
            <EnumSelect map={labels.purchaseOrderStatus} value={status} onChange={(v) => { setStatus(v); setPage(1); }} placeholder="All statuses" className="w-44" aria-label="Status" />
            <div className="w-56"><SupplierPicker value={supplierId} onChange={(id) => { setSupplierId(id); setPage(1); }} placeholder="All suppliers" clearable /></div>
          </>
        }
        csv={{
          fileName: 'purchase-orders',
          columns: [
            { header: 'Order', value: (po) => po.orderNumber },
            { header: 'Supplier', value: (po) => po.supplierName },
            { header: 'Ordered', value: (po) => po.orderDate },
            { header: 'Expected', value: (po) => po.expectedDeliveryDate },
            { header: 'Status', value: (po) => labels.purchaseOrderStatus[po.status] },
            { header: 'Value', value: (po) => orderValue(po) },
          ],
        }}
      />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="PurchaseOrders.View"><PurchaseOrders /></PermissionRoute>;
}
