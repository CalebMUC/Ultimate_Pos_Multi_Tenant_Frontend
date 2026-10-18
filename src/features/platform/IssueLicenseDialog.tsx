'use client';

import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarRange } from 'lucide-react';
import { Input, NativeSelect, Textarea } from '@/components/ui/primitives';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { platformApi } from '@/api/endpoints/platform';
import { enumOptions, labels, LicenseKind, SettlementMethod } from '@/api/enums';
import { formatDateOnly } from '@/lib/format';
import { optionalNumber } from '@/lib/schemas';
import { cn, emptyToNull } from '@/lib/utils';
import { computeLicensePeriod } from '@/features/access/access';
import type { BusinessLicenseDto } from '@/api/dto/platform';

const schema = z
  .object({
    kind: z.coerce.number().pipe(z.nativeEnum(LicenseKind)),
    planName: z.string().trim().min(1, 'A plan name is required.').max(100),
    mode: z.enum(['months', 'endsOn']),
    months: optionalNumber({ min: 1, max: 36, label: 'Months' }),
    endsOn: z.string(),
    startsOn: z.string(),
    maxUsers: optionalNumber({ min: 1, max: 10000, label: 'Max users' }),
    amount: optionalNumber({ min: 0, label: 'Amount' }),
    paymentMethod: z.string(),
    paymentReference: z.string().trim().max(100),
    notes: z.string().trim().max(500),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'months' && v.months === null) ctx.addIssue({ code: 'custom', path: ['months'], message: 'Give the number of months (1–36).' });
    if (v.mode === 'months' && v.months !== null && !Number.isInteger(v.months)) ctx.addIssue({ code: 'custom', path: ['months'], message: 'Whole months only.' });
    if (v.mode === 'endsOn' && !v.endsOn) ctx.addIssue({ code: 'custom', path: ['endsOn'], message: 'Pick the end date.' });
    if (v.amount !== null && Math.round(v.amount * 100) !== v.amount * 100) ctx.addIssue({ code: 'custom', path: ['amount'], message: 'At most 2 decimal places.' });
    if (v.kind === LicenseKind.Paid) {
      if (!v.amount || v.amount <= 0) ctx.addIssue({ code: 'custom', path: ['amount'], message: 'A paid licence needs the amount paid.' });
      if (v.paymentMethod === '') ctx.addIssue({ code: 'custom', path: ['paymentMethod'], message: 'How was it paid?' });
      if (v.paymentMethod !== '' && Number(v.paymentMethod) !== SettlementMethod.Cash && !v.paymentReference)
        ctx.addIssue({ code: 'custom', path: ['paymentReference'], message: 'Give the M-Pesa code, bank reference or cheque number.' });
    }
  });
type Values = z.infer<typeof schema>;

export interface LicenseTarget { businessId: string; businessName: string; licenseEndsOn: string | null }

/**
 * Issues a licence period, or renews: with no start date it continues the day after the current licence ends. The period the API
 * will record is shown before saving.
 */
