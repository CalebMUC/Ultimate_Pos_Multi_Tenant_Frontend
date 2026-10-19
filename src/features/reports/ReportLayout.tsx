'use client';

import type { ReactNode } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/primitives';
import { PageHeader } from '@/components/shared/Display';
import { ErrorState } from '@/components/shared/States';
import { useSession } from '@/stores/session';
import { BranchFilterSelect } from '@/features/branches/BranchFilterSelect';
import type { BranchFilter } from '@/features/branches/branches';
import { formatDateTime } from '@/lib/format';

/** Title, filters in one row, a KPI strip and the body. Prints with the business name and run time. */
export function ReportLayout({ title, description, filters, branchFilter, kpis, children, isLoading, error, onRetry }: {
  title: string;
  description?: ReactNode;
  filters?: ReactNode;
  /** Shown first in the filter row, for users who see more than one branch. */
  branchFilter?: BranchFilter;
  kpis?: ReactNode;
  children?: ReactNode;
  isLoading?: boolean;
  error?: unknown;
  onRetry?(): void;
}) {
  const business = useSession((s) => s.business);
  return (
    <div className="report">
      <PageHeader title={title} description={description} actions={<Button variant="outline" className="no-print" onClick={() => window.print()}><Printer />Print</Button>} />
      <p className="mb-3 hidden text-xs text-muted-foreground print:block">{business?.businessName} · printed {formatDateTime(new Date().toISOString())}</p>
      {(filters || branchFilter?.visible) && (
        <div className="no-print mb-4 flex flex-wrap items-center gap-2">
          {branchFilter && <BranchFilterSelect filter={branchFilter} />}
          {filters}
        </div>
      )}
      {branchFilter?.branchId && <p className="mb-3 hidden text-xs text-muted-foreground print:block">Branch: {branchFilter.branches.find((b) => b.branchId === branchFilter.branchId)?.name}</p>}
      {error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : isLoading ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px]" />)}</div>
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="space-y-4">
          {kpis && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{kpis}</div>}
          {children}
        </div>
      )}
    </div>
  );
}

/** Local calendar-day bounds as instants, for endpoints that take DateTimeOffset ranges. */
export function dayBounds(from: string, to: string) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return { start: new Date(fy, fm - 1, fd).toISOString(), end: new Date(ty, tm - 1, td + 1).toISOString() };
}
