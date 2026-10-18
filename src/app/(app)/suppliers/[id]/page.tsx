'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Banknote, ClipboardList, Pencil, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { ActivationButton } from '@/components/shared/ActivationButton';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { DetailList, MoneyText, PageHeader, StatCard, StatusBadge } from '@/components/shared/Display';
import { SettlementDialog } from '@/components/shared/SettlementDialog';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { suppliersApi } from '@/api/endpoints/inventory';
import { labels, SupplierLedgerEntryType } from '@/api/enums';
import { useApiMutation } from '@/hooks/useApiMutation';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateTime, formatMoney } from '@/lib/format';
import { SupplierFormDialog } from '@/features/suppliers/SupplierFormDialog';
import type { SupplierLedgerEntryDto } from '@/api/dto/business';

/** Bills raise what we owe; payments and reversals lower it. */
const bill = (e: SupplierLedgerEntryDto) => e.entryType === SupplierLedgerEntryType.Bill;

const ledgerColumns: ColumnDef<SupplierLedgerEntryDto, unknown>[] = [
  { header: 'Date', accessorKey: 'createdAt', cell: ({ row }) => formatDateTime(row.original.createdAt) },
  { header: 'Entry', accessorKey: 'entryType', cell: ({ row }) => labels.supplierLedgerEntryType[row.original.entryType] },
  {
    header: 'Reference',
    accessorKey: 'referenceType',
    cell: ({ row }) =>
      row.original.referenceType.toLowerCase().includes('purchase') ? (
        <Link className="text-primary hover:underline" href={`/purchase-orders/${row.original.referenceId}`}>{row.original.referenceType}</Link>
      ) : row.original.referenceType,
  },
  { header: 'Invoice no.', accessorKey: 'supplierInvoiceNumber', cell: ({ row }) => row.original.supplierInvoiceNumber ?? '' },
  {
    header: 'Payment',
    id: 'payment',
    cell: ({ row }) => [row.original.paymentMethod !== null ? labels.settlementMethod[row.original.paymentMethod] : null, row.original.paymentReference].filter(Boolean).join(' · '),
  },
  { header: 'Billed', id: 'billed', meta: { align: 'right' }, cell: ({ row }) => (bill(row.original) ? <MoneyText value={row.original.amount} currency={false} /> : '') },
  { header: 'Paid', id: 'paid', meta: { align: 'right' }, cell: ({ row }) => (!bill(row.original) ? <MoneyText value={row.original.amount} currency={false} className="text-success" /> : '') },
];

function SupplierDetail({ id }: { id: string }) {
  const key = useQueryKey();
  const canLedger = usePermission('Suppliers.ViewLedger');
  const supplier = useQuery({ queryKey: key('suppliers', { id }), queryFn: () => suppliersApi.get(id) });
  const balance = useQuery({ queryKey: key('suppliers', { id, balance: true }), queryFn: () => suppliersApi.balance(id), enabled: canLedger });
  const ledger = useQuery({ queryKey: key('suppliers', { id, ledger: true }), queryFn: () => suppliersApi.ledger(id), enabled: canLedger });
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const pay = useApiMutation((body: Parameters<typeof suppliersApi.recordPayment>[1]) => suppliersApi.recordPayment(id, body), {
    invalidate: ['suppliers'],
    success: (b) => `Payment recorded. Still owed ${formatMoney(b.outstandingBalance)}`,
    toastErrors: false,
  });

  if (supplier.isLoading) return <LoadingState />;
  if (supplier.error || !supplier.data) return <ErrorState error={supplier.error} onRetry={() => supplier.refetch()} />;
  const s = supplier.data;

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2">{s.supplierName} <StatusBadge kind="active" value={s.isActive} /></span>}
        description={s.paymentTermDays ? `Net ${s.paymentTermDays} days` : 'Cash on delivery'}
        actions={
          <>
            <Button variant="ghost" asChild><Link href="/suppliers"><ArrowLeft />Suppliers</Link></Button>
            <Can permission="PurchaseOrders.Create"><Button variant="outline" asChild><Link href={`/purchase-orders/new?supplierId=${id}`}><ClipboardList />New order</Link></Button></Can>
            <Can permission="Suppliers.RecordPayment"><Button onClick={() => setPaying(true)}><Banknote />Pay supplier</Button></Can>
            <Can permission="Suppliers.Update"><Button variant="outline" onClick={() => setEditing(true)}><Pencil />Edit</Button></Can>
            <Can permission="Suppliers.Deactivate">
              <ActivationButton size="default" isActive={s.isActive} name={s.supplierName} activate={() => suppliersApi.activate(id)} deactivate={() => suppliersApi.deactivate(id)} invalidate={['suppliers']} />
            </Can>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          {canLedger && <StatCard label="We owe" value={balance.data ? formatMoney(balance.data.outstandingBalance) : '—'} icon={<Wallet />} tone={(balance.data?.outstandingBalance ?? 0) > 0 ? 'warning' : 'success'} />}
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent>
              <DetailList
                columns={1}
                items={[
                  { label: 'Contact person', value: s.contactPerson },
                  { label: 'Phone', value: s.phoneNumber },
                  { label: 'Email', value: s.email },
                  { label: 'KRA PIN', value: s.kraPin },
                  { label: 'Address', value: s.physicalAddress },
                ]}
              />
            </CardContent>
          </Card>
        </div>
        {canLedger && (
          <div className="lg:col-span-2">
            <h2 className="mb-2 font-semibold">Statement</h2>
            <DataTable
              columns={ledgerColumns}
              data={ledger.data}
              isLoading={ledger.isLoading}
              error={ledger.error}
              getRowId={(e) => e.supplierLedgerEntryId}
              emptyTitle="No bills or payments yet"
              csv={{
                fileName: `supplier-statement-${s.supplierName}`,
                columns: [
                  { header: 'Date', value: (e) => e.createdAt },
                  { header: 'Entry', value: (e) => labels.supplierLedgerEntryType[e.entryType] },
                  { header: 'Reference', value: (e) => e.referenceType },
                  { header: 'Invoice no.', value: (e) => e.supplierInvoiceNumber },
                  { header: 'Method', value: (e) => (e.paymentMethod !== null ? labels.settlementMethod[e.paymentMethod] : '') },
                  { header: 'Payment ref', value: (e) => e.paymentReference },
                  { header: 'Billed', value: (e) => (bill(e) ? e.amount : '') },
                  { header: 'Paid', value: (e) => (!bill(e) ? e.amount : '') },
                ],
              }}
            />
          </div>
        )}
      </div>
      <SupplierFormDialog open={editing} onOpenChange={setEditing} supplier={s} />
      <SettlementDialog open={paying} onOpenChange={setPaying} title={`Pay ${s.supplierName}`} outstanding={balance.data?.outstandingBalance} onSubmit={(p) => pay.mutateAsync(p)} />
    </>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <PermissionRoute permission="Suppliers.View"><SupplierDetail id={id} /></PermissionRoute>;
}
