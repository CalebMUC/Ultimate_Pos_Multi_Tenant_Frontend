'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/primitives';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText } from '@/components/shared/Display';
import { reportsApi } from '@/api/endpoints/other';
import { deliveryOrdersApi } from '@/api/endpoints/deliveries';
import { DeliveryOrderStatus, PaymentMethod } from '@/api/enums';
import { useActiveBusiness, usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { formatDateOnly, formatDateTime } from '@/lib/format';
import { sum } from '@/lib/utils';
import { describeLines, paymentLabel } from '@/features/deliveries/DeliveryDialogs';
import type { Guid } from '@/api/dto/common';
import type { OpenInvoiceDto } from '@/api/dto/reports';
import type { DeliveryOrderDto } from '@/api/dto/deliveries';

/** One credit sale the customer still owes on. */
export interface UnpaidCreditSale extends OpenInvoiceDto {
  customerId: Guid;
  customerName: string;
  phoneNumber: string | null;
}

/** ?view=not-completed on /sales opens the Not completed tab. */
export const NOT_COMPLETED_VIEW = 'not-completed';

/** Enough to count and add up every rider order out: there are rarely more at once. */
const RIDER_COUNT_PAGE = 100;

/**
 * Sales that are not completed yet, at every branch and whatever the dates: credit sales the customer still owes on (the open invoices
 * of the customer aging report, oldest first) and rider orders still out, which become sales only once the rider is back. Each half
 * shows only to someone allowed to see it. Keyed under 'dashboard' and 'delivery-orders' so payments and deliveries refresh it.
 */
export function useNotCompletedSales() {
  const key = useQueryKey();
  const { hasModule } = useActiveBusiness();
  const canCredit = usePermission('CustomerReports.View');
  const canRider = usePermission('DeliveryOrders.View') && hasModule('deliveries');

  const credit = useQuery({
    queryKey: key('dashboard', { notCompleted: 'credit' }),
    queryFn: () => reportsApi.customerAging({ includeInvoices: true }),
    enabled: canCredit,
  });
  const riderParams = { status: DeliveryOrderStatus.OutForDelivery, page: 1, pageSize: RIDER_COUNT_PAGE };
  const rider = useQuery({ queryKey: key('delivery-orders', riderParams), queryFn: () => deliveryOrdersApi.list(riderParams), enabled: canRider, refetchInterval: 60_000 });

  const unpaid = useMemo<UnpaidCreditSale[] | undefined>(
    () => credit.data?.customers
      .flatMap((c) => (c.openInvoices ?? []).map((i) => ({ ...i, customerId: c.customerId, customerName: c.customerName, phoneNumber: c.phoneNumber })))
      .sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate)),
    [credit.data],
  );
  const creditCount = unpaid?.length ?? 0;
  const creditAmount = unpaid ? sum(unpaid, (i) => i.outstandingAmount) : 0;
  const riderCount = rider.data?.meta.totalCount ?? 0;
  const riderAmount = rider.data ? sum(rider.data.items, (o) => o.estimatedTotal) : 0;

  return {
    canCredit,
    canRider,
    visible: canCredit || canRider,
    isLoading: (canCredit && credit.isLoading) || (canRider && rider.isLoading),
    /** Then the count is not known: never show it as nothing waiting. */
    isError: credit.isError || rider.isError,
    credit: { query: credit, unpaid, count: creditCount, amount: creditAmount },
    rider: { count: riderCount, amount: riderAmount },
    count: creditCount + riderCount,
    amount: creditAmount + riderAmount,
  };
}

