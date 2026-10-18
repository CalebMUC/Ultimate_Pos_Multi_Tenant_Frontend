'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, PageHeader, StatCard } from '@/components/shared/Display';
import { suppliersApi } from '@/api/endpoints/inventory';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatMoney } from '@/lib/format';
import { sum } from '@/lib/utils';
import type { SupplierBalanceDto } from '@/api/dto/business';

const columns: ColumnDef<SupplierBalanceDto, unknown>[] = [
  { header: 'Supplier', accessorKey: 'supplierName', cell: ({ row }) => <span className="font-medium">{row.original.supplierName}</span> },
  { header: 'Owed', accessorKey: 'outstandingBalance', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.outstandingBalance} className="font-medium" /> },
];

function Payables() {
  const router = useRouter();
  const key = useQueryKey();
  const query = useQuery({ queryKey: key('suppliers', { balances: true }), queryFn: suppliersApi.balances });
  const owing = query.data?.filter((b) => b.outstandingBalance !== 0);
  return (
    <>
      <PageHeader title="Payables" description="What the business owes each supplier, largest first." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <StatCard label="Total owed" value={owing ? formatMoney(sum(owing, (b) => b.outstandingBalance)) : '—'} icon={<Wallet />} tone="warning" />
        <StatCard label="Suppliers owed" value={owing?.filter((b) => b.outstandingBalance > 0).length ?? '—'} />
      </div>
      <DataTable
        columns={columns}
        data={owing}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        getRowId={(b) => b.supplierId}
        onRowClick={(b) => router.push(`/suppliers/${b.supplierId}`)}
        searchable
        emptyTitle="Nothing owed"
        emptyMessage="Every supplier is paid up."
        csv={{ fileName: 'payables', columns: [{ header: 'Supplier', value: (b) => b.supplierName }, { header: 'Owed', value: (b) => b.outstandingBalance }] }}
      />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Suppliers.ViewLedger"><Payables /></PermissionRoute>;
}
