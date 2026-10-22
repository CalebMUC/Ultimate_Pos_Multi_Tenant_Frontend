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
import { useActiveBusiness, usePermission } from '@/hooks/useSessionInfo';
import { Checkbox } from '@/components/ui/overlays';
import { useSession } from '@/stores/session';
import { branchLabel, useBranchLabels } from '@/features/branches/branches';
import { todayIso } from '@/lib/format';
import { requiredNumber, requiredText, text } from '@/lib/schemas';
import { emptyToNull } from '@/lib/utils';
import type { ExpenseDto } from '@/api/dto/expenses';
import { RiderNameInput } from '@/features/deliveries/RiderNameInput';

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
  /** The rider the cost was for (their fuel). Only tagged expenses count as a rider's fuel. */
  riderName: text(100),
  // Optional: the select is disabled (so left out) while Business-wide is ticked.
  branchId: z.string().optional(),
  /** A cost of no one branch (head-office rent). Branches.AccessAll only. */
  businessWide: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function ExpenseFormDialog({ open, onOpenChange, expense }: { open: boolean; onOpenChange(o: boolean): void; expense?: ExpenseDto | null }) {
  const qc = useQueryClient();
  const editing = !!expense;
  const canSuppliers = usePermission('Suppliers.View');
  // Business-wide expenses are seen only by those who see every branch, and only they may post one.
  const accessAll = usePermission('Branches.AccessAll');
  const activeBranchId = useSession((s) => s.activeBranchId);
  const myBranches = useSession((s) => s.branches);
  const branchName = useBranchLabels();
  const delivers = useActiveBusiness().hasModule('deliveries');
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
        riderName: expense?.riderName ?? '',
        branchId: expense ? expense.branchId ?? '' : activeBranchId ?? '',
        businessWide: expense ? !expense.branchId : false,
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
        if (editing) {
          // "" removes the tag; leaving it out (a business that doesn't deliver) keeps it.
          await expensesApi.update(expense!.expenseId, { ...common, ...(delivers ? { riderName: v.riderName.trim() } : {}) });
        } else {
          await expensesApi.create({
            ...common,
            riderName: delivers ? emptyToNull(v.riderName) : null,
            expenseDate: v.expenseDate,
            amount: v.amount,
            paymentMethod: v.paymentMethod,
            ...(v.businessWide && accessAll ? { businessWide: true } : { branchId: v.branchId || null }),
          });
        }
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
            {delivers && (
              <Field label="Rider" error={e.riderName} hint="Fuel for a rider: counted against their trips.">
                <RiderNameInput value={form.watch('riderName')} onChange={(v) => form.setValue('riderName', v, { shouldDirty: true })} placeholder="None" />
              </Field>
            )}
            {editing ? (
              (myBranches.length > 1 || !expense!.branchId) && (
                <Field label="Branch" hint="Fixed once posted.">
                  <Input readOnly className="bg-muted" value={expense!.branchId ? branchName(expense!.branchId) : 'Business-wide'} />
                </Field>
              )
            ) : (
              (myBranches.length > 1 || accessAll) && (
                <div className="space-y-1.5 sm:col-span-2">
                  {myBranches.length > 1 && (
                    <Field label="Branch" error={e.branchId}>
                      <NativeSelect {...form.register('branchId')} disabled={form.watch('businessWide')}>
                        {myBranches.map((b) => <option key={b.branchId} value={b.branchId}>{branchLabel(b)}</option>)}
                      </NativeSelect>
                    </Field>
                  )}
                  {accessAll && (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={form.watch('businessWide')} onCheckedChange={(v) => form.setValue('businessWide', v === true)} />
                      Business-wide (not one branch’s cost, e.g. head-office rent)
                    </label>
                  )}
                </div>
              )
            )}
            <Field label="Notes" error={e.notes} className="sm:col-span-3"><Textarea {...form.register('notes')} /></Field>
          </div>
        );
      }}
    </FormDialog>
  );
}
