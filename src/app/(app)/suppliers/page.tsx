'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/primitives';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { PageHeader, StatusBadge } from '@/components/shared/Display';
import { useSuppliers } from '@/hooks/useLookups';
import { SupplierFormDialog } from '@/features/suppliers/SupplierFormDialog';
import type { SupplierDto } from '@/api/dto/inventory';

const columns: ColumnDef<SupplierDto, unknown>[] = [
  { header: 'Name', accessorKey: 'supplierName', cell: ({ row }) => <span className="font-medium">{row.original.supplierName}</span> },
  { header: 'Contact', accessorKey: 'contactPerson', cell: ({ row }) => row.original.contactPerson ?? '—' },
  { header: 'Phone', accessorKey: 'phoneNumber', cell: ({ row }) => row.original.phoneNumber ?? '—' },
  { header: 'KRA PIN', accessorKey: 'kraPin', cell: ({ row }) => row.original.kraPin ?? '—' },
  { header: 'Terms', accessorKey: 'paymentTermDays', cell: ({ row }) => (row.original.paymentTermDays ? `Net ${row.original.paymentTermDays}` : 'COD') },
  { header: 'Status', accessorKey: 'isActive', cell: ({ row }) => <StatusBadge kind="active" value={row.original.isActive} /> },
];

function Suppliers() {
  const router = useRouter();
  const suppliers = useSuppliers();
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const rows = suppliers.data?.filter((s) => status === 'all' || s.isActive === (status === 'active'));
  return (
    <>
      <PageHeader title="Suppliers" description="Who you buy from, and on what terms." actions={<Can permission="Suppliers.Register"><Button onClick={() => setCreating(true)}><Plus />New supplier</Button></Can>} />
      <DataTable
        columns={columns}
        data={rows}
        isLoading={suppliers.isLoading}
        error={suppliers.error}
        onRetry={() => suppliers.refetch()}
        getRowId={(s) => s.supplierId}
        onRowClick={(s) => router.push(`/suppliers/${s.supplierId}`)}
        searchable
        emptyTitle="No suppliers yet"
        toolbar={
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-32" aria-label="Status">
            <option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option>
          </NativeSelect>
        }
        csv={{
          fileName: 'suppliers',
          columns: [
            { header: 'Name', value: (s) => s.supplierName },
            { header: 'Contact', value: (s) => s.contactPerson },
            { header: 'Phone', value: (s) => s.phoneNumber },
            { header: 'Email', value: (s) => s.email },
            { header: 'KRA PIN', value: (s) => s.kraPin },
            { header: 'Terms (days)', value: (s) => s.paymentTermDays },
            { header: 'Active', value: (s) => s.isActive },
          ],
        }}
      />
      <SupplierFormDialog open={creating} onOpenChange={setCreating} onSaved={(s) => router.push(`/suppliers/${s.supplierId}`)} />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Suppliers.View"><Suppliers /></PermissionRoute>;
}
