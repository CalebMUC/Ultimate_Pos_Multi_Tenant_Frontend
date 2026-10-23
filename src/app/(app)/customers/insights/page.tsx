'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays';
import { Card, CardContent, CardHeader, CardTitle, NativeSelect } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { SimpleBarChart } from '@/components/shared/Charts';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { DateRangeFilter, type DateRangeValue } from '@/components/shared/DateRange';
import { MoneyText, PageHeader } from '@/components/shared/Display';
import { EnumSelect } from '@/components/shared/Pickers';
import { customerInsightsApi } from '@/api/endpoints/customerInsights';
import { CustomerInsightsSort, CustomerSegment, CustomerSuggestedAction, enumOptions, labels } from '@/api/enums';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { cn } from '@/lib/utils';
import {
  daysAgo, DiscountBadge, DiscountDialog, everyDays, last90Days, SegmentChip, SegmentHelp, suggestionText, SuggestionAction, type DiscountTarget,
} from '@/features/customers/insights';
import type { CustomerBuyingSummaryDto } from '@/api/dto/customerInsights';

const SEGMENTS = [CustomerSegment.Top, CustomerSegment.Regular, CustomerSegment.Slipping, CustomerSegment.New, CustomerSegment.Occasional];

/** A number from the query string that is one of the enum's values, else null. */
function enumParam<T extends number>(value: string | null, map: Record<T, string>): T | null {
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n in map ? (n as T) : null;
}

