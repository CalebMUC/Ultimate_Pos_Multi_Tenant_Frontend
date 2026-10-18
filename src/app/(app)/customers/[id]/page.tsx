'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Banknote, Pencil, Scale, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { ActivationButton } from '@/components/shared/ActivationButton';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { DetailList, MoneyText, PageHeader, StatCard, StatusBadge } from '@/components/shared/Display';
import { SettlementDialog } from '@/components/shared/SettlementDialog';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { customersApi } from '@/api/endpoints/business';
import { CustomerLedgerEntryType, labels } from '@/api/enums';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { useApiMutation } from '@/hooks/useApiMutation';
import { formatDateTime, formatMoney } from '@/lib/format';
import { CustomerFormDialog } from '@/features/customers/CustomerFormDialog';
import type { CustomerLedgerEntryDto } from '@/api/dto/business';

/** Invoices raise the balance; payments, reversals and credit notes lower it. */
const debit = (e: CustomerLedgerEntryDto) => e.entryType === CustomerLedgerEntryType.Invoice;

function referenceLink(e: CustomerLedgerEntryDto) {
  return e.referenceType.toLowerCase().includes('sale') ? <Link className="text-primary hover:underline" href={`/sales/${e.referenceId}`}>{e.referenceType}</Link> : e.referenceType;
}

const ledgerColumns: ColumnDef<CustomerLedgerEntryDto, unknown>[] = [
  { header: 'Date', accessorKey: 'createdAt', cell: ({ row }) => formatDateTime(row.original.createdAt) },
  { header: 'Entry', accessorKey: 'entryType', cell: ({ row }) => labels.customerLedgerEntryType[row.original.entryType] },
  { header: 'Reference', accessorKey: 'referenceType', cell: ({ row }) => referenceLink(row.original) },
  {
    header: 'Payment',
    id: 'payment',
    cell: ({ row }) => [row.original.paymentMethod !== null ? labels.settlementMethod[row.original.paymentMethod] : null, row.original.paymentReference].filter(Boolean).join(' · ') || '—',
  },
  { header: 'Notes', accessorKey: 'notes', meta: { className: 'max-w-xs truncate' }, cell: ({ row }) => row.original.notes ?? '' },
  { header: 'Debit', id: 'debit', meta: { align: 'right' }, cell: ({ row }) => (debit(row.original) ? <MoneyText value={row.original.amount} currency={false} /> : '') },
  { header: 'Credit', id: 'credit', meta: { align: 'right' }, cell: ({ row }) => (!debit(row.original) ? <MoneyText value={row.original.amount} currency={false} className="text-success" /> : '') },
];

function CustomerDetail({ id }: { id: string }) {
  const key = useQueryKey();
  const canLedger = usePermission('Customers.ViewLedger');
  const customer = useQuery({ queryKey: key('customers', { id }), queryFn: () => customersApi.get(id) });
  const balance = useQuery({ queryKey: key('customers', { id, balance: true }), queryFn: () => customersApi.balance(id), enabled: canLedger });
  const ledger = useQuery({ queryKey: key('customers', { id, ledger: true }), queryFn: () => customersApi.ledger(id), enabled: canLedger });
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const pay = useApiMutation((body: Parameters<typeof customersApi.recordPayment>[1]) => customersApi.recordPayment(id, body), {
    invalidate: ['customers', 'dashboard'],
    success: (b) => `Payment recorded. Balance now ${formatMoney(b.outstandingBalance)}`,
    toastErrors: false,
  });

  if (customer.isLoading) return <LoadingState />;
  if (customer.error || !customer.data) return <ErrorState error={customer.error} onRetry={() => customer.refetch()} />;
  const c = customer.data;
  const b = balance.data;

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2">{c.customerName} <StatusBadge kind="active" value={c.isActive} /></span>}
        description={`${labels.priceType[c.priceType]} prices`}
        actions={
          <>
            <Button variant="ghost" asChild><Link href="/customers"><ArrowLeft />Customers</Link></Button>
            <Can permission="Customers.RecordPayment"><Button onClick={() => setPaying(true)}><Banknote />Record payment</Button></Can>
            <Can permission="Customers.Update"><Button variant="outline" onClick={() => setEditing(true)}><Pencil />Edit</Button></Can>
            <Can permission="Customers.Deactivate">
              <ActivationButton size="default" isActive={c.isActive} name={c.customerName} activate={() => customersApi.activate(id)} deactivate={() => customersApi.deactivate(id)} invalidate={['customers']} />
            </Can>
          </>
        }
      />
      {canLedger && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <StatCard label="Outstanding" value={b ? formatMoney(b.outstandingBalance) : '—'} icon={<Wallet />} tone={b && b.outstandingBalance > 0 ? 'warning' : 'success'} />
          <StatCard label="Credit limit" value={b ? (b.creditLimit === null ? 'No limit' : formatMoney(b.creditLimit)) : '—'} icon={<Scale />} />
          <StatCard label="Available credit" value={b ? (b.availableCredit === null ? 'Unlimited' : formatMoney(b.availableCredit)) : '—'} icon={<Banknote />} tone={b?.availableCredit !== null && (b?.availableCredit ?? 1) <= 0 ? 'destructive' : 'default'} />
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent>
            <DetailList
              columns={1}
              items={[
                { label: 'Phone', value: c.phoneNumber },
                { label: 'Email', value: c.email },
                { label: 'KRA PIN', value: c.kraPin },
                { label: 'Contact person', value: c.contactPerson },
                { label: 'Address', value: c.physicalAddress },
              ]}
            />
          </CardContent>
        </Card>
        {canLedger && (
          <div className="lg:col-span-2">
            <h2 className="mb-2 font-semibold">Statement</h2>
            <DataTable
              columns={ledgerColumns}
              data={ledger.data}
              isLoading={ledger.isLoading}
              error={ledger.error}
              onRetry={() => ledger.refetch()}
              getRowId={(e) => e.customerLedgerEntryId}
              emptyTitle="No transactions yet"
              csv={{
                fileName: `statement-${c.customerName}`,
                columns: [
                  { header: 'Date', value: (e) => e.createdAt },
                  { header: 'Entry', value: (e) => labels.customerLedgerEntryType[e.entryType] },
                  { header: 'Reference', value: (e) => e.referenceType },
                  { header: 'Method', value: (e) => (e.paymentMethod !== null ? labels.settlementMethod[e.paymentMethod] : '') },
                  { header: 'Payment ref', value: (e) => e.paymentReference },
                  { header: 'Notes', value: (e) => e.notes },
                  { header: 'Debit', value: (e) => (debit(e) ? e.amount : '') },
                  { header: 'Credit', value: (e) => (!debit(e) ? e.amount : '') },
                ],
              }}
            />
          </div>
        )}
      </div>
      <CustomerFormDialog open={editing} onOpenChange={setEditing} customer={c} />
      <SettlementDialog
        open={paying}
        onOpenChange={setPaying}
        title={`Payment from ${c.customerName}`}
        outstanding={b?.outstandingBalance}
        onSubmit={(p) => pay.mutateAsync(p)}
      />
    </>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <PermissionRoute permission="Customers.View"><CustomerDetail id={id} /></PermissionRoute>;
}
