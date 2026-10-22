'use client';

import type { ReactNode } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { formatDateTime, formatMoney, formatQty } from '@/lib/format';
import { cn } from '@/lib/utils';
import { usePreferences, type ReceiptPaper } from '@/stores/preferences';
import { useSession } from '@/stores/session';
import { PaymentMethod } from '@/api/enums';
import type { DeliveryOrderDto } from '@/api/dto/deliveries';
import { paymentLabel } from './DeliveryDialogs';

/**
 * What the rider takes with the goods: who, where, what, and how much to collect and how. Not a receipt: there is no sale until the rider
 * is back. The amount is the API's estimate for the order.
 */
export function DeliveryNote({ order, paper }: { order: DeliveryOrderDto; paper: ReceiptPaper }) {
  const business = useSession((s) => s.business);
  const narrow = paper === '80mm';
  const method = order.expectedPaymentMethod ?? PaymentMethod.Cash;
  const plain = order.lines.filter((l) => !l.productBundleId);
  const bundles = order.lines.filter((l, i, all) => l.productBundleId && all.findIndex((x) => x.productBundleId === l.productBundleId) === i);
  return (
    <div className={cn('print-area mx-auto bg-white font-mono text-black', narrow ? 'w-[72mm] p-2 text-[11px]' : 'w-full max-w-[190mm] p-6 text-sm')}>
      <style>{`@media print { @page { size: ${narrow ? '80mm auto' : 'A4'}; margin: ${narrow ? '2mm' : '12mm'}; } }`}</style>
      <div className="text-center">
        <p className="text-base font-bold">{business?.tradingName || business?.businessName}</p>
        {business?.phoneNumber && <p>Tel: {business.phoneNumber}</p>}
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <p className="text-center font-bold">DELIVERY NOTE</p>
      <p className="text-center">Not a receipt</p>
      <div className="mt-1 space-y-0.5">
        <Row label="Order" value={order.orderNumber} />
        {order.tripNumber && <Row label="Trip" value={order.tripNumber} />}
        <Row label="Date" value={formatDateTime(order.dispatchedAt ?? order.createdAt)} />
        {order.riderName && <Row label="Rider" value={order.riderName} />}
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="space-y-0.5">
        <p className="font-bold">{order.customerName}</p>
        <p>{order.deliveryAddress}</p>
        {order.contactPhone && <p>Tel: {order.contactPhone}</p>}
        {order.notes && <p className="italic">{order.notes}</p>}
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <table className="w-full">
        <thead>
          <tr className="text-left"><th className="font-bold">Item</th><th className="text-right font-bold">Qty</th></tr>
        </thead>
        <tbody>
          {plain.map((l) => (
            <tr key={l.deliveryOrderLineId}><td className="pr-1">{l.productName}</td><td className="whitespace-nowrap text-right">{formatQty(l.quantity, l.unitSymbol)}</td></tr>
          ))}
          {bundles.map((l) => (
            <tr key={l.productBundleId}><td className="pr-1">{l.bundleName ?? l.productName}</td><td className="whitespace-nowrap text-right">{formatQty(l.bundleQuantity ?? 1)}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="space-y-0.5">
        <Row label={method === PaymentMethod.Credit ? 'ON ACCOUNT' : 'TO COLLECT'} value={formatMoney(order.estimatedTotal)} bold />
        <Row label="Payment" value={paymentLabel(method)} />
        {method === PaymentMethod.MpesaReference && <p>Bring back the M-Pesa code from the customer’s SMS.</p>}
      </div>
      <div className="my-6 border-t border-black pt-1 text-center">Received by (name, signature)</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-2', bold && 'font-bold')}>
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

export function DeliveryNoteDialog({ order, open, onOpenChange, actions }: { order: DeliveryOrderDto | null; open: boolean; onOpenChange(o: boolean): void; actions?: ReactNode }) {
  const paper = usePreferences((s) => s.receiptPaper);
  const setPref = usePreferences((s) => s.set);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={paper === 'a4' ? 'lg' : 'sm'}>
        <DialogHeader className="no-print">
          <DialogTitle>{order ? `${order.orderNumber} is out with ${order.riderName ?? 'the rider'}` : 'Delivery note'}</DialogTitle>
          <DialogDescription>Not completed until the rider is back. Print this note for the rider.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto rounded border bg-white">{order && <DeliveryNote order={order} paper={paper} />}</div>
        <DialogFooter className="no-print sm:justify-between">
          <div className="flex gap-1">
            {(['80mm', 'a4'] as const).map((p) => (
              <Button key={p} size="sm" variant={paper === p ? 'secondary' : 'ghost'} onClick={() => setPref('receiptPaper', p)}>{p === 'a4' ? 'A4' : '80 mm'}</Button>
            ))}
          </div>
          <div className="flex gap-2">
            {actions}
            <Button onClick={() => window.print()}><Printer />Print delivery note</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
