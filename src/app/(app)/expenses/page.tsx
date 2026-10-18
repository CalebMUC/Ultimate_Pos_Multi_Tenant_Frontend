'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Ban, ExternalLink, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, Label, Textarea } from '@/components/ui/primitives';
import { Checkbox } from '@/components/ui/overlays';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { DateRangeFilter, presetRange } from '@/components/shared/DateRange';
import { MoneyText, PageHeader, StatusBadge } from '@/components/shared/Display';
import { EnumSelect, ExpenseCategorySelect } from '@/components/shared/Pickers';
import { expensesApi } from '@/api/endpoints/other';
import { ExpenseStatus, labels, type ExpensePaymentMethod } from '@/api/enums';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { usePermissions, useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateOnly } from '@/lib/format';
import { ExpenseFormDialog } from '@/features/expenses/ExpenseFormDialog';
import type { ExpenseDto } from '@/api/dto/expenses';

function Expenses() {
  const key = useQueryKey();
  const can = usePermissions();
  const [range, setRange] = useState(() => presetRange('month'));
  const [categoryId, setCategoryId] = useState('');
  const [method, setMethod] = useState<ExpensePaymentMethod | null>(null);
  const [status, setStatus] = useState<ExpenseStatus | null>(ExpenseStatus.Posted);
  const [missingEtims, setMissingEtims] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [editing, setEditing] = useState<ExpenseDto | 'new' | null>(null);
  const [voiding, setVoiding] = useState<ExpenseDto | null>(null);
  const [reason, setReason] = useState('');
  const debounced = useDebouncedValue(search.trim(), 300);
  const params = {
    ...range, page, pageSize, search: debounced || undefined, categoryId: categoryId || undefined, paymentMethod: method ?? undefined,
    status: status ?? undefined, missingEtims: missingEtims || undefined,
  };
  const query = useQuery({ queryKey: key('expenses', params), queryFn: () => expensesApi.list(params), placeholderData: keepPreviousData });
  const voidExpense = useApiMutation((v: { id: string; reason: string }) => expensesApi.void(v.id, v.reason), { invalidate: ['expenses', 'dashboard'], success: 'Expense voided', toastErrors: false });
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };

  const columns: ColumnDef<ExpenseDto, unknown>[] = [
    { header: 'No.', accessorKey: 'expenseNumber', cell: ({ row }) => <span className="font-medium">{row.original.expenseNumber}</span> },
    { header: 'Date', accessorKey: 'expenseDate', cell: ({ row }) => formatDateOnly(row.original.expenseDate) },
    { header: 'Category', accessorKey: 'categoryName' },
    {
      header: 'Description',
      accessorKey: 'description',
      meta: { className: 'max-w-xs' },
      cell: ({ row }) => (
        <span className="block truncate">
          {row.original.description}
          {(row.original.supplierName || row.original.payeeName) && <span className="block text-xs text-muted-foreground">{row.original.supplierName ?? row.original.payeeName}</span>}
          {row.original.status === ExpenseStatus.Voided && row.original.voidReason && <span className="block text-xs text-destructive">Void: {row.original.voidReason}</span>}
        </span>
      ),
    },
    { header: 'Paid by', accessorKey: 'paymentMethod', cell: ({ row }) => labels.expensePaymentMethod[row.original.paymentMethod] },
    { header: 'eTIMS', accessorKey: 'etimsControlNumber', cell: ({ row }) => (row.original.etimsControlNumber ? <Badge variant="success">Yes</Badge> : <Badge variant="warning">Missing</Badge>) },
    { header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge kind="expense" value={row.original.status} /> },
    { header: 'Amount', accessorKey: 'amount', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.amount} className={row.original.status === ExpenseStatus.Voided ? 'line-through opacity-60' : 'font-medium'} /> },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right' },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {row.original.receiptUrl && <Button variant="ghost" size="icon-sm" asChild><a href={row.original.receiptUrl} target="_blank" rel="noreferrer" aria-label="Open receipt"><ExternalLink /></a></Button>}
          {row.original.status === ExpenseStatus.Posted && can('Expenses.Update') && <Button variant="ghost" size="icon-sm" onClick={() => setEditing(row.original)} aria-label="Edit"><Pencil /></Button>}
          {row.original.status === ExpenseStatus.Posted && can('Expenses.Void') && <Button variant="ghost" size="icon-sm" onClick={() => { setReason(''); setVoiding(row.original); }} aria-label="Void"><Ban /></Button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Expenses" description="Operating costs: rent, salaries, utilities, transport… They feed the profit and loss report." actions={<Can permission="Expenses.Create"><Button onClick={() => setEditing('new')}><Plus />New expense</Button></Can>} />
      <DataTable
        mode="server"
        columns={columns}
        data={query.data?.items}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        getRowId={(x) => x.expenseId}
        page={page}
        pageSize={pageSize}
        totalCount={query.data?.meta.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={reset(setPageSize)}
        search={search}
        onSearchChange={reset(setSearch)}
        searchPlaceholder="Number, description, payee…"
        emptyTitle="No expenses in this period"
        toolbar={
          <>
            <DateRangeFilter value={range} onChange={reset(setRange)} />
            <ExpenseCategorySelect value={categoryId} onChange={(e) => reset(setCategoryId)(e.target.value)} placeholder="All categories" activeOnly={false} className="w-44" aria-label="Category" />
            <EnumSelect map={labels.expensePaymentMethod} value={method} onChange={reset(setMethod)} placeholder="Any method" className="w-36" aria-label="Payment method" />
            <EnumSelect map={labels.expenseStatus} value={status} onChange={reset(setStatus)} placeholder="Any status" className="w-32" aria-label="Status" />
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={missingEtims} onCheckedChange={(v) => reset(setMissingEtims)(v === true)} />Missing eTIMS</label>
          </>
        }
        csv={{
          fileName: `expenses-${range.from}-to-${range.to}`,
          columns: [
            { header: 'No.', value: (x) => x.expenseNumber },
            { header: 'Date', value: (x) => x.expenseDate },
            { header: 'Category', value: (x) => x.categoryName },
            { header: 'Description', value: (x) => x.description },
            { header: 'Supplier / payee', value: (x) => x.supplierName ?? x.payeeName },
            { header: 'Paid by', value: (x) => labels.expensePaymentMethod[x.paymentMethod] },
            { header: 'Reference', value: (x) => x.paymentReference },
            { header: 'Invoice no.', value: (x) => x.supplierInvoiceNumber },
            { header: 'eTIMS', value: (x) => x.etimsControlNumber },
            { header: 'Status', value: (x) => labels.expenseStatus[x.status] },
            { header: 'Amount', value: (x) => x.amount },
          ],
        }}
      />
      <ExpenseFormDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} expense={editing === 'new' ? null : editing} />
      <ConfirmDialog
        open={!!voiding}
        onOpenChange={(o) => !o && setVoiding(null)}
        title={`Void ${voiding?.expenseNumber}?`}
        description="It stays on record but no longer counts in reports."
        confirmLabel="Void expense"
        destructive
        onConfirm={() => {
          if (!reason.trim()) throw new Error('Give a reason for voiding.');
          return voidExpense.mutateAsync({ id: voiding!.expenseId, reason: reason.trim() });
        }}
      >
        <div className="space-y-1.5"><Label htmlFor="void-reason">Reason *</Label><Textarea id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      </ConfirmDialog>
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Expenses.View"><Expenses /></PermissionRoute>;
}
