'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Banknote, Boxes, Factory, PackageX, Receipt, ShoppingCart, TrendingUp, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { SimpleBarChart, ShareList } from '@/components/shared/Charts';
import { DateRangeFilter, presetRange } from '@/components/shared/DateRange';
import { PageHeader, StatCard } from '@/components/shared/Display';
import { ErrorState } from '@/components/shared/States';
import { dashboardApi, reportsApi } from '@/api/endpoints/other';
import { humanize } from '@/api/mappers';
import { quickLinks } from '@/config/navigation';
import { useActiveBusiness, usePermission, usePermissions, useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateOnly, formatMoney, formatPercent } from '@/lib/format';
import { useSession } from '@/stores/session';
import { BranchFilterSelect } from '@/features/branches/BranchFilterSelect';
import { useBranchFilter } from '@/features/branches/branches';

const dayLabel = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
};

function Dashboard() {
  const key = useQueryKey();
  const can = usePermissions();
  const user = useSession((s) => s.user);
  const { capabilities } = useActiveBusiness();
  const canSalesReport = usePermission('SalesReports.View');
  const [range, setRange] = useState(() => presetRange('month'));
  const branch = useBranchFilter();
  const summary = useQuery({ queryKey: key('dashboard', { ...range, branchId: branch.branchId }), queryFn: () => dashboardApi.summary(range.from, range.to, branch.scope) });
  const sales = useQuery({ queryKey: key('dashboard', { sales: range, branchId: branch.branchId }), queryFn: () => reportsApi.sales(range.from, range.to, 5, branch.scope), enabled: canSalesReport });
  const d = summary.data;

  return (
    <>
      <PageHeader
        title={`Hello, ${user?.fullName.split(' ')[0] ?? ''}`}
        description={d ? `${formatDateOnly(d.from)} – ${formatDateOnly(d.to)}` : 'How the business is doing.'}
        actions={
          <>
            <BranchFilterSelect filter={branch} />
            <DateRangeFilter value={range} onChange={setRange} />
            {quickLinks.filter((q) => can(q.permission)).map((q) => (
              <Button key={q.href} asChild variant={q.href === '/pos' ? 'default' : 'outline'}><Link href={q.href}><q.icon />{q.label}</Link></Button>
            ))}
          </>
        }
      />
      {summary.error ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : !d ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[88px]" />)}</div>
      ) : (
        <div className="space-y-6">
          {d.sales && (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Revenue" value={formatMoney(d.sales.revenue)} hint={`${d.sales.saleCount} sale(s)`} icon={<TrendingUp />} />
              <StatCard label="Average sale" value={formatMoney(d.sales.averageSaleValue)} icon={<Receipt />} />
              <StatCard label="On credit" value={formatMoney(d.sales.creditSalesAmount)} icon={<Users />} />
              <StatCard
                label="Voided / pending"
                value={`${d.sales.voidedCount} / ${d.sales.pendingCount}`}
                hint={d.sales.pendingCount ? 'Pending M-Pesa payments need checking' : undefined}
                icon={<ShoppingCart />}
                tone={d.sales.pendingCount ? 'warning' : 'default'}
              />
            </section>
          )}
          {d.profit && (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Gross profit" value={formatMoney(d.profit.grossProfit)} hint={`Margin ${formatPercent(d.profit.grossMarginPercent)}`} icon={<TrendingUp />} tone={d.profit.grossProfit < 0 ? 'destructive' : 'success'} />
              <StatCard label="Operating expenses" value={formatMoney(d.profit.operatingExpenses)} icon={<Wallet />} />
              <StatCard label="Net profit" value={formatMoney(d.profit.netProfit)} hint={`Margin ${formatPercent(d.profit.netMarginPercent)}`} icon={<Banknote />} tone={d.profit.netProfit < 0 ? 'destructive' : 'success'} />
              <StatCard label="Cost of goods sold" value={formatMoney(d.profit.costOfGoodsSold)} icon={<Boxes />} />
              {!d.profit.isComplete && (
                <Alert variant="warning" className="sm:col-span-2 lg:col-span-4">
                  <AlertTriangle />
                  <AlertDescription>
                    {formatMoney(d.profit.uncostedRevenue)} of revenue came from products with no cost, so profit is overstated. <Link href="/inventory/valuation" className="underline">Find products missing cost</Link>.
                  </AlertDescription>
                </Alert>
              )}
            </section>
          )}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {d.receivables && (
              <>
                <StatCard label="Customers owe" value={formatMoney(d.receivables.totalOutstanding)} hint={`${d.receivables.customersOwing} customer(s)`} icon={<Users />} tone={d.receivables.totalOutstanding > 0 ? 'warning' : 'default'} />
                {d.receivables.customersInCredit > 0 && <StatCard label="Customer credit held" value={formatMoney(d.receivables.totalCustomerCredit)} hint={`${d.receivables.customersInCredit} customer(s)`} icon={<Wallet />} />}
              </>
            )}
            {d.stock && (
              <>
                <StatCard label="Low / out of stock" value={`${d.stock.lowStockCount} / ${d.stock.outOfStockCount}`} icon={<PackageX />} tone={d.stock.outOfStockCount ? 'destructive' : d.stock.lowStockCount ? 'warning' : 'success'} />
                {d.stock.totalStockValue !== null && <StatCard label="Stock value" value={formatMoney(d.stock.totalStockValue)} hint={d.stock.productsMissingCost ? `${d.stock.productsMissingCost} product(s) missing cost` : undefined} icon={<Boxes />} />}
              </>
            )}
            {d.production && capabilities.production && (
              <StatCard label="Production" value={`${d.production.runCount} run(s)`} hint={formatMoney(d.production.totalCost)} icon={<Factory />} />
            )}
          </section>

          {canSalesReport && sales.data && (
            <section className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle>Revenue by day</CardTitle></CardHeader>
                <CardContent>
                  {sales.data.byDay.length ? (
                    <SimpleBarChart data={sales.data.byDay} x="date" y="revenue" xFormat={dayLabel} ariaLabel="Revenue by day" />
                  ) : <p className="py-12 text-center text-sm text-muted-foreground">No sales in this period.</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Payment methods</CardTitle></CardHeader>
                <CardContent>
                  <ShareList items={sales.data.byPaymentMethod.map((p) => ({ label: humanize(p.paymentMethod), value: p.total, percent: p.percentOfRevenue, hint: `${p.saleCount}` }))} />
                </CardContent>
              </Card>
              <Card className="lg:col-span-3">
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Top products</CardTitle>
                  <Button variant="link" asChild><Link href="/reports/sales">Sales report</Link></Button>
                </CardHeader>
                <CardContent>
                  {sales.data.topProducts.length ? (
                    <SimpleBarChart data={sales.data.topProducts} x="productName" y="revenue" horizontal ariaLabel="Top products by revenue" />
                  ) : <p className="py-6 text-center text-sm text-muted-foreground">No sales in this period.</p>}
                </CardContent>
              </Card>
            </section>
          )}
          {d.hiddenSections.length > 0 && <p className="text-xs text-muted-foreground">Some sections are hidden because your role doesn’t include them.</p>}
        </div>
      )}
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Dashboard.View"><Dashboard /></PermissionRoute>;
}
