'use client';

import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Input, NativeSelect, Textarea } from '@/components/ui/primitives';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { ExpenseCategorySelect, SupplierPicker } from '@/components/shared/Pickers';
import { expensesApi } from '@/api/endpoints/other';
import { enumOptions, ExpensePaymentMethod, labels } from '@/api/enums';
import { usePermission } from '@/hooks/useSessionInfo';
import { todayIso } from '@/lib/format';
import { requiredNumber, requiredText, text } from '@/lib/schemas';
import { emptyToNull } from '@/lib/utils';
import type { ExpenseDto } from '@/api/dto/expenses';

const schema = z.object({
  expenseDate: z.string().min(1, 'Pick a date.').refine((d) => d <= todayIso(), 'The date can’t be in the future.'),
  expenseCategoryId: z.string().min(1, 'Select a category.'),
  description: requiredText('Description', 500),
  amount: requiredNumber('Amount', { gt: 0 }),
  paymentMethod: z.coerce.number().pipe(z.nativeEnum(ExpensePaymentMethod)),
  paymentReference: text(100),
  supplierId: z.string(),
  payeeName: text(150),
  supplierInvoiceNumber: text(100),
  etimsControlNumber: text(100),
  receiptUrl: z.string().trim().max(500).refine((v) => v === '' || /^https?:\/\//i.test(v), 'Use a full link starting with https://'),
  notes: text(1000),
});
type Values = z.infer<typeof schema>;

export function ExpenseFormDialog({ open, onOpenChange, expense }: { open: boolean; onOpenChange(o: boolean): void; expense?: ExpenseDto | null }) {
  const qc = useQueryClient();
  const editing = !!expense;
  const canSuppliers = usePermission('Suppliers.View');
  return (
    <FormDialog<Values>
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit ${expense!.expenseNumber}` : 'New expense'}
      description={editing ? 'Date, amount and payment method are locked once posted. To change them, void this expense and post a new one.' : undefined}
      size="lg"
      schema={schema}
      defaultValues={{
        expenseDate: expense?.expenseDate ?? todayIso(),
        expenseCategoryId: expense?.expenseCategoryId ?? '',
        description: expense?.description ?? '',
        amount: expense?.amount ?? (undefined as unknown as number),
        paymentMethod: expense?.paymentMethod ?? ExpensePaymentMethod.Cash,
        paymentReference: expense?.paymentReference ?? '',
        supplierId: expense?.supplierId ?? '',
        payeeName: expense?.payeeName ?? '',
        supplierInvoiceNumber: expense?.supplierInvoiceNumber ?? '',
        etimsControlNumber: expense?.etimsControlNumber ?? '',
        receiptUrl: expense?.receiptUrl ?? '',
        notes: expense?.notes ?? '',
      }}
      onSubmit={async (v) => {
        const common = {
          expenseCategoryId: v.expenseCategoryId,
          description: v.description,
          paymentReference: emptyToNull(v.paymentReference),
          supplierId: v.supplierId || null,
          payeeName: emptyToNull(v.payeeName),
          supplierInvoiceNumber: emptyToNull(v.supplierInvoiceNumber),
          etimsControlNumber: emptyToNull(v.etimsControlNumber),
          receiptUrl: emptyToNull(v.receiptUrl),
          notes: emptyToNull(v.notes),
        };
        if (editing) await expensesApi.update(expense!.expenseId, common);
        else await expensesApi.create({ ...common, expenseDate: v.expenseDate, amount: v.amount, paymentMethod: v.paymentMethod });
        await Promise.all(['expenses', 'dashboard'].map((r) => qc.invalidateQueries({ queryKey: [r] })));
        toast.success(editing ? 'Expense updated' : 'Expense posted');
      }}
    >
      {(form) => {
        const e = form.formState.errors;
        return (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Date" required error={e.expenseDate}><Input type="date" max={todayIso()} readOnly={editing} className="read-only:bg-muted" {...form.register('expenseDate')} /></Field>
            <Field label="Amount (KES)" required error={e.amount}><Input type="number" step="0.01" min={0} readOnly={editing} className="read-only:bg-muted" {...form.register('amount', { valueAsNumber: true })} /></Field>
            <Field label="Paid by" error={e.paymentMethod}>
              {editing ? (
                // Not registered: the locked value stays in the form's defaults.
                <Input readOnly className="bg-muted" value={labels.expensePaymentMethod[expense!.paymentMethod]} />
              ) : (
                <NativeSelect {...form.register('paymentMethod')}>
                  {enumOptions(labels.expensePaymentMethod).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </NativeSelect>
              )}
            </Field>
            <Field label="Category" required error={e.expenseCategoryId}><ExpenseCategorySelect {...form.register('expenseCategoryId')} /></Field>
            <Field label="Description" required error={e.description} className="sm:col-span-2"><Input autoFocus {...form.register('description')} /></Field>
            <Field label="Payment reference" error={e.paymentReference} hint="M-Pesa code, cheque no.…"><Input {...form.register('paymentReference')} /></Field>
            {canSuppliers ? (
              <Field label="Supplier" error={e.supplierId}>
                <div><SupplierPicker value={form.watch('supplierId') || null} selectedLabel={expense?.supplierName} clearable onChange={(id) => form.setValue('supplierId', id ?? '')} placeholder="None" /></div>
              </Field>
            ) : <div />}
            <Field label="Payee (if not a supplier)" error={e.payeeName}><Input {...form.register('payeeName')} /></Field>
            <Field label="Supplier invoice no." error={e.supplierInvoiceNumber}><Input {...form.register('supplierInvoiceNumber')} /></Field>
            <Field label="eTIMS control no." error={e.etimsControlNumber} hint="From the supplier’s KRA eTIMS invoice."><Input {...form.register('etimsControlNumber')} /></Field>
            <Field label="Receipt link" error={e.receiptUrl} className="sm:col-span-2"><Input type="url" placeholder="https://…" {...form.register('receiptUrl')} /></Field>
            <Field label="Notes" error={e.notes} className="sm:col-span-3"><Textarea {...form.register('notes')} /></Field>
          </div>
        );
      }}
    </FormDialog>
  );
}