function Insights() {
  const key = useQueryKey();
  const router = useRouter();
  const params = useSearchParams();
  const [range, setRange] = useState<DateRangeValue>(last90Days);
  const [segment, setSegment] = useState<CustomerSegment | null>(() => enumParam(params.get('segment'), labels.customerSegment));
  const [action, setAction] = useState<CustomerSuggestedAction | null>(() => enumParam(params.get('suggestedAction'), labels.customerSuggestedAction));
  const [sort, setSort] = useState<CustomerInsightsSort>(CustomerInsightsSort.Spend);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [target, setTarget] = useState<DiscountTarget | null>(null);
  const debounced = useDebouncedValue(search.trim(), 300);
  const query = {
    ...range, segment: segment ?? undefined, suggestedAction: action ?? undefined, search: debounced || undefined, sort, page, pageSize,
  };
  const q = useQuery({ queryKey: key('customer-insights', query), queryFn: () => customerInsightsApi.list(query), placeholderData: keepPreviousData });
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };
  // In the order the API returned them: the chart never re-ranks.
  const chartRows = (q.data?.items ?? []).slice(0, 10);

  const columns: ColumnDef<CustomerBuyingSummaryDto, unknown>[] = [
    { header: '#', accessorKey: 'spendRank', meta: { align: 'right' }, cell: ({ row }) => <span className="text-muted-foreground tabular">{row.original.spendRank}</span> },
    {
      header: 'Customer',
      accessorKey: 'customerName',
      cell: ({ row }) => <span className="flex items-center gap-1.5 font-medium">{row.original.customerName}<DiscountBadge percent={row.original.discountPercent} /></span>,
    },
    { header: 'Phone', accessorKey: 'phoneNumber', cell: ({ row }) => row.original.phoneNumber ?? '—' },
    { header: 'Purchases', accessorKey: 'purchaseCount', meta: { align: 'right' } },
    { header: 'Total spent', accessorKey: 'totalSpent', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.totalSpent} className="font-medium" /> },
    { header: 'Average', accessorKey: 'averageSpend', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.averageSpend} /> },
    { header: 'Buys', accessorKey: 'averageDaysBetweenPurchases', cell: ({ row }) => everyDays(row.original.averageDaysBetweenPurchases) },
    { header: 'Last bought', accessorKey: 'daysSinceLastPurchase', cell: ({ row }) => daysAgo(row.original.daysSinceLastPurchase) },
    { header: 'Discount', accessorKey: 'discountPercent', meta: { align: 'right' }, cell: ({ row }) => (row.original.discountPercent ? `${row.original.discountPercent}%` : '—') },
    { header: 'Segment', accessorKey: 'segment', cell: ({ row }) => <SegmentChip segment={row.original.segment} /> },
    {
      header: 'Suggestion',
      id: 'suggestion',
      cell: ({ row }) => {
        const c = row.original;
        const text = suggestionText[c.suggestedAction];
        if (!text) return null;
        return (
          <span className="flex items-center gap-2">
            <span className="text-xs">{text}</span>
            <SuggestionAction
              compact
              action={c.suggestedAction}
              phoneNumber={c.phoneNumber}
              hasDiscount={!!c.discountPercent}
              onDiscount={() => setTarget({ customerId: c.customerId, customerName: c.customerName, discountPercent: c.discountPercent })}
            />
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Buying insights"
        description="How each customer has been buying, ranked against your other customers. The system suggests; you decide who gets a discount."
        actions={
          <>
            <Popover>
              <PopoverTrigger asChild><Button variant="ghost"><HelpCircle />What the segments mean</Button></PopoverTrigger>
              <PopoverContent align="end" className="w-96"><SegmentHelp /></PopoverContent>
            </Popover>
            <Button variant="ghost" asChild><Link href="/customers"><ArrowLeft />Customers</Link></Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Segment">
        <Chip active={segment === null} onClick={() => reset(setSegment)(null)}>All</Chip>
        {SEGMENTS.map((s) => (
          <Chip key={s} active={segment === s} onClick={() => reset(setSegment)(segment === s ? null : s)}>{labels.customerSegment[s]}</Chip>
        ))}
      </div>
      {chartRows.length > 1 && (
        <Card className="mb-4">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Spend by customer{q.data && q.data.meta.totalCount > chartRows.length ? ' (first 10 shown)' : ''}</CardTitle></CardHeader>
          <CardContent>
            <SimpleBarChart
              data={chartRows}
              x="customerName"
              y="totalSpent"
              horizontal
              ariaLabel="Spend by customer"
              detail={(c) => `${c.purchaseCount} purchase(s) · ${everyDays(c.averageDaysBetweenPurchases)}`}
            />
          </CardContent>
        </Card>
      )}
      <DataTable
        mode="server"
        columns={columns}
        data={q.data?.items}
        isLoading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        getRowId={(c) => c.customerId}
        onRowClick={(c) => router.push(`/customers/${c.customerId}?tab=buying`)}
        page={page}
        pageSize={pageSize}
        totalCount={q.data?.meta.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={reset(setPageSize)}
        search={search}
        onSearchChange={reset(setSearch)}
        searchPlaceholder="Name or phone…"
        emptyTitle="No customer bought in this period"
        emptyMessage="Only customers who bought in the period are listed. Walk-in sales have no customer."
        toolbar={
          <>
            <DateRangeFilter value={range} onChange={reset(setRange)} />
            <EnumSelect map={labels.customerSuggestedAction} value={action} onChange={reset(setAction)} placeholder="Any suggestion" className="w-44" aria-label="Suggestion" />
            <NativeSelect value={sort} onChange={(e) => reset(setSort)(Number(e.target.value) as CustomerInsightsSort)} className="w-40" aria-label="Sort">
              {enumOptions(labels.customerInsightsSort).map((o) => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
            </NativeSelect>
          </>
        }
        csv={{
          fileName: `customer-insights-${range.from}-to-${range.to}`,
          columns: [
            { header: 'Rank', value: (c) => c.spendRank },
            { header: 'Customer', value: (c) => c.customerName },
            { header: 'Phone', value: (c) => c.phoneNumber },
            { header: 'Purchases', value: (c) => c.purchaseCount },
            { header: 'Total spent', value: (c) => c.totalSpent },
            { header: 'Average', value: (c) => c.averageSpend },
            { header: 'Days between purchases', value: (c) => c.averageDaysBetweenPurchases },
            { header: 'Days since last', value: (c) => c.daysSinceLastPurchase },
            { header: 'Discount %', value: (c) => c.discountPercent },
            { header: 'Discount given', value: (c) => c.discountGiven },
            { header: 'Segment', value: (c) => labels.customerSegment[c.segment] },
            { header: 'Suggestion', value: (c) => suggestionText[c.suggestedAction] },
          ],
        }}
      />
      <DiscountDialog target={target} open={!!target} onOpenChange={(o) => !o && setTarget(null)} />
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick(): void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent')}
    >
      {children}
    </button>
  );
}

export default function Page() {
  return <PermissionRoute permission="Customers.ViewInsights"><Insights /></PermissionRoute>;
}
