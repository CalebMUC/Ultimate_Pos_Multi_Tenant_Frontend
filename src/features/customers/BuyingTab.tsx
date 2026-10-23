'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Lightbulb } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle, Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/primitives';
import { SimpleBarChart } from '@/components/shared/Charts';
import { DateRangeFilter, type DateRangeValue } from '@/components/shared/DateRange';
import { DetailList, MoneyText, StatCard } from '@/components/shared/Display';
import { EmptyState, ErrorState } from '@/components/shared/States';
import { customerInsightsApi } from '@/api/endpoints/customerInsights';
import { CustomerSuggestedAction, labels } from '@/api/enums';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { addDays, formatDateTime, formatMoney, formatQty, todayIso } from '@/lib/format';
import { daysAgo, DiscountBadge, everyDays, SegmentChip, suggestionText, SuggestionAction, type DiscountTarget } from './insights';
import type { CustomerInsightsDto } from '@/api/dto/customerInsights';
import type { CustomerMonthlySpendDto } from '@/api/dto/sales';
import { MonthlyRewardProgress } from '@/features/sales/customerDiscount';

/** "2026-10" → "Oct 26". */
const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-KE', { month: 'short', year: '2-digit' });
};

/** Litres read better as "960 L". */
const quantity = (value: number, unit: string | null) => formatQty(value, unit === 'l' ? 'L' : unit);

/** The API's default for one customer: the last 12 months. */
const last12Months = (): DateRangeValue => ({ from: addDays(todayIso(), -364), to: todayIso() });

/** How one customer has been buying. Every figure, segment and suggestion is the API's. */
export function BuyingTab({ customerId, onDiscount }: { customerId: string; onDiscount(target: DiscountTarget): void }) {
  const key = useQueryKey();
  const [range, setRange] = useState<DateRangeValue>(last12Months);
  const q = useQuery({ queryKey: key('customer-insights', { id: customerId, ...range }), queryFn: () => customerInsightsApi.get(customerId, range.from, range.to) });
  const d = q.data;

  return (
    <div className="space-y-4">
      <DateRangeFilter value={range} onChange={setRange} />
      {q.isLoading ? (
        <Skeleton className="h-64" />
      ) : q.error || !d ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <Insights d={d} onDiscount={() => onDiscount({
          customerId: d.customerId, customerName: d.customerName, discountPercent: d.discountPercent, discountNote: d.discountNote,
          discountSetAt: d.discountSetAt, maxDiscountPercent: d.maxDiscountPercent,
        })} />
      )}
    </div>
  );
}

