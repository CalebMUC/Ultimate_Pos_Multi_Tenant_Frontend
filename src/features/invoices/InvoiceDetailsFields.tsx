'use client';

import { z } from 'zod';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { Input, Textarea } from '@/components/ui/primitives';
import { Field } from '@/components/shared/Field';
import { text } from '@/lib/schemas';
import type { InvoiceSettingsDto } from '@/api/dto/business';
import { displayPhone } from './paymentDetails';

/** Offered as you type the bank name; any other bank can still be typed. */
export const KENYAN_BANKS = ['Equity Bank', 'KCB Bank', 'Co-operative Bank', 'Family Bank', 'NCBA Bank', 'Absa Bank', 'Stanbic Bank', 'I&M Bank', 'DTB Bank', 'Standard Chartered'];

const NOTE_MAX = 500;

/** 0712 345 678, 712345678, +254 712 345 678 → 254712345678, as the API stores it. Null when it is not a Kenyan mobile number. */
export function normaliseKenyanMobile(value: string): string | null {
  const d = value.replace(/\D/g, '');
  const n = d.length === 10 && d.startsWith('0') ? `254${d.slice(1)}` : d.length === 9 && /^[71]/.test(d) ? `254${d}` : d;
  return /^254[71]\d{8}$/.test(n) ? n : null;
}

const digits = (min: number, max: number, label: string) =>
  z.string().trim().refine((v) => v === '' || new RegExp(`^\\d{${min},${max}}$`).test(v), `A ${label} number is ${min}–${max} digits.`);

/** The API's own checks (CheckInvoiceSettings), so most mistakes show before saving. Every field is optional. */
export const invoiceDetailsSchema = z.object({
  bankName: text(100),
  bankBranch: text(100),
  bankAccountName: text(100),
  // Kept a string: an account number's leading zeros matter.
  bankAccountNumber: text(50),
  bankPaybillNumber: digits(5, 10, 'paybill'),
  tillNumber: digits(5, 7, 'till'),
  sendMoneyPhoneNumber: z.string().trim().refine((v) => v === '' || normaliseKenyanMobile(v) !== null, 'Give a Kenyan mobile number, e.g. 0712 345 678.'),
  dueDays: z.string().trim().refine((v) => v === '' || (/^\d{1,3}$/.test(v) && Number(v) <= 365), 'Days to pay is a whole number from 0 to 365.'),
  note: text(NOTE_MAX),
});
export type InvoiceDetailsValues = z.infer<typeof invoiceDetailsSchema>;

export const emptyInvoiceDetails: InvoiceDetailsValues = {
  bankName: '', bankBranch: '', bankAccountName: '', bankAccountNumber: '', bankPaybillNumber: '', tillNumber: '', sendMoneyPhoneNumber: '', dueDays: '', note: '',
};

/** The keys a 400 uses for these fields. */
export const INVOICE_FIELDS = Object.keys(emptyInvoiceDetails) as (keyof InvoiceDetailsValues)[];

export function toInvoiceDetailsValues(dto: InvoiceSettingsDto | null | undefined): InvoiceDetailsValues {
  return {
    bankName: dto?.bankName ?? '',
    bankBranch: dto?.bankBranch ?? '',
    bankAccountName: dto?.bankAccountName ?? '',
    bankAccountNumber: dto?.bankAccountNumber ?? '',
    bankPaybillNumber: dto?.bankPaybillNumber ?? '',
    tillNumber: dto?.tillNumber ?? '',
    sendMoneyPhoneNumber: dto?.sendMoneyPhoneNumber ? displayPhone(dto.sendMoneyPhoneNumber) : '',
    dueDays: dto?.dueDays == null ? '' : String(dto.dueDays),
    note: dto?.note ?? '',
  };
}

