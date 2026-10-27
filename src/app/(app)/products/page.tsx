'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus, Upload } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/primitives';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { PageHeader, ProductFlags, StatusBadge } from '@/components/shared/Display';
import { BrandSelect, CategorySelect, EnumSelect } from '@/components/shared/Pickers';
import { productsApi } from '@/api/endpoints/catalog';
import { labels, type ItemType } from '@/api/enums';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { ProductFormDialog } from '@/features/products/ProductFormDialog';
import type { ProductDto, ProductSortBy } from '@/api/dto/catalog';
import type { SortingState } from '@tanstack/react-table';

const sortable: Record<string, ProductSortBy> = { name: 'name', sku: 'sku', categoryName: 'category' };

const columns: ColumnDef<ProductDto, unknown>[] = [
  {
    header: 'Name',
    id: 'name',
    accessorKey: 'name',
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        <span className="font-medium">{row.original.name}{row.original.strength ? ` ${row.original.strength}` : ''}</span>
        <ProductFlags requiresPrescription={row.original.requiresPrescription} isBatchTracked={row.original.isBatchTracked} />
      </span>
    ),
  },
  { header: 'SKU', id: 'sku', accessorKey: 'sku', cell: ({ row }) => <code className="text-xs">{row.original.sku}</code> },
  { header: 'Category', id: 'categoryName', accessorKey: 'categoryName', cell: ({ row }) => row.original.categoryName ?? '—' },
  { header: 'Brand', id: 'brandName', enableSorting: false, accessorKey: 'brandName', cell: ({ row }) => row.original.brandName ?? '' },
  { header: 'Type', id: 'itemType', enableSorting: false, accessorKey: 'itemType', cell: ({ row }) => labels.itemType[row.original.itemType] },
  { header: 'Unit', id: 'unit', enableSorting: false, accessorKey: 'baseUnitSymbol' },
  { header: 'Barcode', id: 'barcode', enableSorting: false, accessorKey: 'barcode', cell: ({ row }) => row.original.barcode ?? '—' },
  { header: 'Status', id: 'isActive', enableSorting: false, accessorKey: 'isActive', cell: ({ row }) => <StatusBadge kind="active" value={row.original.isActive} /> },
];

function Products() {
  const router = useRouter();
  const key = useQueryKey();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  // Catalog → Brands links here with ?brandId=.
  const [brandId, setBrandId] = useState(useSearchParams().get('brandId') ?? '');
  const [itemType, setItemType] = useState<ItemType | null>(null);
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [flag, setFlag] = useState<'' | 'rx' | 'batch'>('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const debounced = useDebouncedValue(search.trim(), 300);
  const sort = sorting[0];
  const params = {
    page,
    pageSize,
    search: debounced || undefined,
    categoryId: categoryId || undefined,
    brandId: brandId || undefined,
    itemType: itemType ?? undefined,
    isActive: status === 'all' ? undefined : status === 'active',
    requiresPrescription: flag === 'rx' ? true : undefined,
    isBatchTracked: flag === 'batch' ? true : undefined,
    sortBy: sort ? sortable[sort.id] : undefined,
    sortDirection: sort ? (sort.desc ? 'desc' : 'asc') as 'asc' | 'desc' : undefined,
  };
  const query = useQuery({ queryKey: key('products', params), queryFn: ({ signal }) => productsApi.list(params, signal), placeholderData: keepPreviousData });
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything you make, buy or sell."
        actions={
          <>
            <Can permission="Products.BulkImport"><Button variant="outline" asChild><Link href="/bulk-import"><Upload />Import</Link></Button></Can>
            <Can permission="Products.Create"><Button onClick={() => setCreating(true)}><Plus />New product</Button></Can>
          </>
        }
      />
      <DataTable
        mode="server"
        columns={columns.map((c) => ({ ...c, enableSorting: c.id ? c.id in sortable : false }))}
        data={query.data?.items}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        getRowId={(p) => p.productId}
        onRowClick={(p) => router.push(`/products/${p.productId}`)}
        page={page}
        pageSize={pageSize}
        totalCount={query.data?.meta.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={reset(setPageSize)}
        sorting={sorting}
        onSortingChange={(updater) => { setSorting(updater); setPage(1); }}
        search={search}
        onSearchChange={reset(setSearch)}
        searchPlaceholder="Name, brand, SKU, barcode or generic name…"
        emptyTitle="No products"
        emptyAction={<Can permission="Products.Create"><Button onClick={() => setCreating(true)}><Plus />Add a product</Button></Can>}
        toolbar={
          <>
            <CategorySelect value={categoryId} onChange={(e) => reset(setCategoryId)(e.target.value)} placeholder="All categories" className="w-44" aria-label="Category" />
            <BrandSelect value={brandId} onChange={(e) => reset(setBrandId)(e.target.value)} className="w-40" aria-label="Brand" />
            <EnumSelect map={labels.itemType} value={itemType} onChange={reset(setItemType)} placeholder="All types" className="w-36" aria-label="Item type" />
            <NativeSelect value={flag} onChange={(e) => reset(setFlag)(e.target.value as typeof flag)} className="w-36" aria-label="Medicine">
              <option value="">Any product</option><option value="rx">Prescription only</option><option value="batch">Batch-tracked</option>
            </NativeSelect>
            <NativeSelect value={status} onChange={(e) => reset(setStatus)(e.target.value as typeof status)} className="w-28" aria-label="Status">
              <option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option>
            </NativeSelect>
          </>
        }
        csv={{
          fileName: 'products',
          columns: [
            { header: 'SKU', value: (p) => p.sku },
            { header: 'Name', value: (p) => p.name },
            { header: 'Category', value: (p) => p.categoryName },
            { header: 'Brand', value: (p) => p.brandName },
            { header: 'Type', value: (p) => labels.itemType[p.itemType] },
            { header: 'Unit', value: (p) => p.baseUnitSymbol },
            { header: 'Barcode', value: (p) => p.barcode },
            { header: 'VAT', value: (p) => labels.taxClassification[p.taxClassification] },
            { header: 'Reorder level', value: (p) => p.reorderLevel },
            { header: 'Batch-tracked', value: (p) => p.isBatchTracked },
            { header: 'Rx', value: (p) => p.requiresPrescription },
            { header: 'Active', value: (p) => p.isActive },
          ],
        }}
      />
      <ProductFormDialog open={creating} onOpenChange={setCreating} onSaved={(p) => router.push(`/products/${p.productId}`)} />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Products.View"><Products /></PermissionRoute>;
}
