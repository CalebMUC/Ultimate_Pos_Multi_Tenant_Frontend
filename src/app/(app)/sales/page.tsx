'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Bike, History, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { Badge } from '@/components/ui/primitives';
import { PermissionRoute, Can } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { DateRangeFilter, presetRange } from '@/components/shared/DateRange';
import { MoneyText, PageHeader, StatusBadge } from '@/components/shared/Display';
import { CustomerPicker, EnumSelect } from '@/components/shared/Pickers';
import { salesApi } from '@/api/endpoints/sales';
import { DeliveryMode, PaymentMethod, labels, type SaleStatus } from '@/api/enums';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateTime, formatMoney } from '@/lib/format';
import { enumParam } from '@/lib/utils';
import type { SaleDto } from '@/api/dto/sales';
import { backdatedNote } from '@/features/sales/backdated';
import { branchLabel, useBranchFilter } from '@/features/branches/branches';
import { withBranchColumn } from '@/features/branches/branchColumn';
import { NOT_COMPLETED_VIEW, NotCompletedSales, useNotCompletedSales } from '@/features/sales/NotCompletedSales';

const columns: ColumnDef<SaleDto, unknown>[] = [
  {
    header: 'Sale',
    accessorKey: 'saleNumber',
    cell: ({ row }) => (
      <span className="flex items-center gap-1.5 font-medium">
        {row.original.saleNumber}
        {row.original.deliveryMode === DeliveryMode.Rider && <Badge variant="info" title="Delivered by a rider"><Bike className="size-3" />Rider</Badge>}
        {row.original.recordedAt && <BackdatedBadge sale={row.original} />}
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

function BackdatedBadge({ sale }: { sale: SaleDto }) {
  return <Badge variant="warning" title={backdatedNote(sale)}><History className="size-3" />Backdated</Badge>;
}

function Sales() {
  const notCompleted = useNotCompletedSales();
  const view = useSearchParams().get('view') === NOT_COMPLETED_VIEW && notCompleted.visible ? NOT_COMPLETED_VIEW : 'sales';
  return (
    <>
      <PageHeader
        title="Sales"
        description="Every sale, with its status and payment."
        actions={<Can permission="Sales.Create"><Button asChild><Link href="/pos"><Plus />New sale</Link></Button></Can>}
      />
      {notCompleted.visible ? (
        <Tabs key={view} defaultValue={view}>
          <TabsList>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value={NOT_COMPLETED_VIEW}>
              Not completed
              {notCompleted.count > 0 && <Badge variant="warning" className="ml-1.5">{notCompleted.count}</Badge>}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="sales" className="mt-3"><SalesList delivers={notCompleted.canRider} /></TabsContent>
          <TabsContent value={NOT_COMPLETED_VIEW} className="mt-3"><NotCompletedSales data={notCompleted} /></TabsContent>
        </Tabs>
      ) : (
        <SalesList />
      )}
    </>
  );
}

const isDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

function SalesList({ delivers = false }: { delivers?: boolean }) {
  const router = useRouter();
  const key = useQueryKey();
  const branch = useBranchFilter();
  // The dashboard's cards link here with their dates and filters.
  const urlParams = useSearchParams();
  const [range, setRange] = useState(() => {
    const from = urlParams.get('from'), to = urlParams.get('to');
    return isDate(from) && isDate(to) ? { from, to } : presetRange('today');
  });
  const [status, setStatus] = useState<SaleStatus | null>(() => enumParam(urlParams.get('status'), labels.saleStatus));
  const [method, setMethod] = useState<PaymentMethod | null>(() => enumParam(urlParams.get('paymentMethod'), labels.paymentMethod));
  const [mode, setMode] = useState<DeliveryMode | null>(null);
  const [backdatedOnly, setBackdatedOnly] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  // Another branch is another list: start from its first page.
  useEffect(() => setPage(1), [branch.branchId]);
  const [pageSize, setPageSize] = useState(25);
  const debounced = useDebouncedValue(search.trim(), 300);
  const params = {
    ...range, status: status ?? undefined, paymentMethod: method ?? undefined, deliveryMode: mode ?? undefined, customerId: customerId ?? undefined,
    search: debounced || undefined, backdated: backdatedOnly || undefined, page, pageSize,
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
          <Button
            variant={backdatedOnly ? 'secondary' : 'outline'}
            aria-pressed={backdatedOnly}
            onClick={() => reset(setBackdatedOnly)(!backdatedOnly)}
            title="Sales entered later than they happened, e.g. after a power failure"
          >
            <History />Backdated only
          </Button>
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
          { header: 'Entered (backdated)', value: (s) => s.recordedAt ?? '' },
          { header: 'Backdate reason', value: (s) => s.backdateReason ?? '' },
        ],
      }}
    />
  );
}

export default function Page() {
  return <PermissionRoute permission="Sales.View"><Sales /></PermissionRoute>;
}
