'use client';

import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { etimsApi } from '@/api/endpoints/etims';
import { EtimsSubmissionStatus, labels, PaymentMethod, SaleStatus } from '@/api/enums';
import { useHasModule, usePermission } from '@/hooks/useSessionInfo';
import { EtimsQr } from '@/features/etims/EtimsQr';
import { isNotFound } from '@/features/etims/etims';
import { formatDateOnly, formatDateTime, formatMoney, formatQty } from '@/lib/format';
import { usePreferences, type ReceiptPaper } from '@/stores/preferences';
import { useSession } from '@/stores/session';
import { cn, round2 } from '@/lib/utils';
import type { SaleDto } from '@/api/dto/sales';
import { customerDiscountLabel } from './customerDiscount';

/**
 * A printable receipt. Prices, VAT and totals are the API's, never recomputed. live: the sale was just made, so keep asking for KRA's
 * signature for a while (the POS "sale complete" dialog).
 */
export function Receipt({ sale, paper, live = false }: { sale: SaleDto; paper: ReceiptPaper; live?: boolean }) {
  const business = useSession((s) => s.business);
  const etims = useHasModule('etims');
  const narrow = paper === '80mm';
  return (
    <div className={cn('print-area mx-auto bg-white font-mono text-black', narrow ? 'w-[72mm] p-2 text-[11px]' : 'w-full max-w-[190mm] p-6 text-sm')}>
      <style>{`@media print { @page { size: ${narrow ? '80mm auto' : 'A4'}; margin: ${narrow ? '2mm' : '12mm'}; } }`}</style>
      <div className="text-center">
        {business?.logoUrl && !narrow && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={business.logoUrl} alt="" className="mx-auto mb-2 h-14 object-contain" />
        )}
        <p className="text-base font-bold">{business?.tradingName || business?.businessName}</p>
        {business?.tradingName && <p>{business.businessName}</p>}
        {business?.physicalAddress && <p>{business.physicalAddress}</p>}
        {business?.phoneNumber && <p>Tel: {business.phoneNumber}</p>}
        {business?.kraPin && <p>PIN: {business.kraPin}</p>}
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <p className="text-center font-bold">{business?.isVatRegistered ? 'TAX INVOICE' : 'SALES RECEIPT'}</p>
      <div className="mt-1 space-y-0.5">
        <Row label="Receipt" value={sale.saleNumber} />
        {sale.kraBranchId && <Row label="Branch" value={`${sale.kraBranchId} · ${sale.branchName ?? ''}`} />}
        <Row label="Date" value={formatDateTime(sale.createdAt)} />
        {sale.customerName && <Row label="Customer" value={sale.customerName} />}
        {sale.createdByName && <Row label="Served by" value={sale.createdByName} />}
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <table className="w-full">
        <thead>
          <tr className="text-left">
            <th className="font-bold">Item</th>
            <th className="text-right font-bold">Qty</th>
            {!narrow && <th className="text-right font-bold">Price</th>}
            <th className="text-right font-bold">Total</th>
          </tr>
        </thead>
        <tbody>
          {/* Bundle parts are not printed: each bundle is one row below. */}
          {sale.lines.filter((l) => !l.productBundleId).map((l) => (
            <tr key={l.saleLineId} className="align-top">
              <td className="pr-1">
                {l.productName}
                {narrow && <div className="text-[10px]">@ {formatMoney(l.unitPrice, { currency: false })}</div>}
                {l.discountAmount > 0 && <div className="text-[10px]">Disc −{formatMoney(l.discountAmount, { currency: false })}</div>}
                {l.batches?.map((b) => (
                  <div key={b.stockBatchId} className="text-[10px]">Batch {b.batchNumber}{b.expiryDate ? ` exp ${formatDateOnly(b.expiryDate)}` : ''}</div>
                ))}
              </td>
              <td className="whitespace-nowrap text-right">{formatQty(l.quantity, l.unitSymbol)}</td>
              {!narrow && <td className="text-right">{formatMoney(l.unitPrice, { currency: false })}</td>}
              <td className="text-right">{formatMoney(l.lineTotal, { currency: false })}</td>
            </tr>
          ))}
          {sale.bundles?.map((b) => (
            <tr key={b.productBundleId} className="align-top">
              <td className="pr-1">
                {b.name}
                {b.discountAmount > 0 && <div className="text-[10px]">Disc −{formatMoney(b.discountAmount, { currency: false })}</div>}
              </td>
              <td className="whitespace-nowrap text-right">{formatQty(b.quantity)}</td>
              {!narrow && <td />}
              <td className="text-right">{formatMoney(b.total, { currency: false })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="space-y-0.5">
        <Row label="Subtotal" value={formatMoney(sale.subtotal)} />
        {/* The customer's standing discount is part of discountTotal: its own line, the rest as "Discount". */}
        {(sale.customerDiscountAmount ?? 0) > 0 && (
          <Row label={customerDiscountLabel(sale.customerDiscountSource, sale.customerDiscountPercent)} value={`−${formatMoney(sale.customerDiscountAmount)}`} />
        )}
        {round2(sale.discountTotal - (sale.customerDiscountAmount ?? 0)) > 0 && (
          <Row label="Discount" value={`−${formatMoney(round2(sale.discountTotal - (sale.customerDiscountAmount ?? 0)))}`} />
        )}
        {business?.isVatRegistered && <Row label="VAT (incl.)" value={formatMoney(sale.taxTotal)} />}
        <Row label="TOTAL" value={formatMoney(sale.totalAmount)} bold />
        <Row label="Paid by" value={labels.paymentMethod[sale.paymentMethod]} />
        {sale.mpesaReference && <Row label="M-Pesa code" value={sale.mpesaReference} />}
        {sale.paymentMethod === PaymentMethod.Cash && sale.amountTendered !== null && (
          <>
            <Row label="Tendered" value={formatMoney(sale.amountTendered)} />
            <Row label="Change" value={formatMoney(sale.changeDue)} />
          </>
        )}
        {sale.status !== SaleStatus.Completed && <Row label="Status" value={labels.saleStatus[sale.status].toUpperCase()} bold />}
        {sale.returnedAmount > 0 && <Row label="Returned" value={formatMoney(sale.returnedAmount)} />}
      </div>
      {etims && <KraBlock saleId={sale.saleId} narrow={narrow} live={live} />}
      {sale.prescription && (
        <>
          <div className="my-2 border-t border-dashed border-black" />
          <Row label="Patient" value={sale.prescription.patientName} />
          <Row label="Prescriber" value={sale.prescription.prescriberName} />
          {sale.prescription.prescriptionNumber && <Row label="Rx no." value={sale.prescription.prescriptionNumber} />}
        </>
      )}
      <div className="my-2 border-t border-dashed border-black" />
      <p className="text-center">Thank you for your business!</p>
      {sale.status === SaleStatus.Voided && <p className="mt-1 text-center font-bold">*** VOID ***</p>}
    </div>
  );
}

function Row({ label, value, bold, wrap }: { label: string; value: string; bold?: boolean; wrap?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-2', bold && 'font-bold')}>
      <span className="shrink-0">{label}</span>
      <span className={cn('text-right', wrap && 'min-w-0 break-all')}>{value}</span>
    </div>
  );
}

/** How long, and how often, a just-made sale keeps asking for its signature. The API's worker sends every 15 s. */
const SIGNATURE_POLL_MS = 5_000;
const SIGNATURE_WAIT_MS = 60_000;

/**
 * KRA's signature and QR code: what makes the receipt valid for KRA. Printed exactly as KRA returned it. No block at all when the
 * sale will never be reported (404: its branch has no active device, or the sale predates it).
 */
function KraBlock({ saleId, narrow, live }: { saleId: string; narrow: boolean; live: boolean }) {
  const canSeeEtims = usePermission('Etims.View');
  const startedAt = useRef(Date.now());
  const query = useQuery({
    queryKey: ['etims-receipt', saleId],
    queryFn: () => etimsApi.saleReceipt(saleId),
    retry: (count, error) => !isNotFound(error) && count < 2,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      const waiting = status === EtimsSubmissionStatus.Pending || status === EtimsSubmissionStatus.Failed;
      return live && waiting && Date.now() - startedAt.current < SIGNATURE_WAIT_MS ? SIGNATURE_POLL_MS : false;
    },
  });
  const r = query.data;
  if (!r) return null;
  const signed = r.status === EtimsSubmissionStatus.Sent;
  return (
    <>
      <div className="my-2 border-t border-dashed border-black" />
      <p className="text-center font-bold">KRA eTIMS</p>
      {signed ? (
        <div className="mt-1 space-y-0.5">
          <Row label="SCU ID" value={r.sdcId ?? ''} />
          <Row label="MRC" value={r.mrcNo ?? ''} />
          <Row label="Invoice No" value={String(r.invoiceNumber ?? '')} />
          <Row label="Receipt No" value={`${r.receiptNumber ?? ''} / ${r.totalReceiptNumber ?? ''}`} />
          <Row label="Date" value={r.sdcDateTime ?? ''} />
          <Row label="Internal Data" value={r.internalData ?? ''} wrap />
          <Row label="Receipt Sign" value={r.receiptSignature ?? ''} wrap />
          {r.verificationUrl && (
            <div className="flex justify-center pt-2" data-testid="kra-qr">
              <EtimsQr value={r.verificationUrl} size={narrow ? '28mm' : '35mm'} />
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="mt-1 text-center">KRA signature pending — reprint shortly</p>
          {r.status === EtimsSubmissionStatus.Rejected && canSeeEtims && r.resultMessage && (
            <p className="no-print mt-1 rounded bg-red-50 p-1 text-center font-sans text-xs text-red-700">KRA refused this sale: {r.resultMessage}</p>
          )}
        </>
      )}
    </>
  );
}

export function ReceiptDialog({ sale, open, onOpenChange, title = 'Receipt', actions, live }: {
  sale: SaleDto | null;
  open: boolean;
  onOpenChange(o: boolean): void;
  title?: string;
  actions?: React.ReactNode;
  /** A sale just made: keep fetching KRA's signature while it is pending. */
  live?: boolean;
}) {
  const paper = usePreferences((s) => s.receiptPaper);
  const setPref = usePreferences((s) => s.set);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={paper === 'a4' ? 'lg' : 'sm'} aria-describedby={undefined}>
        <DialogHeader className="no-print">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto rounded border bg-white">{sale && <Receipt sale={sale} paper={paper} live={live} />}</div>
        <DialogFooter className="no-print sm:justify-between">
          <div className="flex gap-1">
            {(['80mm', 'a4'] as const).map((p) => (
              <Button key={p} size="sm" variant={paper === p ? 'secondary' : 'ghost'} onClick={() => setPref('receiptPaper', p)}>{p === 'a4' ? 'A4' : '80 mm'}</Button>
            ))}
          </div>
          <div className="flex gap-2">
            {actions}
            <Button onClick={() => window.print()}><Printer />Print</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
