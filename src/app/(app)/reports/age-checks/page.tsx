'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText } from '@/components/shared/Display';
import { DateRangeFilter, presetRange } from '@/components/shared/DateRange';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';
import { salesApi } from '@/api/endpoints/sales';
import { AgeCheckMethod, DeliveryMode, SaleStatus, labels } from '@/api/enums';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateTime, formatPercent, formatQty } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { cashierAgeChecks, EVENING_FROM_HOUR, needsLook, restrictedTotal } from '@/features/ageRestricted/register';
import type { AgeCheckRegisterEntryDto } from '@/api/dto/sales';

const items = (e: AgeCheckRegisterEntryDto) => e.lines.map((l) => `${formatQty(l.quantity, l.unitSymbol)} × ${l.productName}`);

const columns: ColumnDef<AgeCheckRegisterEntryDto, unknown>[] = [
  { header: 'Time', accessorKey: 'soldAt', cell: ({ row }) => <span className="whitespace-nowrap">{formatDateTime(row.original.soldAt)}</span> },
  {
    header: 'Sale',
    accessorKey: 'saleNumber',
    cell: ({ row }) => (
      <span className="flex flex-wrap items-center gap-1">
        <Link href={`/sales/${row.original.saleId}`} className="font-medium text-primary hover:underline">{row.original.saleNumber}</Link>
        {row.original.deliveryMode === DeliveryMode.Rider && <Badge variant="info">Delivery</Badge>}
        {row.original.saleStatus === SaleStatus.Voided && <Badge variant="secondary">Voided</Badge>}
      </span>
    ),
  },
  { header: 'Cashier', accessorKey: 'checkedByName', cell: ({ row }) => row.original.checkedByName ?? '—' },
  {
    header: 'Age checked by',
    accessorKey: 'ageCheck',
    cell: ({ row }) => (
      <span className={cn(row.original.ageCheck === AgeCheckMethod.KnownCustomer && 'font-medium text-warning-foreground dark:text-warning')}>
        {labels.ageCheckMethod[row.original.ageCheck]}
      </span>
    ),
  },
  { header: 'Customer', accessorKey: 'customerName', cell: ({ row }) => row.original.customerName ?? 'Walk-in' },
  { header: '18+ items', id: 'items', cell: ({ row }) => <ul className="text-xs">{items(row.original).map((t, i) => <li key={i}>{t}</li>)}</ul> },
  { header: '18+ total', id: 'total', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={restrictedTotal(row.original)} /> },
];

/** Per cashier: sales of alcohol or tobacco, and how many were recorded as a regular whose ID was seen before. */
function ByCashier({ entries }: { entries: AgeCheckRegisterEntryDto[] }) {
  const rows = cashierAgeChecks(entries);
  if (rows.length === 0) return null;
  return (
    <Card className="break-inside-avoid">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">By cashier</CardTitle>
        <CardDescription>A cashier who records “Regular” on most sales, or most evening sales (from {EVENING_FROM_HOUR}:00), may not be asking for ID.</CardDescription>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-medium">Cashier</th>
              <th className="py-1 text-right font-medium">Sales</th>
              <th className="py-1 text-right font-medium">Regular: ID seen before</th>
              <th className="py-1 text-right font-medium">Evening: regular</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((c) => {
              const flag = needsLook(c);
              return (
                <tr key={c.name} className={cn(flag && 'bg-warning/10')}>
                  <td className="py-1.5">
                    <span className="flex items-center gap-1.5">
                      {flag && <AlertTriangle className="size-3.5 text-warning" aria-label="Most sales recorded as regular" />}
                      {c.name}
                    </span>
                  </td>
                  <td className="py-1.5 text-right tabular">{c.sales}</td>
                  <td className="py-1.5 text-right tabular">{c.regular} <span className="text-muted-foreground">({formatPercent(c.regularShare)})</span></td>
                  <td className="py-1.5 text-right tabular">
                    {c.eveningRegularShare === null ? '—' : <>{c.eveningRegular} of {c.eveningSales} <span className="text-muted-foreground">({formatPercent(c.eveningRegularShare)})</span></>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/**
 * Reports → Age-check register: every sale of alcohol or tobacco, how the customer's age was checked and by whom. What the owner shows
 * an inspector (Print, or save as PDF from the print dialog). Soda-only sales are not in it.
 */
function AgeCheckRegister() {
  const key = useQueryKey();
  const [range, setRange] = useState(() => presetRange('today'));
  const q = useQuery({ queryKey: key('sales', { ageChecks: range }), queryFn: () => salesApi.ageChecks(range) });
  const entries = q.data ?? [];
  return (
    <ReportLayout
      title="Age-check register"
      description="Every sale of alcohol or tobacco: how the customer’s age was checked, and by whom. Print it, or save it as a PDF, for an inspector."
      filters={<DateRangeFilter value={range} onChange={setRange} />}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
    >
      <ByCashier entries={entries} />
      <DataTable
        columns={columns}
        data={q.data}
        // Printed whole for an inspector: no paging.
        pageSize={1000}
        getRowId={(e) => e.saleId}
        emptyTitle="No sales of alcohol or tobacco in this period"
        csv={{
          fileName: `age-check-register-${range.from}-${range.to}`,
          columns: [
            { header: 'Time', value: (e) => e.soldAt },
            { header: 'Sale', value: (e) => e.saleNumber },
            { header: 'Status', value: (e) => labels.saleStatus[e.saleStatus] },
            { header: 'Delivery', value: (e) => (e.deliveryMode === DeliveryMode.Rider ? 'Yes' : 'No') },
            { header: 'Cashier', value: (e) => e.checkedByName },
            { header: 'Age checked by', value: (e) => labels.ageCheckMethod[e.ageCheck] },
            { header: 'Customer', value: (e) => e.customerName },
            { header: '18+ items', value: (e) => items(e).join('; ') },
            { header: '18+ total', value: (e) => restrictedTotal(e) },
          ],
        }}
      />
    </ReportLayout>
  );
}

export default function Page() {
  return <PermissionRoute permission="SalesReports.View" module="ageRestricted"><AgeCheckRegister /></PermissionRoute>;
}