function Insights({ d, onDiscount }: { d: CustomerInsightsDto; onDiscount(): void }) {
  const s = d.summary;
  const suggestion = s ? suggestionText[s.suggestedAction] : null;
  const payments = d.byPaymentMethod.map((p) => ({ method: labels.paymentMethod[p.paymentMethod] ?? 'Other', total: p.total, purchaseCount: p.purchaseCount }));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {s && <SegmentChip segment={s.segment} />}
        <DiscountBadge percent={d.discountPercent} long />
        {d.discountNote && <span className="text-xs text-muted-foreground">“{d.discountNote}”{d.discountSetAt ? `, ${formatDateTime(d.discountSetAt)}` : ''}</span>}
      </div>
      {s && suggestion && s.suggestedAction !== CustomerSuggestedAction.None && (
        <Alert variant={s.suggestedAction === CustomerSuggestedAction.WinBack ? 'warning' : 'info'}>
          <Lightbulb />
          <AlertTitle>{suggestion}</AlertTitle>
          <AlertDescription className="mt-2">
            <SuggestionAction action={s.suggestedAction} phoneNumber={d.phoneNumber} hasDiscount={!!d.discountPercent} onDiscount={onDiscount} compact />
          </AlertDescription>
        </Alert>
      )}
      {d.thisMonth && <ThisMonthCard month={d.thisMonth} />}
      {d.reasons.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground" aria-label="Why">
          {d.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}
      {!s ? (
        <EmptyState title="No purchases in this period." className="rounded-lg border border-dashed py-10" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Purchases" value={s.purchaseCount} hint={`Number ${s.spendRank} by spend`} />
            <StatCard label="Total spent" value={formatMoney(s.totalSpent)} hint={`Average ${formatMoney(s.averageSpend)}`} />
            <StatCard
              label="Buys"
              value={everyDays(s.averageDaysBetweenPurchases)}
              hint={d.typicalDaysBetweenPurchases !== null ? `Typical customer: ${everyDays(d.typicalDaysBetweenPurchases)}` : undefined}
            />
            <StatCard
              label="Last bought"
              value={daysAgo(s.daysSinceLastPurchase)}
              hint={s.firstPurchaseAt ? `First ever: ${formatDateTime(s.firstPurchaseAt)}` : undefined}
              tone={s.suggestedAction === CustomerSuggestedAction.WinBack ? 'destructive' : 'default'}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Spend by month</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <SimpleBarChart data={d.byMonth} x="month" y="total" xFormat={monthLabel} height={220} ariaLabel="Spend by month" detail={(m) => `${m.purchaseCount} purchase(s)`} />
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Purchases by month</p>
                  <SimpleBarChart data={d.byMonth} x="month" y="purchaseCount" xFormat={monthLabel} height={120} valueFormat={(v) => `${v} purchase(s)`} ariaLabel="Purchases by month" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">How they pay</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {payments.length ? (
                  <SimpleBarChart data={payments} x="method" y="total" horizontal ariaLabel="Spend by payment method" detail={(p) => `${p.purchaseCount} purchase(s)`} />
                ) : <p className="text-sm text-muted-foreground">No payments.</p>}
                <DetailList
                  columns={1}
                  items={[
                    { label: 'Where', value: `${d.boughtAtCounter} at the counter · ${d.deliveredByRider} delivered by rider` },
                    { label: 'Returned', value: formatMoney(d.returnedAmount) },
                    { label: 'Discount given in the period', value: formatMoney(s.discountGiven) },
                    ...(d.balance !== null ? [{ label: 'Owes now', value: formatMoney(d.balance) }] : []),
                    { label: 'Credit limit', value: d.creditLimit === null ? 'No limit' : formatMoney(d.creditLimit) },
                  ]}
                />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">What they buy</CardTitle></CardHeader>
            <CardContent>
              {d.topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {d.topProducts.map((p) => (
                    <li key={p.productId} className="flex items-center gap-3 py-2">
                      <span className="min-w-0 flex-1 truncate font-medium">{p.productName}</span>
                      <span className="text-muted-foreground tabular">{quantity(p.quantityInBaseUnits, p.baseUnitSymbol)}</span>
                      <MoneyText value={p.total} className="w-28 text-right font-semibold" />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

/** This calendar month against the monthly-spend reward, as the API reports it. */
function ThisMonthCard({ month }: { month: CustomerMonthlySpendDto }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">This month ({monthLabel(month.month)})</CardTitle>
        {month.qualifies && <Badge variant="success">Reward active</Badge>}
      </CardHeader>
      <CardContent className="space-y-3">
        <DetailList
          columns={3}
          items={[
            { label: 'Spent', value: formatMoney(month.spent) },
            { label: 'Threshold', value: `${formatMoney(month.threshold)} for ${month.percent}% off` },
            { label: 'Remaining', value: month.remainingToThreshold > 0 ? formatMoney(month.remainingToThreshold) : 'Reached' },
          ]}
        />
        <MonthlyRewardProgress month={month} />
        <p className="text-xs text-muted-foreground">Applies to: {labels.monthlyDiscountScope[month.scope]?.toLowerCase()}. Purchases at every branch count; walk-in sales never do.</p>
      </CardContent>
    </Card>
  );
}
