'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, PageHeader } from '@/components/shared/Display';
import { ProductPicker } from '@/components/shared/Pickers';
import { productionApi } from '@/api/endpoints/other';
import { ItemType } from '@/api/enums';
import { unitSymbol, useUnits } from '@/hooks/useLookups';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateTime, formatPercent, formatQty } from '@/lib/format';
import type { ProductionRunDto } from '@/api/dto/production';
import { useBranchFilter } from '@/features/branches/branches';

function Runs() {
  const router = useRouter();
  const key = useQueryKey();
  const branch = useBranchFilter();
  const units = useUnits();
  const [productId, setProductId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  // Another branch is another list: start from its first page.
  useEffect(() => setPage(1), [branch.branchId]);
  const [pageSize, setPageSize] = useState(25);
  const params = { page, pageSize, productId: productId ?? undefined };
  const query = useQuery({ queryKey: key('production-runs', { ...params, branchId: branch.branchId }), queryFn: () => productionApi.list({ ...params, ...branch.scope }), placeholderData: keepPreviousData });
  const columns: ColumnDef<ProductionRunDto, unknown>[] = [
    { header: 'Run', accessorKey: 'runNumber', cell: ({ row }) => <span className="font-medium">{row.original.runNumber}</span> },
    { header: 'Date', accessorKey: 'createdAt', cell: ({ row }) => formatDateTime(row.original.createdAt) },
    { header: 'Product', accessorKey: 'productName' },
    { header: 'Produced', accessorKey: 'quantityProduced', meta: { align: 'right' }, cell: ({ row }) => formatQty(row.original.quantityProduced, unitSymbol(units.data, row.original.unitOfMeasureId)) },
    {
      header: 'Yield',
      accessorKey: 'yieldPercentage',
      meta: { align: 'right' },
      cell: ({ row }) => <span className={row.original.yieldPercentage < 95 ? 'text-warning' : ''}>{formatPercent(row.original.yieldPercentage)}</span>,
    },
    { header: 'Cost / unit', accessorKey: 'costPerUnit', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.costPerUnit} currency={false} /> },
    { header: 'Total cost', accessorKey: 'totalCost', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.totalCost} className="font-medium" /> },
  ];
  return (
    <>
      <PageHeader
        title="Production runs"
        description="Each run consumes ingredients and adds finished goods to stock at their actual cost."
        actions={<Can permission="Production.Run"><Button asChild><Link href="/production/runs/new"><Plus />New run</Link></Button></Can>}
      />
      <DataTable
        branchFilter={branch}
        mode="server"
        columns={columns}
        data={query.data?.items}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        getRowId={(r) => r.productionRunId}
        onRowClick={(r) => router.push(`/production/runs/${r.productionRunId}`)}
        page={page}
        pageSize={pageSize}
        totalCount={query.data?.meta.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        emptyTitle="No production runs yet"
        toolbar={<div className="w-64"><ProductPicker value={productId} filter={{ itemType: ItemType.FinishedGood }} onChange={(id) => { setProductId(id); setPage(1); }} placeholder="All products" clearable /></div>}
        csv={{
          fileName: 'production-runs',
          columns: [
            { header: 'Run', value: (r) => r.runNumber },
            { header: 'Date', value: (r) => r.createdAt },
            { header: 'Product', value: (r) => r.productName },
            { header: 'Planned', value: (r) => r.quantityPlanned },
            { header: 'Produced', value: (r) => r.quantityProduced },
            { header: 'Yield %', value: (r) => r.yieldPercentage },
            { header: 'Material cost', value: (r) => r.materialCost },
            { header: 'Additional cost', value: (r) => r.additionalCost },
            { header: 'Total cost', value: (r) => r.totalCost },
            { header: 'Cost per unit', value: (r) => r.costPerUnit },
          ],
        }}
      />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Production.View" requires="production"><Runs /></PermissionRoute>;
}
