'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRightLeft, Pencil, Plus, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { Can } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { PageHeader, StatusBadge } from '@/components/shared/Display';
import { businessesApi } from '@/api/endpoints/business';
import { branchesApi } from '@/api/endpoints/branches';
import { normaliseError } from '@/api/errors';
import { usePermission, usePermissions, useQueryKey } from '@/hooks/useSessionInfo';
import type { BranchDto } from '@/api/dto/branches';
import { BranchFormDialog, branchLimitMessage } from './BranchFormDialog';
import { useBranchList } from './branches';

/** Branches, head office pinned first. With openBranchId (from /branches/{id}), that branch's edit form opens. */
export function BranchesScreen({ openBranchId }: { openBranchId?: string }) {
  const qc = useQueryClient();
  const key = useQueryKey();
  const can = usePermissions();
  const canLicense = usePermission('Businesses.View');
  const branches = useBranchList(true);
  const license = useQuery({ queryKey: key('license'), queryFn: businessesApi.currentLicense, enabled: canLicense, retry: false });
  const [editing, setEditing] = useState<BranchDto | 'new' | null>(null);
  const [closing, setClosing] = useState<BranchDto | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [reopening, setReopening] = useState<BranchDto | null>(null);

  useEffect(() => {
    if (!openBranchId || !branches.data || editing) return;
    const b = branches.data.find((x) => x.branchId === openBranchId);
    if (b && can('Branches.Manage')) setEditing(b);
    // Only when the list first arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openBranchId, branches.data]);

  const rows = branches.data ? [...branches.data].sort((a, b) => (a.isHeadOffice === b.isHeadOffice ? a.branchNumber - b.branchNumber : a.isHeadOffice ? -1 : 1)) : undefined;
  // From the licence when it's there: it counts every open branch, not only those this user sees.
  const openCount = license.data?.openBranches ?? branches.data?.filter((b) => b.isActive).length ?? 0;
  const maxBranches = license.data?.maxBranches ?? null;
  const refresh = () => qc.invalidateQueries({ queryKey: ['branches'] });

  const columns: ColumnDef<BranchDto, unknown>[] = [
    { header: 'No.', accessorKey: 'kraBranchId', cell: ({ row }) => <span className="font-semibold tabular">{row.original.kraBranchId}</span> },
    {
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => <span className="flex items-center gap-2 font-medium">{row.original.name}{row.original.isHeadOffice && <Badge variant="secondary">Head office</Badge>}</span>,
    },
    { header: 'Code', accessorKey: 'code', cell: ({ row }) => row.original.code ?? '—' },
    { header: 'County', accessorKey: 'county', cell: ({ row }) => row.original.county ?? '—' },
    { header: 'Phone', accessorKey: 'phoneNumber', cell: ({ row }) => row.original.phoneNumber ?? '—' },
    { header: 'Till', accessorKey: 'mpesaShortCode', cell: ({ row }) => row.original.mpesaShortCode ?? <span className="text-muted-foreground">Business till</span> },
    { header: 'Status', accessorKey: 'isActive', cell: ({ row }) => <StatusBadge kind="active" value={row.original.isActive} /> },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right' },
      cell: ({ row }) => can('Branches.Manage') && (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(row.original)}><Pencil />Edit</Button>
          {row.original.isActive
            ? !row.original.isHeadOffice && <Button variant="ghost" size="sm" onClick={() => { setCloseError(null); setClosing(row.original); }}><PowerOff />Close</Button>
            : <Button variant="ghost" size="sm" onClick={() => setReopening(row.original)}><Power />Reopen</Button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Branches"
        description={
          <>
            Each branch keeps its own stock, numbered as KRA eTIMS does (00 is the head office).
            {maxBranches !== null && <span className="ml-1 font-medium">Branches: {openCount} of {maxBranches} open.</span>}
          </>
        }
        actions={<Can permission="Branches.Manage"><Button onClick={() => setEditing('new')}><Plus />New branch</Button></Can>}
      />
      <DataTable
        columns={columns.map((c) => ({ ...c, enableSorting: false }))}
        data={rows}
        isLoading={branches.isLoading}
        error={branches.error}
        onRetry={() => branches.refetch()}
        getRowId={(b) => b.branchId}
        rowClassName={(b) => (b.isActive ? undefined : 'text-muted-foreground')}
        emptyTitle="No branches"
      />

      <BranchFormDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} branch={editing === 'new' ? null : editing} />

      <ConfirmDialog
        open={!!closing}
        onOpenChange={(o) => { if (!o) { setClosing(null); setCloseError(null); } }}
        title={`Close ${closing?.kraBranchId} · ${closing?.name}?`}
        description="Nobody can work there until it is reopened. Its records are kept, and its number is never given to another branch."
        confirmLabel="Close branch"
        destructive
        onConfirm={async () => {
          try {
            await branchesApi.deactivate(closing!.branchId);
            await refresh();
            toast.success('Branch closed');
          } catch (e) {
            // The head office can't close; nor can a branch still holding stock. The dialog shows the API's reason.
            setCloseError(normaliseError(e).message);
            throw e;
          }
        }}
      >
        {closeError && /stock/i.test(closeError) && (
          <Can permission="StockTransfers.Create">
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href={`/stock-transfers/new?fromBranchId=${closing?.branchId ?? ''}`}><ArrowRightLeft />New transfer from this branch</Link>
            </Button>
          </Can>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!reopening}
        onOpenChange={(o) => !o && setReopening(null)}
        title={`Reopen ${reopening?.kraBranchId} · ${reopening?.name}?`}
        description={maxBranches !== null ? `It counts against the licence again (${openCount} of ${maxBranches} open now).` : 'Its staff can work there again.'}
        confirmLabel="Reopen"
        onConfirm={async () => {
          try {
            await branchesApi.activate(reopening!.branchId);
            await refresh();
            toast.success('Branch reopened');
          } catch (e) {
            const limit = branchLimitMessage(e);
            throw limit ? new Error(limit) : e;
          }
        }}
      />
    </>
  );
}
