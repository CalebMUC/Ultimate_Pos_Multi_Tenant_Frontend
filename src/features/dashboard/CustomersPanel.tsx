'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { BadgePercent, Phone, Sparkles, TrendingDown, UserCheck, Users, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { SplitBar } from '@/components/shared/Charts';
import { StatCard } from '@/components/shared/Display';
import { CustomerSegment, CustomerSuggestedAction } from '@/api/enums';
import { usePermission } from '@/hooks/useSessionInfo';
import { formatDateOnly, formatMoney } from '@/lib/format';
import { daysAgo, DiscountBadge, DiscountDialog, everyDays, SegmentChip, type DiscountTarget } from '@/features/customers/insights';
import type { CustomerBuyingSummaryDto, DashboardCustomersDto } from '@/api/dto/customerInsights';

const buyingTab = (id: string) => `/customers/${id}?tab=buying`;

/** Who buys, who's drifting away and who might deserve a discount: always the last 90 days, whatever dates the dashboard shows. */
export function CustomersPanel({ data }: { data: DashboardCustomersDto }) {
  const canManage = usePermission('Customers.ManageDiscount');
  const [target, setTarget] = useState<DiscountTarget | null>(null);
  const give = (c: CustomerBuyingSummaryDto) => setTarget({ customerId: c.customerId, customerName: c.customerName, discountPercent: c.discountPercent });

  return (
    <section className="space-y-3" aria-label="Customers">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Customers <span className="text-sm font-normal text-muted-foreground">· Last 90 days ({formatDateOnly(data.from)} – {formatDateOnly(data.to)})</span></h2>
        <Button variant="link" asChild className="h-auto p-0"><Link href="/customers/insights">Buying insights</Link></Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active customers" value={data.activeCustomers} icon={<Users />} />
        <StatCard label="Regulars" value={data.regularCustomers} icon={<UserCheck />} tone="success" />
        <StatCard label="New" value={data.newCustomers} icon={<Sparkles />} />
        <StatCard label="Slipping away" value={data.slippingCustomers} icon={<TrendingDown />} tone={data.slippingCustomers > 0 ? 'destructive' : 'default'} />
        <StatCard label="Discount candidates" value={data.discountCandidates} icon={<BadgePercent />} tone={data.discountCandidates > 0 ? 'warning' : 'default'} />
        <StatCard label="With a discount" value={data.customersWithDiscount} icon={<UsersRound />} />
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Registered vs walk-in revenue</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <SplitBar
            ariaLabel="Revenue from registered customers against walk-in sales"
            parts={[{ label: 'Registered customers', value: data.registeredRevenue }, { label: 'Walk-in', value: data.walkInRevenue }]}
          />
          <p className="text-xs text-muted-foreground">Walk-in buyers can’t be rewarded or followed up. Register regulars at the till.</p>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <ShortList title="Top customers" seeAll={`/customers/insights?segment=${CustomerSegment.Top}`} rows={data.topCustomers} empty="No customer purchases yet.">
          {(c) => (
            <>
              <RowMain c={c} sub={`${c.purchaseCount} purchase(s)`} />
              <span className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold tabular">{formatMoney(c.totalSpent)}</span>
                <SegmentChip segment={c.segment} />
              </span>
            </>
          )}
        </ShortList>
        <ShortList title="Consider a discount" seeAll={`/customers/insights?suggestedAction=${CustomerSuggestedAction.ConsiderDiscount}`} rows={data.candidates} empty="No one to suggest right now.">
          {(c) => (
            <>
              <RowMain c={c} sub={`${c.purchaseCount} purchase(s) · ${everyDays(c.averageDaysBetweenPurchases)}`} />
              {canManage && <Button size="sm" variant="outline" onClick={(e) => { e.preventDefault(); give(c); }}><BadgePercent />Give discount</Button>}
            </>
          )}
        </ShortList>
        <ShortList title="Slipping away" seeAll={`/customers/insights?segment=${CustomerSegment.Slipping}`} rows={data.slipping} empty="No one is slipping away.">
          {(c) => (
            <>
              <RowMain c={c} sub={`Last bought ${daysAgo(c.daysSinceLastPurchase)}`} />
              {c.phoneNumber && (
                <Button size="sm" variant="ghost" asChild onClick={(e) => e.stopPropagation()}>
                  <a href={`tel:${c.phoneNumber}`} aria-label={`Call ${c.customerName}`}><Phone /></a>
                </Button>
              )}
            </>
          )}
        </ShortList>
      </div>
      <DiscountDialog target={target} open={!!target} onOpenChange={(o) => !o && setTarget(null)} />
    </section>
  );
}

function RowMain({ c, sub }: { c: CustomerBuyingSummaryDto; sub: string }) {
  return (
    <Link href={buyingTab(c.customerId)} className="min-w-0 flex-1 hover:underline">
      <span className="flex items-center gap-1.5 truncate text-sm font-medium">{c.customerName}<DiscountBadge percent={c.discountPercent} /></span>
      <span className="block text-xs text-muted-foreground">{sub}</span>
    </Link>
  );
}

function ShortList({ title, seeAll, rows, empty, children }: {
  title: string;
  seeAll: string;
  rows: CustomerBuyingSummaryDto[];
  empty: string;
  children(c: CustomerBuyingSummaryDto): ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <Button variant="link" size="sm" asChild className="h-auto p-0"><Link href={seeAll}>See all</Link></Button>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y">
            {rows.map((c) => <li key={c.customerId} className="flex items-center gap-2 py-2">{children(c)}</li>)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
