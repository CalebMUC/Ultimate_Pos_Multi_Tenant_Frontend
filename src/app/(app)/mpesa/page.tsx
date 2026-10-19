'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, PageHeader } from '@/components/shared/Display';
import { mpesaApi } from '@/api/endpoints/sales';
import { labels } from '@/api/enums';
import { useActiveBusiness, useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateTime } from '@/lib/format';
import type { MpesaTransactionDto } from '@/api/dto/sales';
import { useBranchFilter } from '@/features/branches/branches';

const columns: ColumnDef<MpesaTransactionDto, unknown>[] = [
  { header: 'Receipt', accessorKey: 'mpesaReceiptNumber', cell: ({ row }) => <span className="font-medium">{row.original.mpesaReceiptNumber ?? '—'}</span> },
  { header: 'Date', accessorKey: 'transactionDate', cell: ({ row }) => formatDateTime(row.original.transactionDate) },
  { header: 'Phone', accessorKey: 'phoneNumber' },
  // A branch's own till belongs to it; the business short code has no branch, and any branch may match it.
  { header: 'Branch', id: 'branch', accessorFn: (t) => t.kraBranchId ?? '', cell: ({ row }) => (row.original.kraBranchId ? `${row.original.kraBranchId} · ${row.original.branchName ?? ''}` : <span className="text-muted-foreground">Any branch</span>) },
  { header: 'Type', accessorKey: 'transactionType', cell: ({ row }) => labels.mpesaTransactionType[row.original.transactionType] },
  { header: 'Status', accessorKey: 'status', cell: ({ row }) => labels.mpesaTransactionStatus[row.original.status] },
  { header: 'Amount', accessorKey: 'amount', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.amount} className="font-medium" /> },
];

function Mpesa() {
  const key = useQueryKey();
  const branch = useBranchFilter();
  const { business } = useActiveBusiness();
  const query = useQuery({ queryKey: key('mpesa-unmatched', { branchId: branch.branchId }), queryFn: () => mpesaApi.unmatched(branch.scope), refetchInterval: 15_000 });
  return (
    <>
      <PageHeader
        title="M-Pesa payments"
        description="Payments to the till not yet matched to a sale. Match them at the POS with “M-Pesa Till”."
        actions={<Button variant="outline" onClick={() => query.refetch()} loading={query.isFetching}><RefreshCw />Refresh</Button>}
      />
      {!business?.mpesaShortCode && (
        <Alert variant="warning" className="mb-4">
          <AlertDescription>This business has no M-Pesa short code set, so till payments can’t be routed to it. Set it in Business Profile.</AlertDescription>
        </Alert>
      )}
      <DataTable
        branchFilter={branch}
        columns={columns}
        data={query.data}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        searchable
        searchPlaceholder="Receipt or phone…"
        emptyTitle="No unmatched payments"
        emptyMessage="Every till payment has been matched to a sale."
        getRowId={(t) => t.mpesaTransactionId}
      />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Mpesa.View"><Mpesa /></PermissionRoute>;
}