const creditColumns: ColumnDef<UnpaidCreditSale, unknown>[] = [
  {
    header: 'Sale',
    accessorKey: 'invoiceNumber',
    cell: ({ row }) => (
      <Link href={`/sales/${row.original.invoiceId}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">
        {row.original.invoiceNumber ?? 'View sale'}
      </Link>
    ),
  },
  { header: 'Sold', accessorKey: 'invoiceDate', cell: ({ row }) => <span className="whitespace-nowrap">{formatDateOnly(row.original.invoiceDate)}</span> },
  { header: 'Customer', accessorKey: 'customerName', cell: ({ row }) => <span className="font-medium">{row.original.customerName}</span> },
  {
    header: 'Phone',
    accessorKey: 'phoneNumber',
    cell: ({ row }) => (row.original.phoneNumber
      ? <a href={`tel:${row.original.phoneNumber}`} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap hover:underline">{row.original.phoneNumber}</a>
      : '—'),
  },
  {
    header: 'Age',
    accessorKey: 'ageDays',
    meta: { align: 'right' },
    cell: ({ row }) => <span className="whitespace-nowrap">{row.original.ageDays} day(s)</span>,
  },
  {
    header: 'Promised by',
    accessorKey: 'paymentDueDate',
    cell: ({ row }) => (row.original.paymentDueDate ? (
      <span className="flex flex-wrap items-center gap-1.5 whitespace-nowrap">
        {formatDateOnly(row.original.paymentDueDate)}
        {row.original.isPromiseOverdue && <Badge variant="destructive">Overdue</Badge>}
      </span>
    ) : '—'),
  },
  { header: 'Sale total', accessorKey: 'originalAmount', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.originalAmount} currency={false} /> },
  { header: 'Still owed', accessorKey: 'outstandingAmount', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.outstandingAmount} currency={false} className="font-medium text-warning" /> },
];

/** Rider orders still out: not sales yet (they are not in GET /sales). The amount is what the rider should bring back. */
const riderColumns: ColumnDef<DeliveryOrderDto, unknown>[] = [
  { header: 'Order', accessorKey: 'orderNumber', cell: ({ row }) => <span className="font-medium">{row.original.orderNumber}</span> },
  { header: 'Out since', accessorKey: 'dispatchedAt', cell: ({ row }) => formatDateTime(row.original.dispatchedAt ?? row.original.createdAt) },
  { header: 'Customer', accessorKey: 'customerName' },
  { header: 'Items', id: 'items', cell: ({ row }) => <span className="text-xs">{describeLines(row.original)}</span> },
  { header: 'Rider', accessorKey: 'riderName', cell: ({ row }) => row.original.riderName ?? '—' },
  { header: 'Status', id: 'status', cell: () => <Badge variant="warning">Not completed</Badge> },
  { header: 'Payment', id: 'expected', cell: ({ row }) => paymentLabel(row.original.expectedPaymentMethod ?? PaymentMethod.Cash) },
  { header: 'To collect', accessorKey: 'estimatedTotal', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.estimatedTotal} className="font-medium" /> },
];

/** The Sales page's Not completed tab: what to chase, and where each one is completed. */
export function NotCompletedSales({ data }: { data: ReturnType<typeof useNotCompletedSales> }) {
  const router = useRouter();
  const { credit } = data;
  return (
    <div className="space-y-6">
      {data.canCredit && (
        <section className="space-y-2" aria-labelledby="unpaid-credit-heading">
          <div>
            <h2 id="unpaid-credit-heading" className="font-semibold">On credit, not paid yet</h2>
            <p className="text-sm text-muted-foreground">Credit sales the customer still owes on, oldest first. Open one to record the customer’s payment; payments clear the oldest sales first.</p>
          </div>
          <DataTable
            columns={creditColumns}
            data={credit.unpaid}
            isLoading={credit.query.isLoading}
            error={credit.query.error}
            onRetry={() => credit.query.refetch()}
            getRowId={(i) => i.invoiceId}
            onRowClick={(i) => router.push(`/customers/${i.customerId}`)}
            searchable
            emptyTitle="No unpaid credit sales"
            emptyMessage="Every credit sale has been paid."
            csv={{
              fileName: 'unpaid-credit-sales',
              columns: [
                { header: 'Sale', value: (i) => i.invoiceNumber }, { header: 'Sold', value: (i) => i.invoiceDate }, { header: 'Customer', value: (i) => i.customerName },
                { header: 'Phone', value: (i) => i.phoneNumber }, { header: 'Age (days)', value: (i) => i.ageDays }, { header: 'Promised by', value: (i) => i.paymentDueDate ?? null },
                { header: 'Sale total', value: (i) => i.originalAmount }, { header: 'Still owed', value: (i) => i.outstandingAmount },
              ],
            }}
          />
        </section>
      )}
      {data.canRider && <RiderOrdersOut />}
    </div>
  );
}

function RiderOrdersOut() {
  const key = useQueryKey();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search.trim(), 300);
  const params = { status: DeliveryOrderStatus.OutForDelivery, page, pageSize, search: term || undefined };
  const query = useQuery({ queryKey: key('delivery-orders', params), queryFn: () => deliveryOrdersApi.list(params), placeholderData: keepPreviousData, refetchInterval: 30_000 });
  return (
    <section className="space-y-2" aria-labelledby="rider-out-heading">
      <div>
        <h2 id="rider-out-heading" className="font-semibold">Out with a rider</h2>
        <p className="text-sm text-muted-foreground">Not sales yet. Open one to complete it on the Deliveries board once the rider is back.</p>
      </div>
      <DataTable
        mode="server"
        columns={riderColumns}
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
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Order, customer, phone, rider…"
        emptyTitle="No rider orders out"
        emptyMessage="Orders sent with a rider show here until the rider is back and the sale is completed on the Deliveries board."
      />
    </section>
  );
}