/** All nine fields, blanks as null: the API takes a full replace, so a field left out would be cleared anyway. */
export function toInvoiceSettings(v: InvoiceDetailsValues): InvoiceSettingsDto {
  const blank = (x: string) => (x.trim() ? x.trim() : null);
  return {
    bankName: blank(v.bankName),
    bankBranch: blank(v.bankBranch),
    bankPaybillNumber: blank(v.bankPaybillNumber),
    bankAccountName: blank(v.bankAccountName),
    bankAccountNumber: blank(v.bankAccountNumber),
    tillNumber: blank(v.tillNumber),
    sendMoneyPhoneNumber: blank(v.sendMoneyPhoneNumber),
    dueDays: v.dueDays.trim() === '' ? null : Number(v.dueDays),
    note: blank(v.note),
  };
}

export const allBlank = (dto: InvoiceSettingsDto) => Object.values(dto).every((x) => x === null);

/**
 * Puts a 400's field errors on these fields. The keys are the API's (bankName, tillNumber…), with or without an "invoice." prefix.
 * Returns the messages that belong to no field here.
 */
export function applyInvoiceErrors(form: UseFormReturn<InvoiceDetailsValues>, fieldErrors: Record<string, string[]>): { matched: boolean; unmatched: string[] } {
  let matched = false;
  const unmatched: string[] = [];
  for (const [path, msgs] of Object.entries(fieldErrors)) {
    const key = path.replace(/^invoice\./, '') as keyof InvoiceDetailsValues;
    if (INVOICE_FIELDS.includes(key)) {
      form.setError(key, { type: 'server', message: msgs.join(' ') });
      matched = true;
    } else unmatched.push(...msgs);
  }
  return { matched, unmatched };
}

/**
 * Where customers send the money for an invoice: a bank (name, branch, account name and number, its paybill), a Buy Goods till, or a
 * phone to send M-Pesa to; then days to pay and a note. readOnly shows them to someone who may not change them.
 */
export function InvoiceDetailsFields({ form, readOnly, compact }: { form: UseFormReturn<InvoiceDetailsValues>; readOnly?: boolean; compact?: boolean }) {
  const { register, formState: { errors } } = form;
  const note = useWatch({ control: form.control, name: 'note' }) ?? '';
  const cols = compact ? 'grid gap-3' : 'grid gap-3 sm:grid-cols-2';
  return (
    <fieldset disabled={readOnly} className="space-y-4">
      <datalist id="kenyan-banks">{KENYAN_BANKS.map((b) => <option key={b} value={b} />)}</datalist>
      <div className={cols}>
        <Field label="Bank name" error={errors.bankName}><Input list="kenyan-banks" autoComplete="off" maxLength={100} {...register('bankName')} /></Field>
        <Field label="Branch" error={errors.bankBranch}><Input autoComplete="off" maxLength={100} {...register('bankBranch')} /></Field>
        <Field label="Account name" error={errors.bankAccountName} hint="As it appears on the bank account."><Input autoComplete="off" maxLength={100} {...register('bankAccountName')} /></Field>
        <Field label="Account number" error={errors.bankAccountNumber}><Input autoComplete="off" maxLength={50} {...register('bankAccountNumber')} /></Field>
        <Field label="Bank paybill" error={errors.bankPaybillNumber} hint="The bank's M-Pesa paybill, e.g. Equity 247247.">
          <Input inputMode="numeric" autoComplete="off" maxLength={10} {...register('bankPaybillNumber')} />
        </Field>
        <Field label="Till number (Buy Goods)" error={errors.tillNumber}><Input inputMode="numeric" autoComplete="off" maxLength={7} {...register('tillNumber')} /></Field>
        <Field label="Send-money phone" error={errors.sendMoneyPhoneNumber} hint="Customers send M-Pesa straight to this number.">
          <Input type="tel" autoComplete="off" placeholder="0712 345 678" {...register('sendMoneyPhoneNumber')} />
        </Field>
        <Field label="Days to pay" error={errors.dueDays} hint="Empty: no due date, unless the customer promised one.">
          <Input inputMode="numeric" autoComplete="off" maxLength={3} {...register('dueDays')} />
        </Field>
      </div>
      <Field label="Invoice note" error={errors.note} hint={<span className="tabular-nums">{note.length}/{NOTE_MAX}</span>}>
        <Textarea rows={2} maxLength={NOTE_MAX} placeholder="e.g. Thank you for your business." {...register('note')} />
      </Field>
    </fieldset>
  );
}
