'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Ban, ExternalLink, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Label, Textarea } from '@/components/ui/primitives';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DetailList, PageHeader, StatusBadge } from '@/components/shared/Display';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { expensesApi } from '@/api/endpoints/other';
import { ExpenseStatus, labels } from '@/api/enums';
import { useApiMutation } from '@/hooks/useApiMutation';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateOnly, formatDateTime, formatMoney } from '@/lib/format';
import { ActivityTimeline } from '@/features/audit/ActivityTimeline';
import { ExpenseFormDialog } from '@/features/expenses/ExpenseFormDialog';
import { useBranchLabels } from '@/features/branches/branches';

function ExpenseDetail({ id }: { id: string }) {
  const key = useQueryKey();
  const canAudit = usePermission('AuditLog.View');
  const branchName = useBranchLabels();
  const expense = useQuery({ queryKey: key('expenses', { id }), queryFn: () => expensesApi.get(id) });
  const [editing, setEditing] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState('');
  const voidExpense = useApiMutation((r: string) => expensesApi.void(id, r), { invalidate: ['expenses', 'dashboard'], success: 'Expense voided', toastErrors: false });

  if (expense.isLoading) return <LoadingState />;
  if (expense.error || !expense.data) return <ErrorState error={expense.error} onRetry={() => expense.refetch()} />;
  const x = expense.data;
  const posted = x.status === ExpenseStatus.Posted;

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2">Expense {x.expenseNumber} <StatusBadge kind="expense" value={x.status} /></span>}
        description={`${x.categoryName} · ${formatDateOnly(x.expenseDate)}`}
        actions={
          <>
            <Button variant="ghost" asChild><Link href="/expenses"><ArrowLeft />Expenses</Link></Button>
            {x.receiptUrl && <Button variant="outline" asChild><a href={x.receiptUrl} target="_blank" rel="noreferrer"><ExternalLink />Receipt</a></Button>}
            {posted && <Can permission="Expenses.Update"><Button variant="outline" onClick={() => setEditing(true)}><Pencil />Edit</Button></Can>}
            {posted && <Can permission="Expenses.Void"><Button variant="destructive" onClick={() => { setReason(''); setVoiding(true); }}><Ban />Void</Button></Can>}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{x.description}</CardTitle></CardHeader>
          <CardContent>
            <DetailList
              columns={3}
              items={[
                { label: 'Amount', value: <span className={`text-lg font-semibold ${posted ? '' : 'line-through opacity-60'}`}>{formatMoney(x.amount)}</span> },
                { label: 'Paid by', value: [labels.expensePaymentMethod[x.paymentMethod], x.paymentReference].filter(Boolean).join(' · ') },
                { label: 'Branch', value: x.branchId ? branchName(x.branchId) : 'Business-wide' },
                { label: 'Category', value: `${x.categoryCode} · ${x.categoryName}` },
                { label: 'Supplier / payee', value: x.supplierId ? <Link className="text-primary hover:underline" href={`/suppliers/${x.supplierId}`}>{x.supplierName}</Link> : x.payeeName },
                { label: 'Supplier invoice no.', value: x.supplierInvoiceNumber },
                { label: 'eTIMS control no.', value: x.etimsControlNumber ?? <span className="text-warning">Missing</span> },
                { label: 'Recorded', value: formatDateTime(x.createdAt) },
                ...(x.status === ExpenseStatus.Voided ? [{ label: 'Voided', value: `${formatDateTime(x.voidedAt)}${x.voidReason ? ` · ${x.voidReason}` : ''}` }] : []),
                ...(x.notes ? [{ label: 'Notes', value: x.notes }] : []),
              ]}
            />
          </CardContent>
        </Card>
        {canAudit && (
          <Card>
            <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
            <CardContent><ActivityTimeline entityType="Expense" entityId={id} /></CardContent>
          </Card>
        )}
      </div>
      <ExpenseFormDialog open={editing} onOpenChange={setEditing} expense={x} />
      <ConfirmDialog
        open={voiding}
        onOpenChange={setVoiding}
        title={`Void ${x.expenseNumber}?`}
        description="It stays on record but no longer counts in reports."
        confirmLabel="Void expense"
        destructive
        onConfirm={() => {
          if (!reason.trim()) throw new Error('Give a reason for voiding.');
          return voidExpense.mutateAsync(reason.trim());
        }}
      >
        <div className="space-y-1.5"><Label htmlFor="void-reason">Reason *</Label><Textarea id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      </ConfirmDialog>
    </>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <PermissionRoute permission="Expenses.View"><ExpenseDetail id={id} /></PermissionRoute>;
}
