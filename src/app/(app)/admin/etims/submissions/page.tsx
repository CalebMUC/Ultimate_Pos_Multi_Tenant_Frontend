'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, NativeSelect } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/Display';
import { EnumSelect } from '@/components/shared/Pickers';
import { etimsApi } from '@/api/endpoints/etims';
import { EtimsDocumentType, EtimsSubmissionStatus, labels } from '@/api/enums';
import { useApiMutation } from '@/hooks/useApiMutation';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateTime } from '@/lib/format';
import type { EtimsSubmissionDto } from '@/api/dto/etims';
import { parseStatus, sourceHref, useEtimsDevices } from '@/features/etims/etims';
import { canRetry, SubmissionDrawer, SubmissionStatusBadge } from '@/features/etims/SubmissionDrawer';

function Submissions() {
  const key = useQueryKey();
  const params = useSearchParams();
  const canManage = usePermission('Etims.Manage');
  const devices = useEtimsDevices();
  const [deviceId, setDeviceId] = useState(() => params.get('deviceId') ?? '');
  const [status, setStatus] = useState<EtimsSubmissionStatus | null>(() => parseStatus(params.get('status')));
  const [documentType, setDocumentType] = useState<EtimsDocumentType | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [open, setOpen] = useState<string | null>(null);
  const query = { page, pageSize, deviceId: deviceId || undefined, status: status ?? undefined, documentType: documentType ?? undefined };
  const list = useQuery({ queryKey: key('etims', { submissions: query }), queryFn: () => etimsApi.submissions(query), placeholderData: keepPreviousData });
  const retry = useApiMutation((s: EtimsSubmissionDto) => etimsApi.retry(s.etimsSubmissionId), { invalidate: ['etims'], success: 'Queued again: it goes on the next pass' });
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };
  const branchOf = (id: string) => devices.data?.find((d) => d.etimsDeviceId === id);

  const columns: ColumnDef<EtimsSubmissionDto, unknown>[] = [
    { header: 'Created', accessorKey: 'createdAt', cell: ({ row }) => <span className="whitespace-nowrap">{formatDateTime(row.original.createdAt)}</span> },
    {
      header: 'Document',
      accessorKey: 'documentType',
      cell: ({ row }) => (
        <span>
          {labels.etimsDocumentType[row.original.documentType]}
          {(devices.data?.length ?? 0) > 1 && <span className="block text-xs text-muted-foreground">{branchOf(row.original.etimsDeviceId)?.branchName}</span>}
        </span>
      ),
    },
    {
      header: 'Source',
      accessorKey: 'sourceType',
      cell: ({ row }) => {
        const href = sourceHref(row.original.sourceType, row.original.sourceId);
        return href
          ? <Link href={href} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">{row.original.sourceType}</Link>
          : row.original.sourceType;
      },
    },
    { header: 'KRA no.', accessorKey: 'documentNumber', meta: { align: 'right' }, cell: ({ row }) => row.original.documentNumber ?? '—' },
    { header: 'Status', accessorKey: 'status', cell: ({ row }) => <SubmissionStatusBadge status={row.original.status} /> },
    { header: 'Attempts', accessorKey: 'attempts', meta: { align: 'right' } },
    {
      header: 'Next attempt',
      accessorKey: 'nextAttemptAt',
      cell: ({ row }) => (row.original.status === EtimsSubmissionStatus.Failed ? <span className="whitespace-nowrap">{formatDateTime(row.original.nextAttemptAt)}</span> : ''),
    },
    {
      header: 'KRA said',
      accessorKey: 'resultMessage',
      meta: { className: 'max-w-xs' },
      cell: ({ row }) => (
        <span className="block truncate" title={row.original.resultMessage ?? undefined}>
          {row.original.resultCode && <span className="mr-1 font-mono text-xs text-muted-foreground">{row.original.resultCode}</span>}
          {row.original.resultMessage}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right' },
      cell: ({ row }) => canManage && canRetry(row.original) && (
        <Button
          variant="ghost"
          size="sm"
          loading={retry.isPending && retry.variables?.etimsSubmissionId === row.original.etimsSubmissionId}
          onClick={(e) => { e.stopPropagation(); retry.mutate(row.original); }}
        >
          <RotateCcw />Retry
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="eTIMS submissions"
        description="Everything sent to KRA, newest first, and what KRA said. Sending and retrying happen by themselves; Retry is for what KRA gave up on."
        actions={<Button variant="outline" onClick={() => list.refetch()} loading={list.isFetching}><RefreshCw />Refresh</Button>}
      />
      <Alert variant="info" className="mb-4">
        <AlertDescription>
          <ul className="list-disc space-y-1 pl-4">
            <li><strong>Pending, “Waiting for N item(s) to be registered”:</strong> the products it names have not been accepted by KRA yet. Look at the Item rows.</li>
            <li><strong>Rejected Item:</strong> usually a wrong or missing item classification. Fix it on the product or category, then Retry the item. What was waiting on it follows by itself.</li>
            <li><strong>Sales waiting for “the original sale”:</strong> credit notes go after the sale they reverse.</li>
          </ul>
        </AlertDescription>
      </Alert>
      <DataTable
        mode="server"
        columns={columns}
        data={list.data?.items}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => list.refetch()}
        getRowId={(s) => s.etimsSubmissionId}
        onRowClick={(s) => setOpen(s.etimsSubmissionId)}
        page={page}
        pageSize={pageSize}
        totalCount={list.data?.meta.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={reset(setPageSize)}
        emptyTitle="Nothing sent yet"
        emptyMessage="Submissions appear here once a branch with a registered device sells or moves stock."
        toolbar={
          <>
            <NativeSelect value={deviceId} onChange={(e) => reset(setDeviceId)(e.target.value)} className="w-48" aria-label="Branch">
              <option value="">All branches</option>
              {devices.data?.map((d) => <option key={d.etimsDeviceId} value={d.etimsDeviceId}>{d.bhfId} · {d.branchName}</option>)}
            </NativeSelect>
            <EnumSelect map={labels.etimsSubmissionStatus} value={status} onChange={reset(setStatus)} placeholder="Any status" className="w-36" aria-label="Status" />
            <EnumSelect map={labels.etimsDocumentType} value={documentType} onChange={reset(setDocumentType)} placeholder="Any document" className="w-40" aria-label="Document type" />
          </>
        }
      />
      <SubmissionDrawer
        submissionId={open}
        onOpenChange={(o) => !o && setOpen(null)}
        retrying={retry.isPending}
        onRetry={(s) => retry.mutate(s)}
      />
    </>
  );
}

export default function Page() {
  return (
    <PermissionRoute permission="Etims.View" module="etims">
      <Suspense><Submissions /></Suspense>
    </PermissionRoute>
  );
}
