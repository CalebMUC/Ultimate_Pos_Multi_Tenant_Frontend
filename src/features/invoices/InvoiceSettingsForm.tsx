'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { FormAlert } from '@/components/shared/States';
import { businessesApi } from '@/api/endpoints/business';
import { normaliseError } from '@/api/errors';
import { loadCurrentBusiness } from '@/features/auth/sessionActions';
import { usePermission } from '@/hooks/useSessionInfo';
import { addDays, todayIso } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSession } from '@/stores/session';
import type { InvoiceSettingsDto } from '@/api/dto/business';
import {
  applyInvoiceErrors, InvoiceDetailsFields, invoiceDetailsSchema, INVOICE_FIELDS, toInvoiceDetailsValues, toInvoiceSettings, type InvoiceDetailsValues,
} from './InvoiceDetailsFields';
import { sendPaymentTo } from './paymentDetails';
import { SendPaymentTo } from './SendPaymentTo';

const NONE: InvoiceSettingsDto = Object.fromEntries(INVOICE_FIELDS.map((k) => [k, null])) as unknown as InvoiceSettingsDto;

/** Saves through PUT /businesses/current/invoice-settings, then reloads the business so every invoice shows the change at once. */
async function saveSettings(body: InvoiceSettingsDto) {
  await businessesApi.updateInvoiceSettings(body);
  await loadCurrentBusiness();
}

/** The business's invoice payment details in a form, kept in step with the business when it reloads. */
function useInvoiceDetailsForm() {
  const invoice = useSession((s) => s.business?.invoice);
  const form = useForm<InvoiceDetailsValues>({ resolver: zodResolver(invoiceDetailsSchema), defaultValues: toInvoiceDetailsValues(invoice) });
  const { reset } = form;
  useEffect(() => { reset(toInvoiceDetailsValues(invoice)); }, [invoice, reset]);
  return { form, supported: useSession((s) => s.business?.invoice !== undefined && !!s.business) };
}

function NotSupported({ className }: { className?: string }) {
  return (
    <Alert variant="warning" className={className}>
      <AlertDescription>The server does not keep invoice payment details yet. Update the API, then set them here.</AlertDescription>
    </Alert>
  );
}

function useSave(form: UseFormReturn<InvoiceDetailsValues>, onSaved?: () => void) {
  const [error, setError] = useState<unknown>(null);
  const submit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await saveSettings(toInvoiceSettings(v));
      toast.success('Payment details saved');
      onSaved?.();
    } catch (err) {
      const apiError = normaliseError(err);
      const { matched, unmatched } = applyInvoiceErrors(form, apiError.fieldErrors);
      if (!matched || unmatched.length) setError(unmatched.length ? new Error(unmatched.join(' ')) : apiError);
    }
  });
  return { submit, error };
}

/** The form alone, for the invoice dialog: the invoice itself is the preview there. Needs Businesses.Update. */
export function InvoiceSettingsForm({ onSaved, onCancel, className }: { onSaved?(): void; onCancel?(): void; className?: string }) {
  const { form, supported } = useInvoiceDetailsForm();
  const { submit, error } = useSave(form, onSaved);
  if (!supported) return <NotSupported className={className} />;
  return (
    <form aria-label="Invoice payment details" className={cn('space-y-4', className)} onSubmit={submit} noValidate>
      <p className="text-sm text-muted-foreground">Printed under <span className="font-medium text-foreground">Send payment to</span> on every invoice, from every device.</p>
      <InvoiceDetailsFields form={form} />
      <FormAlert error={error} />
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" loading={form.formState.isSubmitting}>Save details</Button>
      </div>
    </form>
  );
}

/** The block as it will print, from what is in the form now. The due line counts from today. */
function Preview({ form }: { form: UseFormReturn<InvoiceDetailsValues> }) {
  const values = useWatch({ control: form.control }) as InvoiceDetailsValues;
  const dto = toInvoiceSettings({ ...toInvoiceDetailsValues(null), ...values });
  const days = dto.dueDays !== null && Number.isInteger(dto.dueDays) && dto.dueDays >= 0 && dto.dueDays <= 365 ? dto.dueDays : null;
  const block = sendPaymentTo(dto, days === null ? null : addDays(todayIso(), days));
  return (
    <aside aria-label="Preview" className="self-start rounded-md border bg-white p-4 text-[13px] text-neutral-900 shadow-sm lg:sticky lg:top-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">On the invoice</p>
      {block
        ? <SendPaymentTo block={block} variant="invoice" />
        : <p className="text-sm italic text-neutral-500">Nothing yet. The block is left off invoices until a bank, till or phone is set.</p>}
    </aside>
  );
}

/**
 * Settings → Invoices: where customers send the money for an invoice. Editable with Businesses.Update, shown read-only with
 * Businesses.View. Printed only: the M-Pesa till and paybill on the business profile route payments into the POS and are separate.
 */
export function InvoiceSettingsCard() {
  const canEdit = usePermission('Businesses.Update');
  const { form, supported } = useInvoiceDetailsForm();
  const { submit, error } = useSave(form);
  const [clearing, setClearing] = useState(false);
  const saved = useSession((s) => s.business?.invoice);
  const hasAny = !!saved && Object.values(saved).some((v) => v !== null);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Landmark className="size-5" />Send payment to</CardTitle>
        <CardDescription>
          Where customers who buy on credit send the money: printed on every invoice and credit-sale receipt, from every device. Separate
          from the M-Pesa till and paybill on the business profile, which bring payments into the till.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!supported ? <NotSupported /> : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <form aria-label="Invoice payment details" className="space-y-4" onSubmit={submit} noValidate>
              {!canEdit && <p className="text-sm text-muted-foreground">Only someone who can change the business profile can edit these.</p>}
              <InvoiceDetailsFields form={form} readOnly={!canEdit} />
              <FormAlert error={error} />
              {canEdit && (
                <div className="flex flex-wrap justify-between gap-2">
                  <Button type="button" variant="outline" disabled={!hasAny} onClick={() => setClearing(true)}>Clear all</Button>
                  <Button type="submit" loading={form.formState.isSubmitting}>Save</Button>
                </div>
              )}
            </form>
            <Preview form={form} />
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={clearing}
        onOpenChange={setClearing}
        title="Clear all payment details?"
        description="Invoices will no longer say where to send the money until new details are saved."
        confirmLabel="Clear all"
        destructive
        onConfirm={async () => {
          await saveSettings(NONE);
          toast.success('Payment details cleared');
        }}
      />
    </Card>
  );
}
