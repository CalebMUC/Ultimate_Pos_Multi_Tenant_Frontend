import { addDays, formatDateOnly, toIsoDate } from '@/lib/format';
import type { InvoiceSettingsDto } from '@/api/dto/business';
import type { DateOnly } from '@/api/dto/common';

export interface PaymentLine { label: string; value: string }

/** What an invoice prints under "Send payment to": the payment lines that are set, then the due date and the note. */
export interface SendPaymentToBlock {
  lines: PaymentLine[];
  /** "Due by 18 Nov 2026", or null. */
  due: string | null;
  note: string | null;
}

/** "0712 345 678" for 254712345678 (or 254112345678); anything else as stored. */
export function displayPhone(phone: string): string {
  const m = /^254([17]\d{2})(\d{3})(\d{3})$/.exec(phone);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : phone;
}

const set = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);

/** "Ruiru branch", leaving "Ruiru Branch" as typed. */
const branchText = (branch: string) => (/\bbranch$/i.test(branch) ? branch : `${branch} branch`);

/**
 * The "Send payment to" block, in the printed order. Null when no payment detail is set (no settings, or only days and a note): the
 * block is then left off altogether, never printed with empty labels. Printed only: the business's M-Pesa till and paybill, which
 * route payments into the POS, are never used here.
 */
export function sendPaymentTo(settings: InvoiceSettingsDto | null | undefined, dueOn: DateOnly | null): SendPaymentToBlock | null {
  if (!settings) return null;
  const bank = set(settings.bankName);
  const branch = set(settings.bankBranch);
  const account = set(settings.bankAccountNumber);
  const paybill = set(settings.bankPaybillNumber);
  const phone = set(settings.sendMoneyPhoneNumber);
  const pairs: [string, string | null][] = [
    ['Bank', [bank, branch && branchText(branch)].filter(Boolean).join(', ') || null],
    ['Account name', set(settings.bankAccountName)],
    ['Account no.', account],
    ['M-Pesa Paybill', paybill && (account ? `${paybill}, Account ${account}` : paybill)],
    ['Buy Goods Till', set(settings.tillNumber)],
    ['Send Money', phone && displayPhone(phone)],
  ];
  const lines = pairs.flatMap(([label, value]) => (value ? [{ label, value }] : []));
  if (lines.length === 0) return null;
  return { lines, due: dueOn ? `Due by ${formatDateOnly(dueOn)}` : null, note: set(settings.note) };
}

/** When an invoice for a sale falls due: the customer's promise first, else the sale's day plus the business's days to pay. */
export function dueDateFor(saleCreatedAt: string, promised: DateOnly | null | undefined, dueDays: number | null | undefined): DateOnly | null {
  if (promised) return promised;
  return dueDays == null ? null : addDays(toIsoDate(new Date(saleCreatedAt)), dueDays);
}
