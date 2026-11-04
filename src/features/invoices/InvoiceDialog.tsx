'use client';

import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Download, Printer, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/States';
import { customersApi } from '@/api/endpoints/business';
import { reportsApi } from '@/api/endpoints/other';
import { salesApi } from '@/api/endpoints/sales';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { todayIso } from '@/lib/format';
import { printReceipt } from '@/lib/print';
import { useSession } from '@/stores/session';
import type { CustomerDto } from '@/api/dto/business';
import type { Guid } from '@/api/dto/common';
import type { SaleDto } from '@/api/dto/sales';
import { InvoiceDocument } from './Invoice';
import { accountInvoice, partyFromCustomer, saleInvoice, type InvoiceModel } from './invoiceModel';
import { InvoiceSettingsForm } from './InvoiceSettingsForm';
import { downloadPdf, invoiceFileName } from './downloadPdf';

/** Days to pay, from the business's invoice settings. */
const useDueDays = () => useSession((s) => s.business?.invoice?.dueDays ?? null);

/** Prints the open invoice. The page title names the PDF when it is saved instead of printed. */
export function printInvoice(number: string) {
  const previous = document.title;
  document.title = `Invoice ${number}`;
  window.addEventListener('afterprint', () => { document.title = previous; }, { once: true });
  printReceipt('a4');
}

/**
 * The invoice preview, then Print (or save as PDF from the print dialog). Payment details is there for whoever may change them
 * (Businesses.Update): they are the business's, so a change shows on every invoice from every device. The body shows what loading or
 * failing left instead of an invoice; empty says why there is nothing to bill.
 */
