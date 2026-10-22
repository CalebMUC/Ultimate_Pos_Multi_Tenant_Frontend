'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Bike, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { Badge } from '@/components/ui/primitives';
import { PermissionRoute, Can } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { DateRangeFilter, presetRange } from '@/components/shared/DateRange';
import { MoneyText, PageHeader, StatusBadge } from '@/components/shared/Display';
import { CustomerPicker, EnumSelect } from '@/components/shared/Pickers';
import { salesApi } from '@/api/endpoints/sales';
import { deliveryOrdersApi } from '@/api/endpoints/deliveries';
import { DeliveryMode, DeliveryOrderStatus, PaymentMethod, labels, type SaleStatus } from '@/api/enums';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { useActiveBusiness, usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateTime, formatMoney } from '@/lib/format';
import type { SaleDto } from '@/api/dto/sales';
import type { DeliveryOrderDto } from '@/api/dto/deliveries';
import { describeLines, paymentLabel } from '@/features/deliveries/DeliveryDialogs';
import { branchLabel, useBranchFilter } from '@/features/branches/branches';
import { withBranchColumn } from '@/features/branches/branchColumn';

const columns: ColumnDef<SaleDto, unknown>[] = [
  {
    header: 'Sale',
    accessorKey: 'saleNumber',
    cell: ({ row }) => (
      <span className="flex items-center gap-1.5 font-medium">
        {row.original.saleNumber}
        {row.original.deliveryMode === DeliveryMode.Rider && <Badge variant="info" title="Delivered by a rider"><Bike className="size-3" />Rider</Badge>}
      </span>
    ),
  },
  { header: 'Date', accessorKey: 'createdAt', cell: ({ row }) => formatDateTime(row.original.createdAt) },
  { header: 'Customer', accessorKey: 'customerName', cell: ({ row }) => row.original.customerName ?? <span className="text-muted-foreground">Walk-in</span> },
  { header: 'Payment', accessorKey: 'paymentMethod', cell: ({ row }) => labels.paymentMethod[row.original.paymentMethod] },
  { header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge kind="sale" value={row.original.status} /> },
  { header: 'Cashier', accessorKey: 'createdByName', cell: ({ row }) => row.original.createdByName ?? '—' },
  {
    header: 'Total',
    accessorKey: 'totalAmount',
    meta: { align: 'right' },
    cell: ({ row }) => (
      <span>
        <MoneyText value={row.original.totalAmount} className="font-medium" />
        {row.original.returnedAmount > 0 && <span className="block text-xs text-muted-foreground">−{formatMoney(row.original.returnedAmount)} returned</span>}
      </span>
    ),
  },
];

/** Rider orders still out: not sales yet (they are not in GET /sales). The amount is what the rider should bring back. */
const openOrderColumns: ColumnDef<DeliveryOrderDto, unknown>[] = [
  { header: 'Order', accessorKey: 'orderNumber', cell: ({ row }) => <span className="font-medium">{row.original.orderNumber}</span> },
  { header: 'Out since', accessorKey: 'dispatchedAt', cell: ({ row }) => formatDateTime(row.original.dispatchedAt ?? row.original.createdAt) },
  { header: 'Customer', accessorKey: 'customerName' },
  { header: 'Items', id: 'items', cell: ({ row }) => <span className="text-xs">{describeLines(row.original)}</span> },
  { header: 'Rider', accessorKey: 'riderName', cell: ({ row }) => row.original.riderName ?? '—' },
  { header: 'Status', id: 'status', cell: () => <Badge variant="warning">Not completed</Badge> },
  { header: 'Payment', id: 'expected', cell: ({ row }) => paymentLabel(row.original.expectedPaymentMethod ?? PaymentMethod.Cash) },
  { header: 'To collect', accessorKey: 'estimatedTotal', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.estimatedTotal} className="font-medium" /> },
];

function Sales() {
  const { hasModule } = useActiveBusiness();
  const canSeeDeliveries = usePermission('DeliveryOrders.View') && hasModule('deliveries');
  return (
    <>
      <PageHeader
        title="Sales"
        description="Every sale, with its status and payment."
        actions={<Can permission="Sales.Create"><Button asChild><Link href="/pos"><Plus />New sale</Link></Button></Can>}
      />
      {canSeeDeliveries ? (
        <Tabs defaultValue="sales">
          <TabsList>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="open">Not completed</TabsTrigger>
          </TabsList>
          <TabsContent value="sales" className="mt-3"><SalesList delivers /></TabsContent>
          <TabsContent value="open" className="mt-3"><NotCompleted /></TabsContent>
        </Tabs>
      ) : (
        <SalesList />
      )}
    </>
  );
}

