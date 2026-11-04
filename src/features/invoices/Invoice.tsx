'use client';

import { useState } from 'react';
import { formatDateOnly, formatMoney, todayIso } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSession } from '@/stores/session';
import type { DateOnly } from '@/api/dto/common';
import type { InvoiceModel } from './invoiceModel';
import { sendPaymentTo } from './paymentDetails';
import { SendPaymentTo } from './SendPaymentTo';

/** The table keeps at least this many rows, so a one-item invoice still reads as a ruled form. */
const MIN_ROWS = 4;

/** "10 June 2026". */
function longDate(value: DateOnly): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * A printable A4 invoice in the business's name, its logo centred at the top. Black on white whatever the app theme, so it prints and
 * saves to PDF as it shows. Where to pay comes from the business's invoice settings, and is left off when none are set.
 */
export function InvoiceDocument({ invoice }: { invoice: InvoiceModel }) {
  const business = useSession((s) => s.business);
  const payment = sendPaymentTo(business?.invoice, invoice.dueOn);
  const [logoFailed, setLogoFailed] = useState<string | null>(null);
  const name = business?.tradingName || business?.businessName || '';
  const legalName = business?.tradingName && business.businessName !== business.tradingName ? business.businessName : null;
  const contact = [business?.physicalAddress, business?.phoneNumber && `Tel ${business.phoneNumber}`, business?.email].filter(Boolean);
  const logo = business?.logoUrl && business.logoUrl !== logoFailed ? business.logoUrl : null;
  const settled = invoice.paid !== null && invoice.balanceDue <= 0;
  const overdue = !settled && !!invoice.dueOn && invoice.dueOn < todayIso();
  const c = invoice.customer;
  const columns = invoice.bySale ? 6 : 4;
  const filler = Math.max(0, MIN_ROWS - invoice.items.length);
  const th = 'border-l-2 border-black px-4 py-3 text-right font-bold first:border-l-0';
  const td = 'px-4 py-3 align-top';

  return (
    <article
      aria-label={`Invoice ${invoice.number}`}
      className="print-area invoice mx-auto w-full max-w-[190mm] bg-white px-10 py-9 font-sans text-[13px] leading-normal text-neutral-900 print:px-0 print:py-0"
    >
      <style>{'@media print { @page { size: A4; margin: 14mm; } .invoice { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }'}</style>

      <header className="flex flex-col items-center text-center">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" onError={() => setLogoFailed(logo)} className="h-24 max-w-[70mm] object-contain" />
        )}
        <p className={cn('text-2xl font-bold uppercase tracking-[0.18em] text-black', logo && 'mt-3')}>{name}</p>
        {legalName && <p className="text-[11px] uppercase tracking-wider text-neutral-500">{legalName}</p>}
        {contact.length > 0 && <p className="mt-1.5 text-xs text-neutral-600">{contact.join('  ·  ')}</p>}
        {business?.kraPin && <p className="text-xs text-neutral-600">KRA PIN {business.kraPin}</p>}
      </header>

      <div className="mt-6 border-t-[3px] border-black" />

      <div className="mt-7 flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black leading-none tracking-tight text-black">INVOICE</h1>
          {business?.isVatRegistered && <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Tax invoice</p>}
          {(settled || overdue) && (
            <p
              className={cn(
                'mt-3 inline-block -rotate-2 rounded border-2 px-3 py-0.5 text-sm font-black tracking-[0.3em]',
                settled ? 'border-emerald-700 text-emerald-700' : 'border-red-700 text-red-700',
              )}
            >
              {settled ? 'PAID' : 'OVERDUE'}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-[auto_auto] items-baseline gap-x-6 gap-y-1 text-right">
          <dt className="text-neutral-500">Invoice no.</dt>
          <dd className="font-semibold text-black">{invoice.number}</dd>
          <dt className="text-neutral-500">Date</dt>
          <dd className="text-base font-bold uppercase text-black">{longDate(invoice.issuedOn)}</dd>
          {invoice.dueOn && (
            <>
              <dt className="text-neutral-500">Due date</dt>
              <dd className={cn('font-semibold', overdue ? 'text-red-700' : 'text-black')}>{longDate(invoice.dueOn)}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="mt-9 grid grid-cols-2 gap-10">
        <section aria-label="Invoice to">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-black">Invoice to:</h2>
          <p className="mt-2.5 text-base font-semibold uppercase text-black">{c.name}</p>
          <div className="mt-1 space-y-0.5 text-neutral-700">
            {c.contactPerson && <p>Attn: {c.contactPerson}</p>}
            {c.address && <p>{c.address}</p>}
            {c.phone && <p>Tel: {c.phone}</p>}
            {c.email && <p>{c.email}</p>}
            {c.kraPin && <p>KRA PIN: {c.kraPin}</p>}
          </div>
        </section>
        {payment ? (
          <div>
            <SendPaymentTo block={payment} variant="invoice" />
            <p className="mt-2 text-xs text-neutral-500">Quote <span className="font-semibold text-neutral-800">{invoice.number}</span> when you pay.</p>
          </div>
        ) : (
          <p className="no-print self-start rounded border border-dashed border-neutral-300 p-3 text-xs italic text-neutral-500">
            No payment details yet, so the invoice does not say where to pay. Add them in Settings → Invoices. This note is not printed.
          </p>
        )}
      </div>

      <table className="mt-9 w-full border-collapse border-2 border-black">
        <thead>
          <tr className="border-b-2 border-black text-black">
            {invoice.bySale && <th className={cn(th, 'text-left')}>Date</th>}
            {invoice.bySale && <th className={cn(th, 'text-left')}>Ref</th>}
            <th className={cn(th, 'w-full text-left')}>Description</th>
            <th className={th}>Qty</th>
            <th className={th}>Price</th>
            <th className={th}>Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item) => (
            <tr key={item.key} className={cn('border-neutral-400', item.reference ? 'border-t' : 'border-t border-dotted first:border-t-0')}>
              {invoice.bySale && <td className={cn(td, 'whitespace-nowrap text-neutral-600')}>{item.date ? formatDateOnly(item.date) : ''}</td>}
              {invoice.bySale && <td className={cn(td, 'whitespace-nowrap text-neutral-600')}>{item.reference ?? ''}</td>}
              <td className={cn(td, 'text-black')}>{item.description}</td>
              <td className={cn(td, 'whitespace-nowrap text-right tabular-nums')}>{item.quantity}</td>
              <td className={cn(td, 'whitespace-nowrap text-right tabular-nums')}>{item.unitPrice === null ? '' : formatMoney(item.unitPrice, { currency: false })}</td>
              <td className={cn(td, 'whitespace-nowrap text-right font-medium tabular-nums text-black')}>{formatMoney(item.total, { currency: false })}</td>
            </tr>
          ))}
          {Array.from({ length: filler }, (_, i) => (
            <tr key={`filler-${i}`} aria-hidden className="h-11 border-t border-neutral-400">
              <td colSpan={columns} />
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-5 flex justify-end">
        <table className="w-[56%] border-collapse border-2 border-black text-sm" aria-label="Totals">
          <tbody>
            {(invoice.discount > 0 || invoice.subtotal !== invoice.total) && <TotalRow label="Subtotal" value={formatMoney(invoice.subtotal)} />}
            {invoice.discount > 0 && <TotalRow label="Discount" value={`−${formatMoney(invoice.discount)}`} />}
            {business?.isVatRegistered && <TotalRow label="VAT (incl.)" value={formatMoney(invoice.tax)} />}
            <TotalRow label="Total" value={formatMoney(invoice.total)} strong />
            {invoice.paid !== null && invoice.paid > 0 && <TotalRow label="Paid" value={`−${formatMoney(invoice.paid)}`} />}
            <tr className="border-t-2 border-black bg-black text-white">
              <th scope="row" className="px-4 py-3 text-left font-bold uppercase tracking-wide">Balance due</th>
              <td className="px-4 py-3 text-right text-base font-black tabular-nums">{formatMoney(invoice.balanceDue)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer className="mt-14 flex items-end justify-between gap-8">
        <div className="max-w-[62%] space-y-1 text-xs text-neutral-600">
          {business?.phoneNumber && <p>Questions about this invoice? Call {business.phoneNumber}.</p>}
        </div>
        <p className="shrink-0 border-b-[3px] border-black pb-1 text-2xl font-black tracking-wide text-black">THANK YOU</p>
      </footer>
    </article>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr className="border-t border-neutral-300 first:border-t-0">
      <th scope="row" className={cn('border-r-2 border-black px-4 py-2.5 text-left font-medium', strong && 'font-bold text-black')}>{label}</th>
      <td className={cn('px-4 py-2.5 text-right tabular-nums', strong && 'font-bold text-black')}>{value}</td>
    </tr>
  );
}
