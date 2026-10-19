'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Inbox, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, PageHeader } from '@/components/shared/Display';
import { EnumSelect } from '@/components/shared/Pickers';
import { stockTransfersApi } from '@/api/endpoints/branches';
import { labels, StockTransferStatus } from '@/api/enums';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateTime } from '@/lib/format';
import { useSession } from '@/stores/session';
import { BranchFilterSelect } from '@/features/branches/BranchFilterSelect';
import { useBranchFilter } from '@/features/branches/branches';
import { TransferRoute, TransferStatusBadge } from '@/features/transfers/TransferParts';
import { useTransferInbox } from '@/features/transfers/useTransferInbox';
import type { StockTransferDto } from '@/api/dto/branches';

function Transfers() {
  const router = useRouter();
  const key = useQueryKey();
  const canCost = usePermission('Costing.View');
  const activeBranchId = useSession((s) => s.activeBranchId);
  const branch = useBranchFilter();
  const inbox = useTransferInbox();
  const [status, setStatus] = useState<StockTransferStatus | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const params = { page, pageSize, status: status ?? undefined, branchId: branch.branchId ?? undefined };
  const query = useQuery({ queryKey: key('stock-transfers', params), queryFn: () => stockTransfersApi.list(params), placeholderData: keepPreviousData });

  const columns: ColumnDef<StockTransferDto, unknown>[] = [
    {
      header: 'Transfer',
      accessorKey: 'transferNumber',
      cell: ({ row }) => (
        <span className="flex items-center gap-2 font-medium">
          {row.original.transferNumber}
          {row.original.status === StockTransferStatus.Dispatched && row.original.toBranchId === activeBranchId && <Inbox className="size-3.5 text-primary" aria-label="On its way here" />}
        </span>
      ),
    },
    { header: 'Route', id: 'route', cell: ({ row }) => <TransferRoute t={row.original} className="text-sm" /> },
    { header: 'Status', accessorKey: 'status', cell: ({ row }) => <TransferStatusBadge status={row.original.status} /> },
    { header: 'Lines', id: 'lines', meta: { align: 'right' }, cell: ({ row }) => row.original.lines.length },
    { header: 'Created', accessorKey: 'createdAt', cell: ({ row }) => formatDateTime(row.original.createdAt) },
    ...(canCost ? [{
      header: 'Value',
      id: 'value',
      meta: { align: 'right' as const },
      cell: ({ row }: { row: { original: StockTransferDto } }) => <MoneyText value={row.original.dispatchedValue} currency={false} />,
    }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Stock transfers"
        description="Moving stock between branches: request, dispatch, receive. Stock in transit counts at neither branch."
        actions={<Can permission="StockTransfers.Create"><Button asChild><Link href="/stock-transfers/new"><Plus />New transfer</Link></Button></Can>}
      />
      <DataTable
        mode="server"
        columns={columns}
        data={query.data?.items}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        getRowId={(t) => t.stockTransferId}
        onRowClick={(t) => router.push(`/stock-transfers/${t.stockTransferId}`)}
        page={page}
        pageSize={pageSize}
        totalCount={query.data?.meta.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        emptyTitle="No transfers"
        toolbar={
          <>
            <BranchFilterSelect filter={{ ...branch, setBranchId: (id) => { branch.setBranchId(id); setPage(1); } }} />
            <EnumSelect map={labels.stockTransferStatus} value={status} onChange={(v) => { setStatus(v); setPage(1); }} placeholder="Any status" className="w-36" aria-label="Status" />
            {inbox.count > 0 && (
              <Button variant="outline" size="sm" onClick={() => { setStatus(StockTransferStatus.Dispatched); branch.setBranchId(activeBranchId); setPage(1); }}>
                <Inbox />{inbox.count} to receive here
              </Button>
            )}
          </>
        }
      />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="StockTransfers.View"><Transfers /></PermissionRoute>;
}
