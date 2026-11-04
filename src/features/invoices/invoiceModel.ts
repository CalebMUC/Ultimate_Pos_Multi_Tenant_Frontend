import { addDays, formatQty, toIsoDate } from '@/lib/format';
import { round2, sum } from '@/lib/utils';
import type { CustomerDto } from '@/api/dto/business';
import type { DateOnly, Guid } from '@/api/dto/common';
import type { OpenInvoiceDto } from '@/api/dto/reports';
import type { SaleDto } from '@/api/dto/sales';
import { dueDateFor } from './paymentDetails';

/** Who the invoice is addressed to. Only the name is certain: the rest needs Customers.View. */
export interface InvoiceParty {
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  kraPin?: string | null;
}

/** One printed row. date and reference are set on the first row of each sale, on an account invoice only. */
export interface InvoiceItem {
  key: string;
  date: DateOnly | null;
  reference: string | null;
  description: string;
  quantity: string;
  unitPrice: number | null;
  total: number;
}

/** An invoice ready to print. Every amount is the API's: sale totals and what the aging report says is still owed. */
export interface InvoiceModel {
  number: string;
  issuedOn: DateOnly;
  dueOn: DateOnly | null;
  customer: InvoiceParty;
  items: InvoiceItem[];
  /** Several sales: rows carry the sale's date and number. */
  bySale: boolean;
  subtotal: number;
  discount: number;
  /** VAT included in the total. */
  tax: number;
  total: number;
  /** Payments and credit notes set against it. Null when not known (no CustomerReports.View): the whole total is then shown as due. */
  paid: number | null;
  balanceDue: number;
}

export function partyFromCustomer(customer: CustomerDto): InvoiceParty {
  return {
    name: customer.customerName,
    contactPerson: customer.contactPerson,
    phone: customer.phoneNumber,
    email: customer.email,
    address: customer.physicalAddress,
    kraPin: customer.kraPin,
  };
}

/** The local calendar day a sale was made. */
export const saleDate = (sale: SaleDto): DateOnly => toIsoDate(new Date(sale.createdAt));

/** "4 × 20L" for a pack size (a unit that starts with a number), else "2.5 kg". */
export function invoiceQty(quantity: number, unit?: string | null): string {
  return unit && /^\d/.test(unit) ? `${formatQty(quantity)} × ${unit}` : formatQty(quantity, unit);
}

/** A sale's rows as the receipt prints them: each bundle as one row, its parts left off. */
export function saleItems(sale: SaleDto, bySale = false): InvoiceItem[] {
  const rows: Omit<InvoiceItem, 'date' | 'reference'>[] = [
    ...sale.lines.filter((l) => !l.productBundleId).map((l) => ({
      key: l.saleLineId,
      description: l.productName,
      quantity: invoiceQty(l.quantity, l.unitSymbol),
      unitPrice: l.unitPrice,
      total: l.lineTotal,
    })),
    ...(sale.bundles ?? []).map((b) => ({
      key: `${sale.saleId}:${b.productBundleId}`,
      description: b.name,
      quantity: formatQty(b.quantity),
      unitPrice: b.quantity ? round2(b.total / b.quantity) : null,
      total: b.total,
    })),
  ];
  return rows.map((r, i) => ({
    ...r,
    date: bySale && i === 0 ? saleDate(sale) : null,
    reference: bySale && i === 0 ? sale.saleNumber : null,
  }));
}

/**
 * One credit sale. open: its row in the customer's aging report, null when nothing is owed on it any more; undefined when the report
 * could not be read, so what was paid is not known. The customer's promise to pay sets the due date, else the business's terms.
 */
export function saleInvoice({ sale, customer, open, dueDays }: {
  sale: SaleDto;
  customer: InvoiceParty;
  open: OpenInvoiceDto | null | undefined;
  dueDays: number | null;
}): InvoiceModel {
  const issuedOn = saleDate(sale);
  const known = open !== undefined;
  const balanceDue = known ? open?.outstandingAmount ?? 0 : sale.totalAmount;
  return {
    number: sale.saleNumber,
    issuedOn,
    dueOn: dueDateFor(sale.createdAt, sale.paymentDueDate ?? open?.paymentDueDate, dueDays),
    customer,
    items: saleItems(sale),
    bySale: false,
    subtotal: sale.subtotal,
    discount: sale.discountTotal,
    tax: sale.taxTotal,
    total: sale.totalAmount,
    paid: known ? round2(Math.max(0, sale.totalAmount - balanceDue)) : null,
    balanceDue,
  };
}

/** Not stored by the API: the same customer on the same day gets the same number, so a reprint matches what was sent. */
export function accountInvoiceNumber(customerId: Guid, issuedOn: DateOnly): string {
  return `ACC-${issuedOn.replace(/-/g, '').slice(2)}-${customerId.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}

/**
 * Everything a customer still owes, as one invoice: each unpaid credit sale, oldest first, with what has already been paid against them.
 * sales: the sales behind invoices, in any order.
 */
export function accountInvoice({ customerId, customer, invoices, sales, issuedOn, dueDays }: {
  customerId: Guid;
  customer: InvoiceParty;
  invoices: OpenInvoiceDto[];
  sales: SaleDto[];
  issuedOn: DateOnly;
  dueDays: number | null;
}): InvoiceModel {
  const byId = new Map(sales.map((s) => [s.saleId, s]));
  const ordered = [...invoices].sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate)).flatMap((i) => byId.get(i.invoiceId) ?? []);
  const total = round2(sum(ordered, (s) => s.totalAmount));
  const balanceDue = round2(sum(invoices, (i) => i.outstandingAmount));
  return {
    number: accountInvoiceNumber(customerId, issuedOn),
    issuedOn,
    dueOn: dueDays !== null ? addDays(issuedOn, dueDays) : null,
    customer,
    items: ordered.flatMap((s) => saleItems(s, true)),
    bySale: true,
    subtotal: round2(sum(ordered, (s) => s.subtotal)),
    discount: round2(sum(ordered, (s) => s.discountTotal)),
    tax: round2(sum(ordered, (s) => s.taxTotal)),
    total,
    paid: round2(Math.max(0, total - balanceDue)),
    balanceDue,
  };
}
