'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/primitives';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, PageHeader, StatusBadge } from '@/components/shared/Display';
import { customersApi } from '@/api/endpoints/business';
import { labels } from '@/api/enums';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { CustomerFormDialog } from '@/features/customers/CustomerFormDialog';
import type { CustomerDto } from '@/api/dto/business';
import { DiscountBadge } from '@/features/customers/insights';

const columns: ColumnDef<CustomerDto, unknown>[] = [
  {
    header: 'Name',
    accessorKey: 'customerName',
    cell: ({ row }) => <span className="flex items-center gap-1.5 font-medium">{row.original.customerName}<DiscountBadge percent={row.original.discountPercent} /></span>,
  },
  { header: 'Phone', accessorKey: 'phoneNumber', cell: ({ row }) => row.original.phoneNumber ?? '—' },
  { header: 'KRA PIN', accessorKey: 'kraPin', cell: ({ row }) => row.original.kraPin ?? '—' },
  { header: 'Price list', accessorKey: 'priceType', cell: ({ row }) => labels.priceType[row.original.priceType] },
  { header: 'Credit limit', accessorKey: 'creditLimit', meta: { align: 'right' }, cell: ({ row }) => (row.original.creditLimit === null ? <span className="text-muted-foreground">No limit</span> : <MoneyText value={row.original.creditLimit} />) },
  { header: 'Status', accessorKey: 'isActive', cell: ({ row }) => <StatusBadge kind="active" value={row.original.isActive} /> },
];

function Customers() {
  const router = useRouter();
  const key = useQueryKey();
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const query = useQuery({ queryKey: key('customers'), queryFn: () => customersApi.list() });
  const rows = query.data?.filter((c) => status === 'all' || c.isActive === (status === 'active'));
  return (
    <>
      <PageHeader
        title="Customers"
        description="Registered customers, their price list and credit terms."
        actions={<Can permission="Customers.Register"><Button onClick={() => setCreating(true)}><Plus />New customer</Button></Can>}
      />
      <DataTable
        columns={columns}
        data={rows}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        getRowId={(c) => c.customerId}
        onRowClick={(c) => router.push(`/customers/${c.customerId}`)}
        searchable
        searchPlaceholder="Name, phone or KRA PIN…"
        emptyTitle="No customers yet"
        emptyAction={<Can permission="Customers.Register"><Button onClick={() => setCreating(true)}><Plus />Add the first customer</Button></Can>}
        toolbar={
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-32" aria-label="Status">
            <option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option>
          </NativeSelect>
        }
        csv={{
          fileName: 'customers',
          columns: [
            { header: 'Name', value: (c) => c.customerName },
            { header: 'Phone', value: (c) => c.phoneNumber },
            { header: 'Email', value: (c) => c.email },
            { header: 'KRA PIN', value: (c) => c.kraPin },
            { header: 'Contact', value: (c) => c.contactPerson },
            { header: 'Price list', value: (c) => labels.priceType[c.priceType] },
            { header: 'Credit limit', value: (c) => c.creditLimit },
            { header: 'Discount %', value: (c) => c.discountPercent },
            { header: 'Active', value: (c) => c.isActive },
          ],
        }}
      />
      <CustomerFormDialog open={creating} onOpenChange={setCreating} onSaved={(c) => router.push(`/customers/${c.customerId}`)} />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Customers.View"><Customers /></PermissionRoute>;
}
