'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PermissionRoute, Can } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { DateRangeFilter, presetRange } from '@/components/shared/DateRange';
import { MoneyText, PageHeader, StatusBadge } from '@/components/shared/Display';
import { CustomerPicker, EnumSelect } from '@/components/shared/Pickers';
import { salesApi } from '@/api/endpoints/sales';
import { labels, type PaymentMethod, type SaleStatus } from '@/api/enums';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateTime, formatMoney } from '@/lib/format';
import type { SaleDto } from '@/api/dto/sales';

const columns: ColumnDef<SaleDto, unknown>[] = [
  { header: 'Sale', accessorKey: 'saleNumber', cell: ({ row }) => <span className="font-medium">{row.original.saleNumber}</span> },
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

function SalesList() {
  const router = useRouter();
  const key = useQueryKey();
  const [range, setRange] = useState(() => presetRange('today'));
  const [status, setStatus] = useState<SaleStatus | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const debounced = useDebouncedValue(search.trim(), 300);
  const params = { ...range, status: status ?? undefined, paymentMethod: method ?? undefined, customerId: customerId ?? undefined, search: debounced || undefined, page, pageSize };

  const query = useQuery({ queryKey: key('sales', params), queryFn: () => salesApi.list(params), placeholderData: keepPreviousData });
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };

  return (
    <>
      <PageHeader
        title="Sales"
        description="Every sale, with its status and payment."
        actions={<Can permission="Sales.Create"><Button asChild><Link href="/pos"><Plus />New sale</Link></Button></Can>}
      />
      <DataTable
        mode="server"
        columns={columns}
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
            <div className="w-56"><CustomerPicker value={customerId} onChange={reset(setCustomerId)} placeholder="All customers" clearable /></div>
          </>
        }
        csv={{
          fileName: `sales-${range.from}-to-${range.to}`,
          columns: [
            { header: 'Sale', value: (s) => s.saleNumber },
            { header: 'Date', value: (s) => s.createdAt },
            { header: 'Customer', value: (s) => s.customerName ?? 'Walk-in' },
            { header: 'Payment', value: (s) => labels.paymentMethod[s.paymentMethod] },
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
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Sales.View"><SalesList /></PermissionRoute>;
}
