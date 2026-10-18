'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { DateRangeFilter, presetRange } from '@/components/shared/DateRange';
import { MoneyText, PageHeader } from '@/components/shared/Display';
import { salesApi } from '@/api/endpoints/sales';
import { labels } from '@/api/enums';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateTime } from '@/lib/format';
import type { SaleReturnDto } from '@/api/dto/sales';

const columns: ColumnDef<SaleReturnDto, unknown>[] = [
  { header: 'Return', accessorKey: 'returnNumber', cell: ({ row }) => <span className="font-medium">{row.original.returnNumber}</span> },
  { header: 'Sale', accessorKey: 'saleNumber' },
  { header: 'Date', accessorKey: 'createdAt', cell: ({ row }) => formatDateTime(row.original.createdAt) },
  { header: 'Reason', accessorKey: 'reason', meta: { className: 'max-w-xs truncate' } },
  { header: 'Refund', accessorKey: 'refundMethod', cell: ({ row }) => labels.refundMethod[row.original.refundMethod] },
  { header: 'Items', id: 'items', cell: ({ row }) => row.original.lines.length },
  { header: 'VAT', accessorKey: 'taxAmount', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.taxAmount} currency={false} /> },
  { header: 'Amount', accessorKey: 'totalAmount', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.totalAmount} className="font-medium" /> },
];

function Returns() {
  const router = useRouter();
  const key = useQueryKey();
  const [range, setRange] = useState(() => presetRange('month'));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const params = { ...range, page, pageSize };
  const query = useQuery({ queryKey: key('sales', { returns: params }), queryFn: () => salesApi.returns(params), placeholderData: keepPreviousData });
  return (
    <>
      <PageHeader title="Returns" description="Goods returned against sales, with the refund given." />
      <DataTable
        mode="server"
        columns={columns}
        data={query.data?.items}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        onRowClick={(r) => router.push(`/sales/${r.saleId}`)}
        page={page}
        pageSize={pageSize}
        totalCount={query.data?.meta.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        emptyTitle="No returns in this period"
        toolbar={<DateRangeFilter value={range} onChange={(r) => { setRange(r); setPage(1); }} />}
        csv={{
          fileName: `returns-${range.from}-to-${range.to}`,
          columns: [
            { header: 'Return', value: (r) => r.returnNumber },
            { header: 'Sale', value: (r) => r.saleNumber },
            { header: 'Date', value: (r) => r.createdAt },
            { header: 'Reason', value: (r) => r.reason },
            { header: 'Refund method', value: (r) => labels.refundMethod[r.refundMethod] },
            { header: 'Reference', value: (r) => r.refundReference },
            { header: 'VAT', value: (r) => r.taxAmount },
            { header: 'Amount', value: (r) => r.totalAmount },
          ],
        }}
      />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Sales.View"><Returns /></PermissionRoute>;
}
