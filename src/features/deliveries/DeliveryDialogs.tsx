'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Banknote, CreditCard, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { Alert, AlertDescription, AlertTitle, Input, Label } from '@/components/ui/primitives';
import { FormAlert } from '@/components/shared/States';
import { deliveryOrdersApi } from '@/api/endpoints/deliveries';
import { normaliseError } from '@/api/errors';
import { PaymentMethod, labels } from '@/api/enums';
import { usePermission } from '@/hooks/useSessionInfo';
import { formatMoney, formatQty } from '@/lib/format';
import { cn, round2 } from '@/lib/utils';
import { TillPayments } from '@/features/pos/PaymentDialog';
import type { CartLine } from '@/stores/cart';
import type { DeliveryOrderDto } from '@/api/dto/deliveries';
import { useLinesPreview } from './useLinesPreview';

/** Everything a delivery changes: the order, its sale, stock (reservation and issue), the customer's account and till payments. */
export const DELIVERY_RESOURCES = ['delivery-orders', 'sales', 'stock', 'customers', 'mpesa-unmatched', 'dashboard', 'reports'];

export function DispatchDialog({ order, open, onOpenChange }: { order: DeliveryOrderDto; open: boolean; onOpenChange(o: boolean): void }) {
  const qc = useQueryClient();
  const [rider, setRider] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (open) {
      setRider('');
      setError(null);
    }
  }, [open]);

  async function submit() {
    if (!rider.trim()) return setError(new Error('Who is taking it? Enter the rider’s name.'));
    setPending(true);
    setError(null);
    try {
      await deliveryOrdersApi.dispatch(order.deliveryOrderId, rider.trim());
      await qc.invalidateQueries({ queryKey: ['delivery-orders'] });
      toast.success(`${order.orderNumber} is out with ${rider.trim()}`);
      onOpenChange(false);
    } catch (e) {
      setError(e);
      if (normaliseError(e).code === 'INVALID_ASSIGNMENT') void qc.invalidateQueries({ queryKey: ['delivery-orders'] });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Dispatch {order.orderNumber}</DialogTitle>
          <DialogDescription>To {order.customerName}, {order.deliveryAddress}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="rider">Rider</Label>
          <Input id="rider" autoFocus value={rider} maxLength={100} onChange={(e) => setRider(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Rider’s name" />
        </div>
        <FormAlert error={error} />
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={pending} onClick={submit}>Out for delivery</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const METHODS = [
  { value: PaymentMethod.Cash, icon: Banknote },
  { value: PaymentMethod.MpesaTill, icon: Smartphone },
  { value: PaymentMethod.Credit, icon: CreditCard },
] as const;

/** The order's lines as cart lines, so they can be priced and edited (one fewer container) before recording. */
function toLines(order: DeliveryOrderDto): CartLine[] {
  return order.lines.map((l) => ({
    key: l.deliveryOrderLineId,
    productId: l.productId,
    productName: l.productName,
    sku: l.sku,
    unitOfMeasureId: l.unitOfMeasureId,
    quantity: l.quantity,
    discountAmount: null,
    discountPercent: null,
    isBatchTracked: false,
    requiresPrescription: false,
    units: [{ unitOfMeasureId: l.unitOfMeasureId, symbol: l.unitSymbol ?? '' }],
  }));
}

/**
 * Recorded by the cashier when the rider is back: what was handed over, and how it was paid. Credit puts the sale on the customer's
 * account like any credit sale (managers only: DeliveryOrders.AcceptCredit).
 */
export function RecordDeliveryDialog({ order, open, onOpenChange }: { order: DeliveryOrderDto; open: boolean; onOpenChange(o: boolean): void }) {
  const qc = useQueryClient();
  const canCredit = usePermission('DeliveryOrders.AcceptCredit');
  const canOverride = usePermission('Sales.OverrideCreditLimit');
  const [lines, setLines] = useState<CartLine[]>(() => toLines(order));
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.Cash);
  const [tendered, setTendered] = useState('');
  const [tillTxId, setTillTxId] = useState<string | null>(null);
  const [override, setOverride] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!open) return;
    setLines(toLines(order));
    setMethod(PaymentMethod.Cash);
    setTendered('');
    setTillTxId(null);
    setOverride(false);
    setError(null);
  }, [open, order]);

  const preview = useLinesPreview(order.customerId, lines, method, open);
  const p = preview.data;
  const previewCurrent = !!p && !preview.isFetching && !preview.isPlaceholderData;
  const total = p?.totalAmount ?? null;
  const tenderedNum = Number(tendered);
  const change = total !== null && tendered !== '' && !Number.isNaN(tenderedNum) ? round2(tenderedNum - total) : null;
  const edited = lines.length !== order.lines.length || lines.some((l, i) => l.quantity !== order.lines[i]?.quantity);

  const setQty = (key: string, quantity: number) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, quantity } : l)));

  async function submit() {
    setError(null);
    if (lines.length === 0) return setError(new Error('Nothing was handed over? Cancel the order instead.'));
    if (lines.some((l) => !(l.quantity > 0))) return setError(new Error('Every line needs a quantity above zero, or remove it.'));
    if (total === null || !previewCurrent) return setError(new Error('Wait for the total to finish updating.'));
    if (method === PaymentMethod.Cash && (tendered === '' || Number.isNaN(tenderedNum) || tenderedNum < total)) {
      return setError(new Error(`The cash given must be at least ${formatMoney(total)}.`));
    }
    if (method === PaymentMethod.MpesaTill && !tillTxId) return setError(new Error('Select the customer’s M-Pesa payment.'));
    setPending(true);
    try {
      // No automatic retry: the API gives one sale per delivery, and a retry after a lost response is refused, not doubled.
      const done = await deliveryOrdersApi.deliver(order.deliveryOrderId, {
        paymentMethod: method,
        amountTendered: method === PaymentMethod.Cash ? tenderedNum : null,
        mpesaTransactionId: method === PaymentMethod.MpesaTill ? tillTxId : null,
        overrideCreditLimit: method === PaymentMethod.Credit && override,
        lines: edited ? lines.map((l) => ({ productId: l.productId, unitOfMeasureId: l.unitOfMeasureId, quantity: l.quantity })) : null,
      });
      await Promise.all(DELIVERY_RESOURCES.map((r) => qc.invalidateQueries({ queryKey: [r] })));
      toast.success(`${order.orderNumber} delivered: sale ${done.saleNumber ?? ''}${method === PaymentMethod.Credit ? `, charged to ${order.customerName}’s account` : ''}`);
      onOpenChange(false);
    } catch (e) {
      const apiError = normaliseError(e);
      setError(apiError);
      if (apiError.code === 'INVALID_ASSIGNMENT') {
        // Recorded (or cancelled) by someone else a moment ago, or the till payment was just taken: reload both.
        if (method === PaymentMethod.MpesaTill) setTillTxId(null);
        void qc.invalidateQueries({ queryKey: ['delivery-orders'] });
        void qc.invalidateQueries({ queryKey: ['mpesa-unmatched'] });
      }
    } finally {
      setPending(false);
    }
  }

  const methods = METHODS.filter((m) => m.value !== PaymentMethod.Credit || canCredit);
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Record delivery {order.orderNumber}</DialogTitle>
          <DialogDescription>{order.customerName} · by {order.riderName ?? '—'}. Change the lines if what was handed over differs.</DialogDescription>
        </DialogHeader>

        <ul className="divide-y rounded-md border">
          {lines.map((l, i) => {
            const pl = p?.lines[i]?.productId === l.productId ? p.lines[i] : undefined;
            return (
              <li key={l.key} className="flex items-center gap-2 p-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{l.productName} <span className="text-muted-foreground">({l.units[0]?.symbol})</span></span>
                <Input type="number" inputMode="decimal" min={0} step="any" value={l.quantity} onChange={(e) => setQty(l.key, Math.max(0, Number(e.target.value)))} className="h-8 w-20 text-center tabular" aria-label={`Quantity of ${l.productName}`} />
                <span className="w-24 text-right tabular">{pl ? formatMoney(pl.lineTotal) : '—'}</span>
                <Button variant="ghost" size="icon-sm" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label={`Remove ${l.productName}`}><X /></Button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">{edited ? 'Total for what was handed over' : 'Total'}</span>
          <span className={cn('text-2xl font-bold tabular', !previewCurrent && 'opacity-60')}>{total === null ? '—' : formatMoney(total)}</span>
        </div>
        {preview.error && <FormAlert error={preview.error} />}

        <div className={cn('grid gap-1.5', methods.length === 3 ? 'grid-cols-3' : 'grid-cols-2')} role="radiogroup" aria-label="Payment">
          {methods.map(({ value, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={method === value}
              onClick={() => { setMethod(value); setError(null); }}
              className={cn('flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-xs font-medium transition-colors', method === value ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent')}
            >
              <Icon className="size-4" />
              {value === PaymentMethod.Credit ? 'Pay later (account)' : labels.paymentMethod[value]}
            </button>
          ))}
        </div>

        {method === PaymentMethod.Cash && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="delivery-cash">Cash given</Label>
              <Input id="delivery-cash" type="number" inputMode="decimal" min={0} step="0.01" value={tendered} onChange={(e) => setTendered(e.target.value)} className="h-11 text-lg tabular" />
            </div>
            <div className="space-y-1.5">
              <Label>Change</Label>
              <p className={cn('flex h-11 items-center text-lg font-semibold tabular', change !== null && change < 0 ? 'text-destructive' : 'text-success')}>{change === null ? '—' : formatMoney(change)}</p>
            </div>
            {total !== null && <Button variant="outline" size="sm" className="col-span-2 justify-self-start" onClick={() => setTendered(String(total))}>Exact</Button>}
          </div>
        )}
        {method === PaymentMethod.MpesaTill && total !== null && <TillPayments total={total} value={tillTxId} onChange={setTillTxId} enabled={open} />}
        {method === PaymentMethod.Credit && p && (
          <div className="space-y-2 text-sm">
            <p>Charged to <span className="font-semibold">{order.customerName}</span>’s account, to be paid later.</p>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-3">
              <span className="text-muted-foreground">Owes now</span><span className="text-right tabular">{formatMoney(p.customerBalance ?? 0)}</span>
              <span className="text-muted-foreground">Credit limit</span><span className="text-right tabular">{p.creditLimit === null ? 'No limit' : formatMoney(p.creditLimit)}</span>
              <span className="text-muted-foreground">Owes after</span><span className="text-right font-semibold tabular">{formatMoney((p.customerBalance ?? 0) + p.totalAmount)}</span>
            </div>
            {p.creditLimitExceeded && (
              <Alert variant="warning">
                <AlertTriangle />
                <AlertTitle>Over the credit limit</AlertTitle>
                <AlertDescription>
                  {canOverride ? (
                    <label className="mt-1 flex items-center gap-2"><Checkbox checked={override} onCheckedChange={(v) => setOverride(v === true)} />Allow it this time</label>
                  ) : 'Ask a manager who can override the credit limit, or take cash or M-Pesa.'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <FormAlert error={error} />
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Back</Button>
          <Button
            variant="success"
            loading={pending}
            disabled={!previewCurrent || (method === PaymentMethod.Credit && !!p?.creditLimitExceeded && !override)}
            onClick={submit}
          >
            Delivered{total !== null ? ` · ${formatMoney(total)}` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "2 × 20L Water (refill), 1 × 20L Container" */
export function describeLines(order: Pick<DeliveryOrderDto, 'lines'>): string {
  return order.lines.map((l) => `${formatQty(l.quantity)} × ${l.unitSymbol ? `${l.unitSymbol} ` : ''}${l.productName}`).join(', ');
}