export function IssueLicenseDialog({ open, onOpenChange, business, previous }: {
  open: boolean;
  onOpenChange(open: boolean): void;
  business: LicenseTarget | null;
  /** The latest licence, to prefill plan and user limit on a renewal. */
  previous?: BusinessLicenseDto | null;
}) {
  const qc = useQueryClient();
  return (
    <FormDialog<Values>
      open={open && !!business}
      onOpenChange={onOpenChange}
      title={`${business?.licenseEndsOn ? 'Renew' : 'Issue'} licence · ${business?.businessName ?? ''}`}
      description={business?.licenseEndsOn ? `The current licence runs to ${formatDateOnly(business.licenseEndsOn)}.` : 'This business has no current licence.'}
      size="lg"
      schema={schema}
      submitLabel="Save licence"
      defaultValues={{
        kind: LicenseKind.Paid,
        planName: previous?.planName ?? '',
        mode: 'months',
        months: 12,
        endsOn: '',
        startsOn: '',
        maxUsers: previous?.maxUsers ?? null,
        amount: null,
        paymentMethod: String(SettlementMethod.Mpesa),
        paymentReference: '',
        notes: '',
      }}
      onSubmit={async (v) => {
        const saved = await platformApi.issueLicense(business!.businessId, {
          kind: v.kind,
          planName: v.planName,
          months: v.mode === 'months' ? v.months : null,
          endsOn: v.mode === 'endsOn' ? v.endsOn : null,
          startsOn: v.startsOn || null,
          maxUsers: v.maxUsers,
          amount: v.amount ?? 0,
          paymentMethod: v.paymentMethod === '' ? null : (Number(v.paymentMethod) as SettlementMethod),
          paymentReference: emptyToNull(v.paymentReference),
          notes: emptyToNull(v.notes),
        });
        await qc.invalidateQueries({ queryKey: ['platform'] });
        toast.success(`${saved.licenseNumber} issued: ${formatDateOnly(saved.startsOn)} – ${formatDateOnly(saved.endsOn)}`);
      }}
    >
      {(form) => {
        const e = form.formState.errors;
        const v = form.watch();
        const months = typeof v.months === 'number' && !Number.isNaN(v.months) ? v.months : null;
        const period = computeLicensePeriod({
          months: v.mode === 'months' ? months : null,
          endsOn: v.mode === 'endsOn' ? v.endsOn : null,
          startsOn: v.startsOn || null,
          currentEndsOn: business?.licenseEndsOn ?? null,
        });
        const paid = Number(v.kind) === LicenseKind.Paid;
        return (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Kind" error={e.kind}>
                <NativeSelect {...form.register('kind')}>{enumOptions(labels.licenseKind).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
              </Field>
              <Field label="Plan" required error={e.planName} className="sm:col-span-2"><Input placeholder="e.g. Standard" autoFocus {...form.register('planName')} /></Field>
            </div>

            <fieldset className="space-y-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">Period</legend>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="radio" value="months" {...form.register('mode')} />Number of months</label>
                <label className="flex items-center gap-2"><input type="radio" value="endsOn" {...form.register('mode')} />Until a date</label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {v.mode === 'months' ? (
                  <Field label="Months" required error={e.months}><Input type="number" min={1} max={36} step={1} {...form.register('months', { valueAsNumber: true })} /></Field>
                ) : (
                  <Field label="Ends on" required error={e.endsOn}><Input type="date" {...form.register('endsOn')} /></Field>
                )}
                <Field label="Starts on" error={e.startsOn} hint={business?.licenseEndsOn ? 'Leave empty to continue from the current licence.' : 'Leave empty to start today.'}>
                  <Input type="date" {...form.register('startsOn')} />
                </Field>
              </div>
              <div
                data-testid="license-period"
                className={cn('flex items-start gap-2 rounded-md px-3 py-2 text-sm', period.ok ? 'bg-primary/5' : 'bg-destructive/5 text-destructive')}
              >
                <CalendarRange className="mt-0.5 size-4 shrink-0" />
                {period.ok ? (
                  <span>
                    <span className="font-medium">{formatDateOnly(period.startsOn)} – {formatDateOnly(period.endsOn)}</span>
                    <span className="text-muted-foreground"> · {period.days} days{period.renewal ? ' · continues from the current licence' : ''}</span>
                  </span>
                ) : <span>{period.error}</span>}
              </div>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Max users" error={e.maxUsers} hint="Empty for unlimited."><Input type="number" min={1} {...form.register('maxUsers', { valueAsNumber: true })} /></Field>
              <Field label="Amount (KES)" required={paid} error={e.amount}><Input type="number" min={0} step="0.01" {...form.register('amount', { valueAsNumber: true })} /></Field>
              <Field label="Paid by" error={e.paymentMethod}>
                <NativeSelect {...form.register('paymentMethod')}>
                  <option value="">Not paid</option>
                  {enumOptions(labels.settlementMethod).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Payment reference" error={e.paymentReference} className="sm:col-span-3"
                hint={paid && Number(v.paymentMethod) !== SettlementMethod.Cash ? 'Required for a paid licence not paid in cash.' : undefined}>
                <Input {...form.register('paymentReference')} />
              </Field>
              <Field label="Notes" error={e.notes} className="sm:col-span-3"><Textarea {...form.register('notes')} /></Field>
            </div>
          </div>
        );
      }}
    </FormDialog>
  );
}
