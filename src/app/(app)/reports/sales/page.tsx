'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { ShareList, SimpleBarChart } from '@/components/shared/Charts';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { DateRangeFilter, presetRange } from '@/components/shared/DateRange';
import { MoneyText, QuantityText, StatCard } from '@/components/shared/Display';
import { reportsApi } from '@/api/endpoints/other';
import { humanize } from '@/api/mappers';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateOnly, formatMoney } from '@/lib/format';
import { ReportLayout } from '@/features/reports/ReportLayout';
import type { SalesByCustomerDto, SalesByDayDto, SalesByProductDto, SalesByProductUnitDto } from '@/api/dto/reports';
import { useBranchFilter } from '@/features/branches/branches';

const products: ColumnDef<SalesByProductDto, unknown>[] = [
  { header: 'Product', accessorKey: 'productName', cell: ({ row }) => <span className="font-medium">{row.original.productName}</span> },
  { header: 'SKU', accessorKey: 'sku' },
  { header: 'Qty (base)', accessorKey: 'quantitySoldInBaseUnits', meta: { align: 'right' }, cell: ({ row }) => <QuantityText value={row.original.quantitySoldInBaseUnits} /> },
  { header: 'Revenue', accessorKey: 'revenue', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.revenue} /> },
  { header: 'Share', accessorKey: 'percentOfRevenue', meta: { align: 'right' }, cell: ({ row }) => `${row.original.percentOfRevenue.toFixed(1)}%` },
];
const productUnits: ColumnDef<SalesByProductUnitDto, unknown>[] = [
  { header: 'Product', accessorKey: 'productName', cell: ({ row }) => <span className="font-medium">{row.original.productName}</span> },
  { header: 'Size', accessorKey: 'unitSymbol', cell: ({ row }) => <span className="font-semibold">{row.original.unitSymbol}</span> },
  { header: 'Qty sold', accessorKey: 'quantitySold', meta: { align: 'right' }, cell: ({ row }) => <QuantityText value={row.original.quantitySold} /> },
  { header: 'Qty (base)', accessorKey: 'quantitySoldInBaseUnits', meta: { align: 'right' }, cell: ({ row }) => <QuantityText value={row.original.quantitySoldInBaseUnits} /> },
  { header: 'Revenue', accessorKey: 'revenue', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.revenue} /> },
  { header: 'Share', accessorKey: 'percentOfRevenue', meta: { align: 'right' }, cell: ({ row }) => `${row.original.percentOfRevenue.toFixed(1)}%` },
];
const customers: ColumnDef<SalesByCustomerDto, unknown>[] = [
  { header: 'Customer', accessorKey: 'customerName', cell: ({ row }) => <span className="font-medium">{row.original.customerName}</span> },
  { header: 'Sales', accessorKey: 'saleCount', meta: { align: 'right' } },
  { header: 'Total', accessorKey: 'total', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.total} /> },
];
const days: ColumnDef<SalesByDayDto, unknown>[] = [
  { header: 'Date', accessorKey: 'date', cell: ({ row }) => formatDateOnly(row.original.date) },
  { header: 'Sales', accessorKey: 'saleCount', meta: { align: 'right' } },
  { header: 'Revenue', accessorKey: 'revenue', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.revenue} /> },
];

