'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Input, Label } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, StatCard } from '@/components/shared/Display';
import { reportsApi } from '@/api/endpoints/other';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateOnly, formatMoney, todayIso } from '@/lib/format';
import { ReportLayout } from '@/features/reports/ReportLayout';
import type { CustomerAgingRowDto } from '@/api/dto/reports';
import { useBranchFilter } from '@/features/branches/branches';

const money = (pick: (r: CustomerAgingRowDto) => number) => function MoneyCell({ row }: { row: { original: CustomerAgingRowDto } }) {
  const v = pick(row.original);
  return v ? <MoneyText value={v} currency={false} /> : <span className="text-muted-foreground">—</span>;
};

const columns: ColumnDef<CustomerAgingRowDto, unknown>[] = [
  {
    header: 'Customer',
    accessorKey: 'customerName',
    cell: ({ row }) => <span><span className="font-medium">{row.original.customerName}</span>{row.original.phoneNumber && <span className="block text-xs text-muted-foreground">{row.original.phoneNumber}</span>}</span>,
  },
  { header: '0–30', id: 'b0', accessorFn: (r) => r.buckets.days0To30, meta: { align: 'right' }, cell: money((r) => r.buckets.days0To30) },
  { header: '31–60', id: 'b1', accessorFn: (r) => r.buckets.days31To60, meta: { align: 'right' }, cell: money((r) => r.buckets.days31To60) },
  { header: '61–90', id: 'b2', accessorFn: (r) => r.buckets.days61To90, meta: { align: 'right' }, cell: money((r) => r.buckets.days61To90) },
  { header: '90+', id: 'b3', accessorFn: (r) => r.buckets.over90, meta: { align: 'right', className: 'text-destructive' }, cell: money((r) => r.buckets.over90) },
  { header: 'Credit', accessorKey: 'unappliedCredit', meta: { align: 'right' }, cell: money((r) => -r.unappliedCredit) },
  { header: 'Net balance', accessorKey: 'netBalance', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.netBalance} className="font-semibold" /> },
  { header: 'Oldest', accessorKey: 'oldestOpenInvoiceDate', cell: ({ row }) => (row.original.oldestOpenInvoiceDate ? `${formatDateOnly(row.original.oldestOpenInvoiceDate)} (${row.original.oldestOpenInvoiceAgeDays}d)` : '—') },
];

function CustomerAging() {
  const router = useRouter();
  const key = useQueryKey();
  const branch = useBranchFilter();
  const [asOf, setAsOf] = useState(todayIso());
  const q = useQuery({ queryKey: key('reports', { aging: asOf, branchId: branch.branchId }), queryFn: () => reportsApi.customerAging({ asOf, ...branch.scope }) });
  const r = q.data;
  return (
    <ReportLayout
      branchFilter={branch}
      title="Customer aging"
      description="What customers owe, by how long it has been unpaid."
      filters={<><Label htmlFor="asof">As of</Label><Input id="asof" type="date" max={todayIso()} value={asOf} onChange={(e) => e.target.value && setAsOf(e.target.value)} className="w-40" /></>}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
      kpis={r && (
        <>
          <StatCard label="Outstanding" value={formatMoney(r.totalOutstanding)} hint={`${r.customerCount} customer(s)`} tone="warning" />
          <StatCard label="0–30 days" value={formatMoney(r.totals.days0To30)} />
          <StatCard label="31–90 days" value={formatMoney(r.totals.days31To60 + r.totals.days61To90)} tone={r.totals.days31To60 + r.totals.days61To90 ? 'warning' : 'default'} />
          <StatCard label="Over 90 days" value={formatMoney(r.totals.over90)} tone={r.totals.over90 ? 'destructive' : 'default'} />
        </>
      )}
    >
      {r && (
        <DataTable
          columns={columns}
          data={r.customers}
          getRowId={(c) => c.customerId}
          onRowClick={(c) => router.push(`/customers/${c.customerId}`)}
          searchable
          emptyTitle="Nobody owes anything"
          csv={{
            fileName: `customer-aging-${asOf}`,
            columns: [
              { header: 'Customer', value: (c) => c.customerName }, { header: 'Phone', value: (c) => c.phoneNumber },
              { header: '0-30', value: (c) => c.buckets.days0To30 }, { header: '31-60', value: (c) => c.buckets.days31To60 },
              { header: '61-90', value: (c) => c.buckets.days61To90 }, { header: '90+', value: (c) => c.buckets.over90 },
              { header: 'Unapplied credit', value: (c) => c.unappliedCredit }, { header: 'Net balance', value: (c) => c.netBalance },
              { header: 'Oldest invoice', value: (c) => c.oldestOpenInvoiceDate },
            ],
          }}
        />
      )}
    </ReportLayout>
  );
}

export default function Page() {
  return <PermissionRoute permission="CustomerReports.View"><CustomerAging /></PermissionRoute>;
}
