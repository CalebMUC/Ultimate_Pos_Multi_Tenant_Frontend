'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlertOctagon, AlertTriangle, Building2, Clock, RefreshCw, RotateCcw, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, NativeSelect, Skeleton } from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { PageHeader, StatCard } from '@/components/shared/Display';
import { EnumSelect } from '@/components/shared/Pickers';
import { ErrorState } from '@/components/shared/States';
import { platformEtimsApi } from '@/api/endpoints/platformEtims';
import { EtimsDocumentType, EtimsSubmissionStatus, labels } from '@/api/enums';
import { useApiMutation } from '@/hooks/useApiMutation';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateTime } from '@/lib/format';
import type { PlatformEtimsBusinessRowDto, PlatformEtimsSubmissionDto } from '@/api/dto/etims';
import { parseStatus } from '@/features/etims/etims';
import { problemTone, sortByProblem } from '@/features/etims/platform';
import { PlatformSubmissionScope } from '@/features/etims/scope';
import { canRetry, SubmissionDrawer, SubmissionStatusBadge } from '@/features/etims/SubmissionDrawer';
import { relativeTime } from '@/features/notifications/format';

const TABS = ['businesses', 'submissions'] as const;
const when = (at: string | null) => (at ? <span title={formatDateTime(at)} className="whitespace-nowrap">{relativeTime(at)}</span> : '—');

function PlatformEtims() {
  const key = useQueryKey();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get('tab');
  const tab = TABS.includes(requested as (typeof TABS)[number]) ? requested! : 'businesses';
  const overview = useQuery({ queryKey: key('platform', { etims: 'overview' }), queryFn: platformEtimsApi.overview });
  const o = overview.data;

  /** The submissions tab, filtered. */
  const toSubmissions = (businessId: string, status?: EtimsSubmissionStatus) => {
    const q = new URLSearchParams({ tab: 'submissions', businessId });
    if (status !== undefined) q.set('status', String(status));
    return `${pathname}?${q}`;
  };

  const columns: ColumnDef<PlatformEtimsBusinessRowDto, unknown>[] = [
    {
      header: 'Business',
      accessorKey: 'businessName',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <span>
            <span className="font-medium">{r.businessName}</span>
            <span className="block font-mono text-xs text-muted-foreground">{r.kraPin}</span>
            {r.etimsEnabled && r.activeDeviceCount === 0 && (
              <span className="mt-0.5 flex items-center gap-1 text-xs text-warning"><AlertTriangle className="size-3" />Not reporting: no device registered.</span>
            )}
          </span>
        );
      },
    },
    {
      header: 'eTIMS',
      accessorKey: 'etimsEnabled',
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">
          <Badge variant={row.original.etimsEnabled ? 'success' : 'secondary'}>{row.original.etimsEnabled ? 'On' : 'Off'}</Badge>
          {row.original.businessSuspended && <Badge variant="destructive">Suspended</Badge>}
          {!row.original.businessActive && <Badge variant="secondary">Closed</Badge>}
        </span>
      ),
    },
    { header: 'Devices', id: 'devices', meta: { align: 'right' }, accessorFn: (r) => r.activeDeviceCount, cell: ({ row }) => `${row.original.activeDeviceCount} / ${row.original.deviceCount}` },
    { header: 'Pending', accessorKey: 'pending', meta: { align: 'right' } },
    {
      header: 'Failed',
      accessorKey: 'failed',
      meta: { align: 'right' },
      cell: ({ row }) => (row.original.failed
        ? <Link href={toSubmissions(row.original.businessId, EtimsSubmissionStatus.Failed)} onClick={(e) => e.stopPropagation()} className="font-medium text-warning hover:underline">{row.original.failed}</Link>
        : 0),
    },
    {
      header: 'Rejected',
      accessorKey: 'rejected',
      meta: { align: 'right' },
      cell: ({ row }) => (row.original.rejected
        ? <Link href={toSubmissions(row.original.businessId, EtimsSubmissionStatus.Rejected)} onClick={(e) => e.stopPropagation()} className="font-medium text-destructive hover:underline">{row.original.rejected}</Link>
        : 0),
    },
    { header: 'Last accepted by KRA', accessorKey: 'lastSentAt', cell: ({ row }) => when(row.original.lastSentAt) },
    {
      header: 'Oldest problem',
      accessorKey: 'oldestProblemAt',
      cell: ({ row }) => <span className={problemTone(row.original.oldestProblemAt)}>{when(row.original.oldestProblemAt)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="KRA eTIMS"
        description="Every business reports to KRA through the platform. Onboard a business's branches here, and look after what KRA refused."
        actions={<Button variant="outline" onClick={() => overview.refetch()} loading={overview.isFetching}><RefreshCw />Refresh</Button>}
      />
      {overview.error ? (
        <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
      ) : !o ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[88px]" />)}</div>
      ) : (
        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Businesses" value={o.businessCount} icon={<Building2 />} />
          <StatCard label="Devices" value={`${o.activeDeviceCount} / ${o.deviceCount}`} hint="Active / all" icon={<Smartphone />} />
          <StatCard label="Pending" value={o.pending} icon={<Clock />} />
          <StatCard label="Failed" value={o.failed} hint="Retried by themselves" icon={<AlertTriangle />} tone={o.failed ? 'warning' : 'default'} />
          <StatCard label="Rejected" value={o.rejected} hint="Need a person" icon={<AlertOctagon />} tone={o.rejected ? 'destructive' : 'default'} />
        </section>
      )}
      <Tabs value={tab} onValueChange={(t) => router.replace(`${pathname}?tab=${t}`, { scroll: false })}>
        <TabsList>
          <TabsTrigger value="businesses">Businesses</TabsTrigger>
          <TabsTrigger value="submissions">Needs attention{o && o.failed + o.rejected > 0 ? ` (${o.failed + o.rejected})` : ''}</TabsTrigger>
        </TabsList>
        <TabsContent value="businesses">
          <DataTable
            columns={columns}
            data={o ? sortByProblem(o.businesses) : undefined}
            isLoading={overview.isLoading}
            getRowId={(r) => r.businessId}
            onRowClick={(r) => router.push(`/platform/etims/${r.businessId}`)}
            searchable
            searchPlaceholder="Business name…"
            emptyTitle="No business reports to KRA yet"
            emptyMessage="Turn eTIMS on from a business's page, then register its branches' devices here."
          />
        </TabsContent>
        <TabsContent value="submissions">
          {/* Keyed by the URL's filters, so the count links on the Businesses tab start it afresh. */}
          <NeedsAttention key={params.toString()} businesses={o?.businesses ?? []} />
        </TabsContent>
      </Tabs>
    </>
  );
}