function SalesReport() {
  const key = useQueryKey();
  const branch = useBranchFilter();
  const [range, setRange] = useState(() => presetRange('month'));
  const q = useQuery({ queryKey: key('reports', { sales: range, branchId: branch.branchId }), queryFn: () => reportsApi.sales(range.from, range.to, 20, branch.scope) });
  const r = q.data;
  return (
    <ReportLayout
      branchFilter={branch}
      title="Sales report"
      description="Completed sales, by day, payment method, cashier, customer, product and size."
      filters={<DateRangeFilter value={range} onChange={setRange} />}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
      kpis={r && (
        <>
          <StatCard label="Revenue" value={formatMoney(r.revenue)} hint={`${r.saleCount} sale(s)`} />
          <StatCard label="Average sale" value={formatMoney(r.averageSaleValue)} />
          <StatCard label="Voided" value={formatMoney(r.voidedAmount)} hint={`${r.voidedCount} sale(s)`} />
          <StatCard label="Pending" value={formatMoney(r.pendingAmount)} hint={`${r.pendingCount} sale(s)`} tone={r.pendingCount ? 'warning' : 'default'} />
        </>
      )}
    >
      {r && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Revenue by day</CardTitle></CardHeader>
              <CardContent><SimpleBarChart data={r.byDay} x="date" y="revenue" xFormat={(d) => formatDateOnly(d).slice(0, 6)} ariaLabel="Revenue by day" /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>By payment method</CardTitle></CardHeader>
              <CardContent><ShareList items={r.byPaymentMethod.map((p) => ({ label: humanize(p.paymentMethod), value: p.total, percent: p.percentOfRevenue, hint: `${p.saleCount}` }))} /></CardContent>
            </Card>
          </div>
          {!!r.byCashier?.length && (
            <Card>
              <CardHeader><CardTitle>By cashier</CardTitle></CardHeader>
              <CardContent>
                <ShareList items={r.byCashier.map((c) => ({ label: c.cashierName ?? 'No user recorded', value: c.total, percent: c.percentOfRevenue, hint: `${c.saleCount}` }))} />
                <p className="mt-2 text-xs text-muted-foreground">Sale totals including VAT, like payment methods.</p>
              </CardContent>
            </Card>
          )}
          <h2 className="pt-2 font-semibold">Top products</h2>
          <DataTable columns={products} data={r.topProducts} getRowId={(p) => p.productId} emptyTitle="No sales" csv={{ fileName: `top-products-${range.from}-${range.to}`, columns: [{ header: 'SKU', value: (p) => p.sku }, { header: 'Product', value: (p) => p.productName }, { header: 'Qty', value: (p) => p.quantitySoldInBaseUnits }, { header: 'Revenue', value: (p) => p.revenue }] }} />
          {!!r.topProductUnits?.length && (
            <>
              <div className="pt-2">
                <h2 className="font-semibold">Sales by size</h2>
                <p className="text-xs text-muted-foreground">Each product per unit it was sold in, so a 20L and a 1L refill of the same stock are separate rows. Revenue excludes VAT and returns.</p>
              </div>
              <DataTable
                columns={productUnits}
                data={r.topProductUnits}
                getRowId={(u) => `${u.productId}:${u.unitOfMeasureId}`}
                emptyTitle="No sales"
                csv={{ fileName: `sales-by-size-${range.from}-${range.to}`, columns: [{ header: 'SKU', value: (u) => u.sku }, { header: 'Product', value: (u) => u.productName }, { header: 'Size', value: (u) => u.unitSymbol }, { header: 'Qty', value: (u) => u.quantitySold }, { header: 'Qty (base)', value: (u) => u.quantitySoldInBaseUnits }, { header: 'Revenue', value: (u) => u.revenue }] }}
              />
            </>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2"><h2 className="font-semibold">Top customers</h2><DataTable columns={customers} data={r.topCustomers} getRowId={(c) => c.customerId ?? 'walk-in'} emptyTitle="No sales" /></div>
            <div className="space-y-2"><h2 className="font-semibold">By day</h2><DataTable columns={days} data={r.byDay} getRowId={(d) => d.date} pageSize={10} emptyTitle="No sales" csv={{ fileName: `sales-by-day-${range.from}-${range.to}`, columns: [{ header: 'Date', value: (d) => d.date }, { header: 'Sales', value: (d) => d.saleCount }, { header: 'Revenue', value: (d) => d.revenue }] }} /></div>
          </div>
        </>
      )}
    </ReportLayout>
  );
}

export default function Page() {
  return <PermissionRoute permission="SalesReports.View"><SalesReport /></PermissionRoute>;
}
