'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, Card, CardContent, Table, TableBody, TableCell, TableRow } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { DateRangeFilter, presetRange } from '@/components/shared/DateRange';
import { StatCard } from '@/components/shared/Display';
import { costingApi } from '@/api/endpoints/inventory';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatMoney, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ReportLayout } from '@/features/reports/ReportLayout';

function Line({ label, value, strong, indent, negative }: { label: string; value: number; strong?: boolean; indent?: boolean; negative?: boolean }) {
  return (
    <TableRow className={cn(strong && 'bg-muted/40 font-semibold')}>
      <TableCell className={cn(indent && 'pl-8 text-muted-foreground')}>{label}</TableCell>
      <TableCell className={cn('text-right tabular', value < 0 && 'text-destructive')}>{negative && value ? `(${formatMoney(value, { currency: false })})` : formatMoney(value, { currency: false })}</TableCell>
    </TableRow>
  );
}

function ProfitAndLoss() {
  const key = useQueryKey();
  const [range, setRange] = useState(() => presetRange('month'));
  const q = useQuery({ queryKey: key('reports', { pnl: range }), queryFn: () => costingApi.profitAndLoss(range.from, range.to) });
  const r = q.data;
  return (
    <ReportLayout
      title="Profit & loss"
      description="Revenue (excluding VAT) less cost of goods sold and operating expenses."
      filters={<DateRangeFilter value={range} onChange={setRange} />}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
      kpis={r && (
        <>
          <StatCard label="Revenue" value={formatMoney(r.revenue)} />
          <StatCard label="Gross profit" value={formatMoney(r.grossProfit)} hint={`Margin ${formatPercent(r.grossMarginPercent)}`} tone={r.grossProfit < 0 ? 'destructive' : 'success'} />
          <StatCard label="Expenses" value={formatMoney(r.totalOperatingExpenses)} />
          <StatCard label="Net profit" value={formatMoney(r.netProfit)} hint={`Margin ${formatPercent(r.netMarginPercent)}`} tone={r.netProfit < 0 ? 'destructive' : 'success'} />
        </>
      )}
    >
      {r && (
        <>
          {!r.isComplete && (
            <Alert variant="warning"><AlertTriangle /><AlertDescription>{formatMoney(r.uncostedRevenue)} of revenue is from products with no cost, so gross profit is overstated. Revalue those products.</AlertDescription></Alert>
          )}
          <Card className="max-w-2xl overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  <Line label="Revenue" value={r.revenue} strong />
                  <Line label="Cost of goods sold" value={r.costOfGoodsSold} negative indent />
                  <Line label="Gross profit" value={r.grossProfit} strong />
                  {r.operatingExpenses.map((e) => <Line key={e.expenseCategoryId} label={`${e.name} (${e.expenseCount})`} value={e.total} negative indent />)}
                  <Line label="Total operating expenses" value={r.totalOperatingExpenses} negative />
                  <Line label="Net profit" value={r.netProfit} strong />
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </ReportLayout>
  );
}

export default function Page() {
  return <PermissionRoute permission="Costing.View"><ProfitAndLoss /></PermissionRoute>;
}
