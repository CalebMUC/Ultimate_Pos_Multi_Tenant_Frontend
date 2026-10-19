'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { ShareList } from '@/components/shared/Charts';
import { StatCard } from '@/components/shared/Display';
import { DateRangeFilter, presetRange } from '@/components/shared/DateRange';
import { expensesApi } from '@/api/endpoints/other';
import { humanize } from '@/api/mappers';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatMoney } from '@/lib/format';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { useBranchFilter } from '@/features/branches/branches';

function ExpenseSummary() {
  const key = useQueryKey();
  const branch = useBranchFilter();
  const [range, setRange] = useState(() => presetRange('month'));
  const q = useQuery({ queryKey: key('expenses', { summary: range, branchId: branch.branchId }), queryFn: () => expensesApi.summary(range.from, range.to, branch.scope) });
  const r = q.data;
  return (
    <ReportLayout
      branchFilter={branch}
      title="Expense summary"
      description="Posted expenses by category and payment method."
      filters={<DateRangeFilter value={range} onChange={setRange} />}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
      kpis={r && (
        <>
          <StatCard label="Total" value={formatMoney(r.totalExpenses)} hint={`${r.expenseCount} expense(s)`} />
          <StatCard label="Missing eTIMS" value={r.expensesMissingEtimsCount} hint={formatMoney(r.expensesMissingEtimsAmount)} tone={r.expensesMissingEtimsCount ? 'warning' : 'success'} />
        </>
      )}
    >
      {r && (
        <>
          {r.expensesMissingEtimsCount > 0 && (
            <Alert variant="warning"><AlertTriangle /><AlertDescription>{r.expensesMissingEtimsCount} expense(s) have no eTIMS control number and may not be deductible. <Link className="underline" href="/expenses">Review them</Link>.</AlertDescription></Alert>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>By category</CardTitle></CardHeader>
              <CardContent>{r.byCategory.length ? <ShareList items={r.byCategory.map((c) => ({ label: c.name, value: c.total, percent: c.percentOfTotal, hint: `${c.expenseCount}` }))} /> : <p className="text-sm text-muted-foreground">No expenses.</p>}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>By payment method</CardTitle></CardHeader>
              <CardContent>
                {r.byPaymentMethod.length ? (
                  <ShareList items={r.byPaymentMethod.map((m) => ({ label: humanize(m.paymentMethod), value: m.total, percent: r.totalExpenses ? (m.total / r.totalExpenses) * 100 : 0, hint: `${m.expenseCount}` }))} />
                ) : <p className="text-sm text-muted-foreground">No expenses.</p>}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </ReportLayout>
  );
}

export default function Page() {
  return <PermissionRoute permission="Expenses.View"><ExpenseSummary /></PermissionRoute>;
}