function NotCompleted() {
  const key = useQueryKey();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const params = { status: DeliveryOrderStatus.OutForDelivery, page, pageSize };
  const query = useQuery({ queryKey: key('delivery-orders', params), queryFn: () => deliveryOrdersApi.list(params), placeholderData: keepPreviousData, refetchInterval: 30_000 });
  return (
    <DataTable
      mode="server"
      columns={openOrderColumns}
      data={query.data?.items}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => query.refetch()}
      getRowId={(o) => o.deliveryOrderId}
      onRowClick={(o) => router.push(`/deliveries?orderId=${o.deliveryOrderId}`)}
      page={page}
      pageSize={pageSize}
      totalCount={query.data?.meta.totalCount ?? 0}
      onPageChange={setPage}
      onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
      emptyTitle="No rider orders out"
      emptyMessage="Orders sent with a rider show here until the rider is back and the sale is completed on the Deliveries board."
    />
  );
}

function SalesList({ delivers = false }: { delivers?: boolean }) {
  const router = useRouter();
  const key = useQueryKey();
  const branch = useBranchFilter();
  const [range, setRange] = useState(() => presetRange('today'));
  const [status, setStatus] = useState<SaleStatus | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [mode, setMode] = useState<DeliveryMode | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  // Another branch is another list: start from its first page.
  useEffect(() => setPage(1), [branch.branchId]);
  const [pageSize, setPageSize] = useState(25);
  const debounced = useDebouncedValue(search.trim(), 300);
  const params = {
    ...range, status: status ?? undefined, paymentMethod: method ?? undefined, deliveryMode: mode ?? undefined, customerId: customerId ?? undefined,
    search: debounced || undefined, page, pageSize,
  };

  const query = useQuery({ queryKey: key('sales', { ...params, branchId: branch.branchId }), queryFn: () => salesApi.list({ ...params, ...branch.scope }), placeholderData: keepPreviousData });
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };

  return (
    <DataTable
      branchFilter={branch}
      mode="server"
      columns={withBranchColumn(columns, branch.visible)}
      data={query.data?.items}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => query.refetch()}
      getRowId={(s) => s.saleId}
      onRowClick={(s) => router.push(`/sales/${s.saleId}`)}
      page={page}
      pageSize={pageSize}
      totalCount={query.data?.meta.totalCount ?? 0}
      onPageChange={setPage}
      onPageSizeChange={reset(setPageSize)}
      search={search}
      onSearchChange={reset(setSearch)}
      searchPlaceholder="Sale number or customer…"
      emptyTitle="No sales in this period"
      toolbar={
        <>
          <DateRangeFilter value={range} onChange={reset(setRange)} />
          <EnumSelect map={labels.saleStatus} value={status} onChange={reset(setStatus)} placeholder="All statuses" className="w-36" aria-label="Status" />
          <EnumSelect map={labels.paymentMethod} value={method} onChange={reset(setMethod)} placeholder="All payments" className="w-36" aria-label="Payment method" />
          {delivers && <EnumSelect map={labels.deliveryMode} value={mode} onChange={reset(setMode)} placeholder="Counter and rider" className="w-40" aria-label="Delivery" />}
          <div className="w-56"><CustomerPicker value={customerId} onChange={reset(setCustomerId)} placeholder="All customers" clearable /></div>
        </>
      }
      csv={{
        fileName: `sales-${range.from}-to-${range.to}`,
        columns: [
          { header: 'Sale', value: (s) => s.saleNumber },
          { header: 'Branch', value: (s) => branchLabel(s) },
          { header: 'Date', value: (s) => s.createdAt },
          { header: 'Customer', value: (s) => s.customerName ?? 'Walk-in' },
          { header: 'Payment', value: (s) => labels.paymentMethod[s.paymentMethod] },
          { header: 'Delivery', value: (s) => labels.deliveryMode[s.deliveryMode ?? DeliveryMode.Counter] },
          { header: 'Status', value: (s) => labels.saleStatus[s.status] },
          { header: 'Subtotal', value: (s) => s.subtotal },
          { header: 'Discount', value: (s) => s.discountTotal },
          { header: 'VAT', value: (s) => s.taxTotal },
          { header: 'Total', value: (s) => s.totalAmount },
          { header: 'Returned', value: (s) => s.returnedAmount },
          { header: 'Cashier', value: (s) => s.createdByName },
        ],
      }}
    />
  );
}

export default function Page() {
  return <PermissionRoute permission="Sales.View"><Sales /></PermissionRoute>;
}
