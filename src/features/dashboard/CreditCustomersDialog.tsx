'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { Skeleton } from '@/components/ui/primitives';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import type { DateRangeValue } from '@/components/shared/DateRange';
import { MoneyText, StatCard } from '@/components/shared/Display';
import { dashboardApi } from '@/api/endpoints/other';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateOnly, formatDateTime, formatMoney } from '@/lib/format';
import { useReturnFocus } from '@/features/dashboard/useReturnFocus';
import type { BranchFilter } from '@/features/branches/branches';
import type { CsvColumn } from '@/lib/csv';
import type { DashboardCreditCustomerDto } from '@/api/dto/reports';

type Row = DashboardCreditCustomerDto;

/** Null means the user may not see the balance, never that it is zero. */
function OwesNow({ value }: { value: number | null }) {
  if (value === null) return <>—</>;
  if (value > 0) return <MoneyText value={value} currency={false} className="font-medium text-warning" />;
  if (value < 0) return <span className="whitespace-nowrap text-muted-foreground">Prepaid <MoneyText value={-value} currency={false} /></span>;
  return <span className="text-muted-foreground">Paid</span>;
}

/** The customers behind the dashboard's Sold on credit card, for the same dates and branch. */
export function CreditCustomersDialog({ open, onOpenChange, range, branch }: { open: boolean; onOpenChange(open: boolean): void; range: DateRangeValue; branch: BranchFilter }) {
  const key = useQueryKey();
  const canCustomers = usePermission('Customers.View');
  const canLedger = usePermission('Customers.ViewLedger');
  const canAging = usePermission('CustomerReports.View');
  const returnFocus = useReturnFocus();
  const q = useQuery({
    queryKey: key('dashboard', { creditCustomers: range, branchId: branch.branchId }),
    queryFn: () => dashboardApi.creditCustomers(range.from, range.to, branch.scope),
    enabled: open,
  });
  const r = q.data;

  const columns = useMemo(() => {
    const list: ColumnDef<Row, unknown>[] = [
      {
        header: 'Customer',
        accessorKey: 'customerName',
        cell: ({ row }) => (canCustomers
          ? <Link href={`/customers/${row.original.customerId}`} className="font-medium hover:underline">{row.original.customerName}</Link>
          : <span className="font-medium">{row.original.customerName}</span>),
      },
    ];
    if (canCustomers) {
      list.push({
        header: 'Phone',
        accessorKey: 'phoneNumber',
        cell: ({ row }) => (row.original.phoneNumber ? <a href={`tel:${row.original.phoneNumber}`} className="whitespace-nowrap hover:underline">{row.original.phoneNumber}</a> : '—'),
      });
    }
    list.push(
      { header: 'Sales', accessorKey: 'saleCount', meta: { align: 'right' } },
      { header: 'Sold on credit', accessorKey: 'creditSalesAmount', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.creditSalesAmount} currency={false} /> },
      { header: 'Last sale', accessorKey: 'lastSaleAt', cell: ({ row }) => <span className="whitespace-nowrap">{formatDateTime(row.original.lastSaleAt)}</span> },
    );
    if (canLedger) {
      list.push({ header: 'Owes now', accessorKey: 'outstandingBalance', meta: { align: 'right' }, cell: ({ row }) => <OwesNow value={row.original.outstandingBalance} /> });
    }
    return list;
  }, [canCustomers, canLedger]);

  const csvColumns: CsvColumn<Row>[] = [
    { header: 'Customer', value: (x) => x.customerName },
    ...(canCustomers ? [{ header: 'Phone', value: (x: Row) => x.phoneNumber }] : []),
    { header: 'Sales', value: (x) => x.saleCount },
    { header: 'Sold on credit', value: (x) => x.creditSalesAmount },
    { header: 'Last sale', value: (x) => formatDateTime(x.lastSaleAt) },
    ...(canLedger ? [{ header: 'Owes now', value: (x: Row) => x.outstandingBalance }] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="grid-cols-[minmax(0,1fr)]" {...returnFocus}>
        <DialogHeader>
          <DialogTitle>Customers on credit</DialogTitle>
          <DialogDescription>{formatDateOnly(range.from)} – {formatDateOnly(range.to)}</DialogDescription>
        </DialogHeader>
        {r ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Sold on credit" value={formatMoney(r.totalCreditSales)} hint="Before any payments or returns" />
            <StatCard label="Customers" value={r.customerCount} />
          </div>
        ) : q.isLoading && <Skeleton className="h-[88px]" />}
        <DataTable
          columns={columns}
          data={r?.customers}
          isLoading={q.isLoading}
          error={q.error}
          onRetry={() => q.refetch()}
          getRowId={(x) => x.customerId}
          searchable
          emptyTitle="No credit sales in this period."
          csv={{ fileName: `credit-customers-${range.from}-${range.to}`, columns: csvColumns }}
        />
        {canLedger && <p className="text-xs text-muted-foreground">Owes now covers all branches and all dates, so it can differ from the amount on credit in this period.</p>}
        {canAging && (
          <DialogFooter>
            <Button variant="link" asChild><Link href="/reports/customer-aging">See everyone who owes</Link></Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
