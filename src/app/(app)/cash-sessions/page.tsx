'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { Badge, Skeleton } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { DateRangeFilter, presetRange } from '@/components/shared/DateRange';
import { MoneyText, PageHeader } from '@/components/shared/Display';
import { EnumSelect } from '@/components/shared/Pickers';
import { EmptyState, ErrorState } from '@/components/shared/States';
import { cashSessionsApi } from '@/api/endpoints/cashSessions';
import { CashSessionStatus, labels } from '@/api/enums';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateTime } from '@/lib/format';
import { useSession } from '@/stores/session';
import { CashSessionView, OpenDayCard, VarianceText } from '@/features/cashSessions/CashSessionViews';
import { useCurrentCashSession } from '@/features/cashSessions/OpenDayBanner';
import type { CashSessionDto } from '@/api/dto/cashSessions';

const columns: ColumnDef<CashSessionDto, unknown>[] = [
  { header: 'Session', accessorKey: 'sessionNumber', cell: ({ row }) => <span className="font-medium">{row.original.sessionNumber}</span> },
  { header: 'Opened', accessorKey: 'openedAt', cell: ({ row }) => formatDateTime(row.original.openedAt) },
  { header: 'Branch', id: 'branch', cell: ({ row }) => (row.original.kraBranchId ? `${row.original.kraBranchId} ${row.original.branchName ?? ''}` : row.original.branchName ?? '—') },
  { header: 'Float', accessorKey: 'openingFloat', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.openingFloat} /> },
  { header: 'Expected', id: 'expected', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.breakdown.expectedCash} /> },
  { header: 'Counted', accessorKey: 'countedCash', meta: { align: 'right' }, cell: ({ row }) => (row.original.countedCash === null ? '—' : <MoneyText value={row.original.countedCash} />) },
  { header: 'Variance', accessorKey: 'variance', meta: { align: 'right' }, cell: ({ row }) => <VarianceText value={row.original.variance} /> },
  { header: 'Opened by', accessorKey: 'openedByName', cell: ({ row }) => row.original.openedByName ?? '—' },
  { header: 'Closed by', accessorKey: 'closedByName', cell: ({ row }) => row.original.closedByName ?? '—' },
  {
    header: 'Status',
    accessorKey: 'status',
    cell: ({ row }) => <Badge variant={row.original.status === CashSessionStatus.Open ? 'success' : 'secondary'}>{labels.cashSessionStatus[row.original.status]}</Badge>,
  },
];

function CashUp() {
  return (
    <>
      <PageHeader title="Cash-up" description="The day’s float and the end-of-day count at the branch signed in to. What should be in the drawer is worked out by the system." />
      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="mt-3"><Today /></TabsContent>
        <TabsContent value="history" className="mt-3"><History /></TabsContent>
      </Tabs>
    </>
  );
}

function Today() {
  const current = useCurrentCashSession();
  const canOpen = usePermission('CashSessions.Open');
  const branchName = useSession((s) => s.branches.find((b) => b.branchId === s.activeBranchId)?.name);
  if (current.isLoading) return <Skeleton className="h-64" />;
  if (current.error) return <ErrorState error={current.error} onRetry={() => current.refetch()} />;
  if (current.data) return <CashSessionView session={current.data} />;
  return canOpen ? (
    <OpenDayCard />
  ) : (
    <EmptyState
      title="The day has not been opened"
      message={`No float has been given${branchName ? ` at ${branchName}` : ''} today. Ask a manager to open the day with the float.`}
      className="rounded-lg border border-dashed py-12"
    />
  );
}

function History() {
  const key = useQueryKey();
  const router = useRouter();
  const [range, setRange] = useState(() => presetRange('30d'));
  const [status, setStatus] = useState<CashSessionStatus | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const params = { ...range, status: status ?? undefined, page, pageSize };
  const query = useQuery({ queryKey: key('cash-sessions', params), queryFn: () => cashSessionsApi.list(params), placeholderData: keepPreviousData });
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };
  return (
    <DataTable
      mode="server"
      columns={columns}
      data={query.data?.items}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => query.refetch()}
      getRowId={(s) => s.cashSessionId}
      onRowClick={(s) => router.push(`/cash-sessions/${s.cashSessionId}`)}
      page={page}
      pageSize={pageSize}
      totalCount={query.data?.meta.totalCount ?? 0}
      onPageChange={setPage}
      onPageSizeChange={reset(setPageSize)}
      emptyTitle="No cash sessions in this period"
      toolbar={
        <>
          <DateRangeFilter value={range} onChange={reset(setRange)} />
          <EnumSelect map={labels.cashSessionStatus} value={status} onChange={reset(setStatus)} placeholder="Open and closed" className="w-40" aria-label="Status" />
        </>
      }
      csv={{
        fileName: `cash-sessions-${range.from}-to-${range.to}`,
        columns: [
          { header: 'Session', value: (s) => s.sessionNumber },
          { header: 'Opened', value: (s) => s.openedAt },
          { header: 'Branch', value: (s) => [s.kraBranchId, s.branchName].filter(Boolean).join(' ') },
          { header: 'Float', value: (s) => s.openingFloat },
          { header: 'Expected', value: (s) => s.breakdown.expectedCash },
          { header: 'Counted', value: (s) => s.countedCash },
          { header: 'Variance', value: (s) => s.variance },
          { header: 'Opened by', value: (s) => s.openedByName },
          { header: 'Closed', value: (s) => s.closedAt },
          { header: 'Closed by', value: (s) => s.closedByName },
          { header: 'Status', value: (s) => labels.cashSessionStatus[s.status] },
        ],
      }}
    />
  );
}

export default function Page() {
  return <PermissionRoute permission="CashSessions.View" module="cashUp"><CashUp /></PermissionRoute>;
}