/** What KRA refused across every business. No status asked for: Failed and Rejected. */
function NeedsAttention({ businesses }: { businesses: readonly PlatformEtimsBusinessRowDto[] }) {
  const key = useQueryKey();
  const params = useSearchParams();
  const canManage = usePermission('Platform.Etims.Manage');
  const [businessId, setBusinessId] = useState(() => params.get('businessId') ?? '');
  const [deviceId, setDeviceId] = useState(() => params.get('deviceId') ?? '');
  const [status, setStatus] = useState<EtimsSubmissionStatus | null>(() => parseStatus(params.get('status')));
  const [documentType, setDocumentType] = useState<EtimsDocumentType | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [open, setOpen] = useState<string | null>(null);
  const query = {
    page, pageSize, businessId: businessId || undefined, deviceId: deviceId || undefined, status: status ?? undefined, documentType: documentType ?? undefined,
  };
  const list = useQuery({ queryKey: key('platform', { etimsSubmissions: query }), queryFn: () => platformEtimsApi.submissions(query), placeholderData: keepPreviousData });
  const retry = useApiMutation((id: string) => platformEtimsApi.retry(id), { invalidate: ['platform'], success: 'Queued again: it goes on the next pass' });
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };
  const device = deviceId ? list.data?.items.find((r) => r.submission.etimsDeviceId === deviceId) : undefined;

  const columns: ColumnDef<PlatformEtimsSubmissionDto, unknown>[] = [
    { header: 'Business', accessorKey: 'businessName', cell: ({ row }) => <span className="font-medium">{row.original.businessName}</span> },
    {
      header: 'Branch',
      accessorKey: 'branchName',
      cell: ({ row }) => <span className="whitespace-nowrap">{row.original.branchName} <span className="font-mono text-xs text-muted-foreground">{row.original.bhfId}</span></span>,
    },
    { header: 'Created', id: 'createdAt', accessorFn: (r) => r.submission.createdAt, cell: ({ row }) => <span className="whitespace-nowrap">{formatDateTime(row.original.submission.createdAt)}</span> },
    {
      header: 'Document',
      id: 'documentType',
      accessorFn: (r) => r.submission.documentType,
      cell: ({ row }) => (
        <span>
          {labels.etimsDocumentType[row.original.submission.documentType]}
          <span className="block text-xs text-muted-foreground">{row.original.submission.sourceType}</span>
        </span>
      ),
    },
    { header: 'Status', id: 'status', accessorFn: (r) => r.submission.status, cell: ({ row }) => <SubmissionStatusBadge status={row.original.submission.status} /> },
    {
      header: 'KRA said',
      id: 'resultMessage',
      accessorFn: (r) => r.submission.resultMessage,
      meta: { className: 'max-w-xs' },
      cell: ({ row }) => (
        <span className="block truncate" title={row.original.submission.resultMessage ?? undefined}>
          {row.original.submission.resultCode && <span className="mr-1 font-mono text-xs text-muted-foreground">{row.original.submission.resultCode}</span>}
          {row.original.submission.resultMessage}
        </span>
      ),
    },
    { header: 'Attempts', id: 'attempts', accessorFn: (r) => r.submission.attempts, meta: { align: 'right' } },
    { header: 'Last attempt', id: 'lastAttemptAt', accessorFn: (r) => r.submission.lastAttemptAt, cell: ({ row }) => when(row.original.submission.lastAttemptAt) },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right' },
      cell: ({ row }) => canManage && canRetry(row.original.submission) && (
        <Button
          variant="ghost"
          size="sm"
          loading={retry.isPending && retry.variables === row.original.submission.etimsSubmissionId}
          onClick={(e) => { e.stopPropagation(); retry.mutate(row.original.submission.etimsSubmissionId); }}
        >
          <RotateCcw />Retry
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        mode="server"
        columns={columns}
        data={list.data?.items}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => list.refetch()}
        getRowId={(r) => r.submission.etimsSubmissionId}
        onRowClick={(r) => setOpen(r.submission.etimsSubmissionId)}
        page={page}
        pageSize={pageSize}
        totalCount={list.data?.meta.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={reset(setPageSize)}
        emptyTitle={status === null ? 'Nothing needs attention' : 'No submissions'}
        emptyMessage={status === null ? 'KRA has not refused anything that is still waiting on a person.' : undefined}
        toolbar={
          <>
            <NativeSelect value={businessId} onChange={(e) => { reset(setBusinessId)(e.target.value); setDeviceId(''); }} className="w-56" aria-label="Business">
              <option value="">All businesses</option>
              {businesses.map((b) => <option key={b.businessId} value={b.businessId}>{b.businessName}</option>)}
            </NativeSelect>
            {/* The API has no "every status" across businesses: without one it lists Failed and Rejected. */}
            <EnumSelect map={labels.etimsSubmissionStatus} value={status} onChange={reset(setStatus)} placeholder="Needs attention" className="w-40" aria-label="Status" />
            <EnumSelect map={labels.etimsDocumentType} value={documentType} onChange={reset(setDocumentType)} placeholder="Any document" className="w-40" aria-label="Document type" />
            {deviceId && (
              <Button variant="outline" size="sm" onClick={() => reset(setDeviceId)('')}>
                {device ? `${device.branchName} ${device.bhfId}` : 'One device'}<X />
              </Button>
            )}
          </>
        }
      />
      <PlatformSubmissionScope>
        <SubmissionDrawer submissionId={open} onOpenChange={(o) => !o && setOpen(null)} retrying={retry.isPending} onRetry={(s) => retry.mutate(s.etimsSubmissionId)} />
      </PlatformSubmissionScope>
    </>
  );
}

export default function Page() {
  return (
    <PermissionRoute permission="Platform.Etims.View">
      <Suspense><PlatformEtims /></Suspense>
    </PermissionRoute>
  );
}
