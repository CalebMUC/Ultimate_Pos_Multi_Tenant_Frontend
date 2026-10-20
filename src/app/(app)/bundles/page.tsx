'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/primitives';
import { ActivationButton } from '@/components/shared/ActivationButton';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, PageHeader, StatusBadge } from '@/components/shared/Display';
import { productBundlesApi } from '@/api/endpoints/bundles';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { formatQty } from '@/lib/format';
import { BundleFormDialog } from '@/features/bundles/BundleFormDialog';
import type { ProductBundleDto } from '@/api/dto/bundles';

type Filter = 'active' | 'inactive' | 'all';

/** "20L water + 1 × Heavy-duty bottle": each part as set up (in the unit it is sold in). */
const partsText = (b: ProductBundleDto) =>
  b.components.map((c) => (c.unitSymbol && c.unitSymbol !== 'pcs' && c.quantity === 1 ? `${c.unitSymbol} ${c.productName}` : `${formatQty(c.quantity)} ${c.unitSymbol ?? ''} × ${c.productName}`)).join(' + ');

function Bundles() {
  const key = useQueryKey();
  const canManage = usePermission('Products.ManageBundles');
  const [filter, setFilter] = useState<Filter>('active');
  const [editing, setEditing] = useState<ProductBundleDto | 'new' | null>(null);
  const isActive = filter === 'all' ? undefined : filter === 'active';
  const query = useQuery({ queryKey: key('product-bundles', { list: true, isActive }), queryFn: ({ signal }) => productBundlesApi.list({ isActive }, signal) });

  const columns: ColumnDef<ProductBundleDto, unknown>[] = [
    {
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => <span><span className="font-medium">{row.original.name}</span>{row.original.description && <span className="block text-xs text-muted-foreground">{row.original.description}</span>}</span>,
    },
    { header: 'Code', accessorKey: 'code', cell: ({ row }) => (row.original.code ? <code className="text-xs">{row.original.code}</code> : '—') },
    { header: 'Retail', accessorKey: 'retailPrice', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.retailPrice} currency={false} className="font-medium" /> },
    { header: 'Wholesale', accessorKey: 'wholesalePrice', meta: { align: 'right' }, cell: ({ row }) => (row.original.wholesalePrice != null ? <MoneyText value={row.original.wholesalePrice} currency={false} /> : <span className="text-muted-foreground">= retail</span>) },
    { header: 'Parts', id: 'parts', accessorFn: partsText, cell: ({ row }) => <span className="text-xs">{partsText(row.original)}</span> },
    {
      header: 'Available',
      accessorKey: 'availableQuantity',
      meta: { align: 'right' },
      // Null without Stock.View: nothing to show, which is not the same as none.
      cell: ({ row }) => (row.original.availableQuantity == null ? '—' : row.original.availableQuantity === 0 ? <span className="font-medium text-destructive">Out</span> : formatQty(row.original.availableQuantity)),
    },
    { header: 'Status', accessorKey: 'isActive', cell: ({ row }) => <StatusBadge kind="active" value={row.original.isActive} /> },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right' },
      cell: ({ row }) =>
        canManage && (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEditing(row.original)}><Pencil />Edit</Button>
            <ActivationButton
              isActive={row.original.isActive}
              name={row.original.name}
              activate={() => productBundlesApi.activate(row.original.productBundleId)}
              deactivate={() => productBundlesApi.deactivate(row.original.productBundleId)}
              invalidate={['product-bundles']}
              deactivateWarning="It disappears from the counter. Past sales keep it. You can activate it again later."
            />
          </div>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Bundles"
        description="Several products sold together at one price, such as a bottle with its water or a pack of 12. Each part leaves its own stock."
        actions={<Can permission="Products.ManageBundles"><Button onClick={() => setEditing('new')}><Plus />New bundle</Button></Can>}
      />
      <DataTable
        columns={columns}
        data={query.data}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        getRowId={(b) => b.productBundleId}
        searchable
        searchPlaceholder="Name or code…"
        emptyTitle={filter === 'inactive' ? 'No inactive bundles' : 'No bundles yet'}
        toolbar={
          <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="w-36" aria-label="Status">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </NativeSelect>
        }
        csv={{
          fileName: 'bundles',
          columns: [
            { header: 'Name', value: (b) => b.name },
            { header: 'Code', value: (b) => b.code },
            { header: 'Retail', value: (b) => b.retailPrice },
            { header: 'Wholesale', value: (b) => b.wholesalePrice },
            { header: 'Parts', value: (b) => partsText(b) },
            { header: 'Available', value: (b) => b.availableQuantity },
            { header: 'Active', value: (b) => b.isActive },
          ],
        }}
      />
      <BundleFormDialog bundle={editing && editing !== 'new' ? editing : null} open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Products.View" module="bundles"><Bundles /></PermissionRoute>;
}
