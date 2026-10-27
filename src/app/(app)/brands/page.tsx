'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/primitives';
import { ActivationButton } from '@/components/shared/ActivationButton';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { PageHeader, StatusBadge } from '@/components/shared/Display';
import { brandsApi } from '@/api/endpoints/catalog';
import { BrandFormDialog } from '@/features/products/BrandFormDialog';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { usePermissions, useQueryKey } from '@/hooks/useSessionInfo';
import type { BrandDto } from '@/api/dto/catalog';

function Brands() {
  const key = useQueryKey();
  const can = usePermissions();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('all');
  const [editing, setEditing] = useState<BrandDto | 'new' | null>(null);
  const debounced = useDebouncedValue(search.trim(), 300);
  const params = { search: debounced || undefined, isActive: status === 'all' ? undefined : status === 'active' };
  const brands = useQuery({ queryKey: key('brands', params), queryFn: () => brandsApi.list(params) });

  const columns: ColumnDef<BrandDto, unknown>[] = [
    { header: 'Name', accessorKey: 'name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    {
      header: 'Products',
      accessorKey: 'productCount',
      meta: { align: 'right' },
      cell: ({ row }) => (
        <Link href={`/products?brandId=${row.original.brandId}`} className="text-primary hover:underline">{row.original.productCount}</Link>
      ),
    },
    { header: 'Status', accessorKey: 'isActive', cell: ({ row }) => <StatusBadge kind="active" value={row.original.isActive} /> },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right' },
      cell: ({ row }) =>
        can('Products.ManageBrands') && (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEditing(row.original)}><Pencil />Rename</Button>
            <ActivationButton
              isActive={row.original.isActive}
              name={row.original.name}
              activate={() => brandsApi.activate(row.original.brandId)}
              deactivate={() => brandsApi.deactivate(row.original.brandId)}
              invalidate={['brands']}
              deactivateWarning="Products already under this brand keep it. You won’t be able to give it to new products."
            />
          </div>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Brands"
        description="Whose product it is: Soko, Pembe, Jogoo. The category says what it is."
        actions={<Can permission="Products.ManageBrands"><Button onClick={() => setEditing('new')}><Plus />New brand</Button></Can>}
      />
      {/* Not paged: a shop has tens of brands. */}
      <DataTable
        columns={columns}
        data={brands.data}
        isLoading={brands.isLoading}
        error={brands.error}
        onRetry={() => brands.refetch()}
        getRowId={(b) => b.brandId}
        pageSize={100}
        emptyTitle={debounced || status !== 'all' ? 'No matching brands' : 'No brands yet'}
        emptyAction={!debounced && <Can permission="Products.ManageBrands"><Button onClick={() => setEditing('new')}><Plus />Add a brand</Button></Can>}
        toolbar={
          <>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search brands…" aria-label="Search brands" className="w-56" />
            <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-28" aria-label="Status">
              <option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option>
            </NativeSelect>
          </>
        }
      />
      <BrandFormDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} brand={editing === 'new' ? null : editing} />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Products.View"><Brands /></PermissionRoute>;
}