export function InvoiceDialog({ open, onOpenChange, title, description, invoice, isLoading, error, onRetry, empty }: {
  open: boolean;
  onOpenChange(o: boolean): void;
  title: string;
  description?: ReactNode;
  invoice: InvoiceModel | null;
  isLoading?: boolean;
  error?: unknown;
  onRetry?(): void;
  empty?: ReactNode;
}) {
  const canEdit = usePermission('Businesses.Update');
  const [editing, setEditing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const page = useRef<HTMLDivElement>(null);
  const ready = !isLoading && !error && invoice;

  async function download() {
    const article = page.current?.querySelector<HTMLElement>('article');
    if (!invoice || !article) return;
    setDownloading(true);
    try {
      await downloadPdf(article, invoiceFileName(invoice.number, invoice.customer.name));
    } catch {
      toast.error('The PDF could not be made. Use Print invoice and choose Save as PDF instead.');
    } finally {
      setDownloading(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setEditing(false); onOpenChange(o); }}>
      <DialogContent size="xl">
        <DialogHeader className="no-print">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description ?? 'Check it, then print it, or download it as a PDF to send.'}</DialogDescription>
        </DialogHeader>
        {editing && (
          <InvoiceSettingsForm className="no-print rounded-md border bg-muted/40 p-4" onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
        )}
        <div className="max-h-[65vh] overflow-y-auto rounded-md border bg-neutral-100 p-3 sm:p-5 dark:bg-neutral-900">
          {isLoading ? (
            <LoadingState label="Preparing the invoice…" />
          ) : error ? (
            <ErrorState error={error} onRetry={onRetry} />
          ) : invoice ? (
            <div ref={page} className="shadow-md">
              <InvoiceDocument invoice={invoice} />
            </div>
          ) : (
            empty ?? <EmptyState title="Nothing to invoice" />
          )}
        </div>
        <DialogFooter className="no-print sm:justify-between">
          {canEdit ? (
            <Button variant="outline" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
              <Settings2 />Payment details
            </Button>
          ) : <span />}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={!ready} loading={downloading} onClick={download}><Download />Download PDF</Button>
            <Button disabled={!ready} onClick={() => invoice && printInvoice(invoice.number)}><Printer />Print invoice</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The customer's aging row: their unpaid credit sales and what is still owed on each. Keyed under 'customers' so a payment refreshes it. */
function useCustomerOpenInvoices(customerId: Guid | null, enabled: boolean) {
  const key = useQueryKey();
  const query = useQuery({
    queryKey: key('customers', { id: customerId, openInvoices: true }),
    queryFn: () => reportsApi.customerAging({ customerId: customerId!, includeInvoices: true }),
    enabled: enabled && !!customerId,
  });
  // A customer who owes nothing is left out of the report.
  const row = query.data?.customers.find((c) => c.customerId === customerId);
  return { query, invoices: query.data ? row?.openInvoices ?? [] : undefined };
}

/**
 * The invoice for one credit sale. What is still owed comes from the aging report; without CustomerReports.View the whole total shows as
 * due. The customer's contact details need Customers.View, else only the name on the sale is printed.
 */
export function SaleInvoiceDialog({ sale, open, onOpenChange }: { sale: SaleDto; open: boolean; onOpenChange(o: boolean): void }) {
  const key = useQueryKey();
  const canCustomer = usePermission('Customers.View');
  const canAging = usePermission('CustomerReports.View');
  const dueDays = useDueDays();
  const customer = useQuery({
    queryKey: key('customers', { id: sale.customerId }),
    queryFn: () => customersApi.get(sale.customerId!),
    enabled: open && canCustomer && !!sale.customerId,
  });
  const aging = useCustomerOpenInvoices(sale.customerId, open && canAging);
  const isLoading = customer.isLoading || aging.query.isLoading;
  const owed = aging.invoices ? aging.invoices.find((i) => i.invoiceId === sale.saleId) ?? null : undefined;
  const invoice = isLoading || aging.query.error ? null : saleInvoice({
    sale,
    // A failed customer load still leaves the name on the sale.
    customer: customer.data ? partyFromCustomer(customer.data) : { name: sale.customerName ?? 'Customer' },
    open: owed,
    dueDays,
  });
  return (
    <InvoiceDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Invoice ${sale.saleNumber}`}
      invoice={invoice}
      isLoading={isLoading}
      error={aging.query.error}
      onRetry={() => aging.query.refetch()}
    />
  );
}

/** One invoice for everything a customer still owes on credit sales, oldest first. Needs CustomerReports.View and Sales.View. */
export function CustomerInvoiceDialog({ customer, open, onOpenChange }: { customer: CustomerDto; open: boolean; onOpenChange(o: boolean): void }) {
  const key = useQueryKey();
  const dueDays = useDueDays();
  const aging = useCustomerOpenInvoices(customer.customerId, open);
  const sales = useQueries({
    queries: (aging.invoices ?? []).map((i) => ({ queryKey: key('sales', { id: i.invoiceId }), queryFn: () => salesApi.get(i.invoiceId), enabled: open })),
  });
  const failed = aging.query.error ?? sales.find((s) => s.error)?.error;
  const isLoading = aging.query.isLoading || sales.some((s) => s.isLoading);
  const loaded = sales.flatMap((s) => (s.data ? [s.data] : []));
  const invoice = aging.invoices?.length && loaded.length === aging.invoices.length
    ? accountInvoice({
        customerId: customer.customerId,
        customer: partyFromCustomer(customer),
        invoices: aging.invoices,
        sales: loaded,
        issuedOn: todayIso(),
        dueDays,
      })
    : null;
  const count = aging.invoices?.length ?? 0;
  return (
    <InvoiceDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Invoice for ${customer.customerName}`}
      description={count > 0 ? `Every credit sale ${customer.customerName} has not paid for yet (${count}), oldest first.` : undefined}
      invoice={invoice}
      isLoading={isLoading}
      error={failed}
      onRetry={() => { void aging.query.refetch(); sales.filter((s) => s.error).forEach((s) => void s.refetch()); }}
      empty={<EmptyState title="Nothing owed" message={`${customer.customerName} has no unpaid credit sales.`} />}
    />
  );
}
