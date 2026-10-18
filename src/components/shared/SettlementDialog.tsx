'use client';

import { z } from 'zod';
import { Input, NativeSelect, Textarea } from '@/components/ui/primitives';
import { labels, SettlementMethod, enumOptions } from '@/api/enums';
import { formatMoney } from '@/lib/format';
import { requiredNumber, text } from '@/lib/schemas';
import { emptyToNull } from '@/lib/utils';
import { Field } from './Field';
import { FormDialog } from './FormDialog';

const schema = z.object({
  amount: requiredNumber('Amount', { gt: 0 }),
  paymentMethod: z.coerce.number().pipe(z.nativeEnum(SettlementMethod)),
  paymentReference: text(100),
  notes: text(500),
});
type Values = z.infer<typeof schema>;

export interface SettlementPayload { amount: number; paymentMethod: SettlementMethod; paymentReference: string | null; notes: string | null }

/** Records a payment received from a customer or made to a supplier. */
export function SettlementDialog({ open, onOpenChange, title, outstanding, onSubmit }: {
  open: boolean;
  onOpenChange(o: boolean): void;
  title: string;
  outstanding?: number;
  onSubmit(payload: SettlementPayload): Promise<unknown>;
}) {
  return (
    <FormDialog<Values>
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={outstanding !== undefined ? `Outstanding balance: ${formatMoney(outstanding)}` : undefined}
      schema={schema}
      defaultValues={{ amount: undefined as unknown as number, paymentMethod: SettlementMethod.Cash, paymentReference: '', notes: '' }}
      submitLabel="Record payment"
      onSubmit={(v) => onSubmit({ amount: v.amount, paymentMethod: v.paymentMethod, paymentReference: emptyToNull(v.paymentReference), notes: emptyToNull(v.notes) })}
    >
      {(form) => (
        <>
          <Field label="Amount (KES)" required error={form.formState.errors.amount}>
            <Input type="number" step="0.01" min={0} inputMode="decimal" autoFocus {...form.register('amount', { valueAsNumber: true })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Method" error={form.formState.errors.paymentMethod}>
              <NativeSelect {...form.register('paymentMethod')}>
                {enumOptions(labels.settlementMethod).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Reference" error={form.formState.errors.paymentReference} hint="M-Pesa code, cheque or bank ref.">
              <Input {...form.register('paymentReference')} />
            </Field>
          </div>
          <Field label="Notes" error={form.formState.errors.notes}>
            <Textarea {...form.register('notes')} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
