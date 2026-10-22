'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { DateRangeFilter, presetRange } from '@/components/shared/DateRange';
import { MoneyText, StatCard } from '@/components/shared/Display';
import { deliveryOrdersApi } from '@/api/endpoints/deliveries';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatMoney } from '@/lib/format';
import { ReportLayout } from '@/features/reports/ReportLayout';
import type { RiderSummaryDto } from '@/api/dto/deliveries';

const columns: ColumnDef<RiderSummaryDto, unknown>[] = [
  { header: 'Rider', accessorKey: 'riderName', cell: ({ row }) => <span className="font-medium">{row.original.riderName}</span> },
  { header: 'Trips', accessorKey: 'tripCount', meta: { align: 'right' } },
  { header: 'Delivered', accessorKey: 'deliveredCount', meta: { align: 'right' } },
  { header: 'Returned', accessorKey: 'returnedCount', meta: { align: 'right' }, cell: ({ row }) => <span className={row.original.returnedCount ? 'text-warning-foreground dark:text-warning' : ''}>{row.original.returnedCount}</span> },
  { header: 'Value', accessorKey: 'deliveredTotal', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.deliveredTotal} /> },
  { header: 'Cash to hand in', accessorKey: 'cashCollected', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.cashCollected} className="font-semibold" /> },
  { header: 'M-Pesa till', accessorKey: 'paidByMpesaTill', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.paidByMpesaTill} /> },
  { header: 'On account', accessorKey: 'onCredit', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.onCredit} /> },
  { header: 'Out now', accessorKey: 'outForDeliveryNow', meta: { align: 'right' } },
  {
    header: 'Cash still out',
    accessorKey: 'cashExpectedNow',
    meta: { align: 'right' },
    cell: ({ row }) => <MoneyText value={row.original.cashExpectedNow} className={row.original.cashExpectedNow ? 'font-semibold text-warning-foreground dark:text-warning' : 'text-muted-foreground'} />,
  },
];

function RiderCashUp() {
  const key = useQueryKey();
  const [range, setRange] = useState(() => presetRange('today'));
  const q = useQuery({ queryKey: key('delivery-orders', { summary: range }), queryFn: () => deliveryOrdersApi.summary(range.from, range.to) });
  const s = q.data;
  return (
    <ReportLayout
      title="Rider cash-up"
      description="Deliveries recorded in the period, by rider, and how they were paid. Cash to hand in is what each rider collected; cash still out is what the orders they have out now should bring back."
      filters={<DateRangeFilter value={range} onChange={setRange} />}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
      kpis={s && (
        <>
          <StatCard label="Delivered" value={formatMoney(s.deliveredTotal)} hint={`${s.deliveredCount} order(s) on ${s.tripCount} trip(s)`} />
          <StatCard label="Cash collected" value={formatMoney(s.cashCollected)} />
          <StatCard label="M-Pesa till / on account" value={`${formatMoney(s.paidByMpesaTill)} / ${formatMoney(s.onCredit)}`} />
          <StatCard label="Open now" value={`${s.pendingNow} pending · ${s.outForDeliveryNow} out`} hint={[s.returnedCount ? `${s.returnedCount} returned` : '', s.cancelledCount ? `${s.cancelledCount} cancelled` : ''].filter(Boolean).join(' · ') || undefined} tone={s.outForDeliveryNow ? 'warning' : 'default'} />
        </>
      )}
    >
      {s && (
        <DataTable
          columns={columns}
          data={s.byRider}
          getRowId={(r) => r.riderName}
          emptyTitle="No deliveries in this period"
          csv={{
            fileName: `rider-cash-up-${range.from}-${range.to}`,
            columns: [
              { header: 'Rider', value: (r) => r.riderName },
              { header: 'Trips', value: (r) => r.tripCount },
              { header: 'Delivered', value: (r) => r.deliveredCount },
              { header: 'Returned', value: (r) => r.returnedCount },
              { header: 'Value', value: (r) => r.deliveredTotal },
              { header: 'Cash', value: (r) => r.cashCollected },
              { header: 'M-Pesa till', value: (r) => r.paidByMpesaTill },
              { header: 'On account', value: (r) => r.onCredit },
              { header: 'Out now', value: (r) => r.outForDeliveryNow },
              { header: 'Cash still out', value: (r) => r.cashExpectedNow },
            ],
          }}
        />
      )}
    </ReportLayout>
  );
}

export default function Page() {
  return <PermissionRoute permission="DeliveryOrders.View" module="deliveries"><RiderCashUp /></PermissionRoute>;
}
