'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Banknote, Boxes, CreditCard, Minus, Plus, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { Alert, AlertDescription, AlertTitle, Input, Label, Textarea } from '@/components/ui/primitives';
import { FormAlert } from '@/components/shared/States';
import { deliveryOrdersApi } from '@/api/endpoints/deliveries';
import { normaliseError } from '@/api/errors';
import { PaymentMethod, labels } from '@/api/enums';
import { usePermission } from '@/hooks/useSessionInfo';
import { formatMoney, formatQty } from '@/lib/format';
import { cn, round2 } from '@/lib/utils';
import { MPESA_REFERENCE, MpesaReferenceEntry, TillPayments } from '@/features/pos/PaymentDialog';
import { bundlePreview } from '@/features/pos/bundles';
import type { CartBundle, CartLine } from '@/stores/cart';
import type { DeliveryOrderDto, DeliveryOrderLineDto } from '@/api/dto/deliveries';
import { useLinesPreview } from './useLinesPreview';
import { RiderNameInput } from './RiderNameInput';

/** Everything a delivery changes: the order, its sale, stock (reservation and issue), the customer's account, till payments and the drawer. */
export const DELIVERY_RESOURCES = ['delivery-orders', 'sales', 'stock', 'customers', 'mpesa-unmatched', 'dashboard', 'reports', 'cash-sessions'];

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
          <RiderNameInput id="rider" autoFocus value={rider} onChange={setRider} onKeyDown={(e) => e.key === 'Enter' && submit()} />
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

/** Several pending orders out with one rider: one trip (POST /delivery-orders/trips). */
export function SendTogetherDialog({ orders, open, onOpenChange, onSent }: {
  orders: DeliveryOrderDto[];
  open: boolean;
  onOpenChange(o: boolean): void;
  onSent?(): void;
}) {
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
    if (!rider.trim()) return setError(new Error('Who is taking them? Enter the rider’s name.'));
    setPending(true);
    setError(null);
    try {
      const trip = await deliveryOrdersApi.dispatchTrip({ riderName: rider.trim(), deliveryOrderIds: orders.map((o) => o.deliveryOrderId) });
      await qc.invalidateQueries({ queryKey: ['delivery-orders'] });
      toast.success(`${trip.tripNumber}: ${trip.orderCount} order(s) out with ${trip.riderName}`);
      onSent?.();
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
          <DialogTitle>Send {orders.length} order(s) together</DialogTitle>
          <DialogDescription>One trip for one rider.</DialogDescription>
        </DialogHeader>
        <ul className="max-h-48 divide-y overflow-y-auto rounded-md border text-sm">
          {orders.map((o) => (
            <li key={o.deliveryOrderId} className="p-2">
              <span className="font-medium">{o.orderNumber}</span> · {o.customerName}
              <span className="block truncate text-xs text-muted-foreground">{o.deliveryAddress}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-1.5">
          <Label htmlFor="trip-rider">Rider</Label>
          <RiderNameInput id="trip-rider" autoFocus value={rider} onChange={setRider} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </div>
        <FormAlert error={error} />
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={pending} onClick={submit}>Send together</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const RETURN_REASONS = ['Customer not home', 'Refused', 'Wrong address'] as const;
const OTHER = 'Other';

/** The rider brought it back undelivered. Nothing had left stock: the reservation is released and no sale is made. */
export function ReturnDeliveryDialog({ order, open, onOpenChange }: { order: DeliveryOrderDto; open: boolean; onOpenChange(o: boolean): void }) {
  const qc = useQueryClient();
  const [choice, setChoice] = useState<string>(RETURN_REASONS[0]);
  const [other, setOther] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (open) {
      setChoice(RETURN_REASONS[0]);
      setOther('');
      setError(null);
    }
  }, [open]);

  async function submit() {
    const reason = choice === OTHER ? other.trim() : choice;
    if (!reason) return setError(new Error('Why did it come back? Give a reason.'));
    setPending(true);
    setError(null);
    try {
      await deliveryOrdersApi.return(order.deliveryOrderId, reason);
      toast.success(`${order.orderNumber} marked returned`);
      onOpenChange(false);
    } catch (e) {
      setError(e);
    } finally {
      // Returned now, or recorded by someone else meanwhile: either way the board and the stock are out of date.
      void qc.invalidateQueries({ queryKey: ['delivery-orders'] });
      void qc.invalidateQueries({ queryKey: ['stock'] });
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{order.orderNumber} came back</DialogTitle>
          <DialogDescription>No sale is made. The water and containers held for it become available again.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2" role="radiogroup" aria-label="Reason">
          {[...RETURN_REASONS, OTHER].map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input type="radio" name="return-reason" value={r} checked={choice === r} onChange={() => setChoice(r)} className="accent-primary" />
              {r === OTHER ? 'Other…' : r}
            </label>
          ))}
          {choice === OTHER && (
            <Textarea aria-label="Other reason" autoFocus value={other} maxLength={1000} onChange={(e) => setOther(e.target.value)} placeholder="What happened?" />
          )}
        </div>
        <FormAlert error={error} />
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Back</Button>
          <Button variant="destructive" loading={pending} onClick={submit}>Mark returned</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const METHODS = [
  { value: PaymentMethod.Cash, icon: Banknote },
  { value: PaymentMethod.MpesaReference, icon: Smartphone },
  { value: PaymentMethod.MpesaTill, icon: Smartphone },
  { value: PaymentMethod.Credit, icon: CreditCard },
] as const;

/** The order's plain lines as cart lines, so they can be priced and edited (one fewer container) before recording. */
function toLines(order: DeliveryOrderDto): CartLine[] {
  return order.lines.filter((l) => !l.productBundleId).map((l) => ({
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

/** The order's bundles: their parts share a productBundleId, and bundleQuantity is how many bundles. */
function toBundles(order: DeliveryOrderDto): CartBundle[] {
  return groupBundleLines(order.lines).map((b) => ({
    productBundleId: b.productBundleId, name: b.name, code: null, quantity: b.quantity, discountAmount: null, discountPercent: null,
  }));
}

function groupBundleLines(lines: DeliveryOrderLineDto[]): { productBundleId: string; name: string; quantity: number }[] {
  const out: { productBundleId: string; name: string; quantity: number }[] = [];
  for (const l of lines) {
    if (!l.productBundleId || out.some((b) => b.productBundleId === l.productBundleId)) continue;
    out.push({ productBundleId: l.productBundleId, name: l.bundleName ?? l.productName, quantity: l.bundleQuantity ?? 1 });
  }
  return out;
}

/** How the rider was told the customer would pay, for preselecting: Credit only for those who may accept it. */
function expectedMethod(order: DeliveryOrderDto, canCredit: boolean): PaymentMethod {
  const m = order.expectedPaymentMethod;
  if (m === PaymentMethod.MpesaReference || m === PaymentMethod.MpesaTill) return m;
  if (m === PaymentMethod.Credit && canCredit) return m;
  return PaymentMethod.Cash;
}

/**
 * Completes the sale when the rider is back: what was handed over, and how it was paid. Paid by M-Pesa code, the code the rider brought
 * back is required. Credit puts the sale on the customer's account like any credit sale (managers only: DeliveryOrders.AcceptCredit).
 */
export function RecordDeliveryDialog({ order, open, onOpenChange }: { order: DeliveryOrderDto; open: boolean; onOpenChange(o: boolean): void }) {
  const qc = useQueryClient();
  const canCredit = usePermission('DeliveryOrders.AcceptCredit');
  const canOverride = usePermission('Sales.OverrideCreditLimit');
  const [lines, setLines] = useState<CartLine[]>(() => toLines(order));
  const [bundles, setBundles] = useState<CartBundle[]>(() => toBundles(order));
  const [method, setMethod] = useState<PaymentMethod>(() => expectedMethod(order, canCredit));
  const [tendered, setTendered] = useState('');
  const [tillTxId, setTillTxId] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [override, setOverride] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!open) return;
    setLines(toLines(order));
    setBundles(toBundles(order));
    setMethod(expectedMethod(order, canCredit));
    setTendered('');
    setTillTxId(null);
    setReference('');
    setOverride(false);
    setError(null);
  }, [open, order, canCredit]);

  const preview = useLinesPreview(order.customerId, lines, method, open, bundles);
  const p = preview.data;
  const previewCurrent = !!p && !preview.isFetching && !preview.isPlaceholderData;
  const plainLines = p?.lines.filter((l) => !l.productBundleId) ?? [];
  const total = p?.totalAmount ?? null;
  const tenderedNum = Number(tendered);
  const change = total !== null && tendered !== '' && !Number.isNaN(tenderedNum) ? round2(tenderedNum - total) : null;
  const originalLines = toLines(order);
  const originalBundles = toBundles(order);
  const edited = lines.length !== originalLines.length || lines.some((l, i) => l.quantity !== originalLines[i]?.quantity)
    || bundles.length !== originalBundles.length || bundles.some((b, i) => b.quantity !== originalBundles[i]?.quantity);

  const setQty = (key: string, quantity: number) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, quantity } : l)));
  const setBundleQty = (id: string, quantity: number) =>
    setBundles((bs) => bs.map((b) => (b.productBundleId === id ? { ...b, quantity: Math.max(1, Math.floor(quantity) || 1) } : b)));

  async function submit() {
    setError(null);
    if (lines.length === 0 && bundles.length === 0) return setError(new Error('Nothing was handed over? Mark it returned instead.'));
    if (lines.some((l) => !(l.quantity > 0))) return setError(new Error('Every line needs a quantity above zero, or remove it.'));
    if (method === PaymentMethod.MpesaReference && !reference.trim()) return setError(new Error('Enter the M-Pesa code the rider brought back.'));
    if (method === PaymentMethod.MpesaReference && !MPESA_REFERENCE.test(reference)) {
      return setError(new Error('Enter the 10-character M-Pesa code from the customer’s SMS, e.g. SJK4H7LM2P.'));
    }
    if (total === null || !previewCurrent) return setError(new Error('Wait for the total to finish updating.'));
    if (method === PaymentMethod.Cash && (tendered === '' || Number.isNaN(tenderedNum) || tenderedNum < total)) {
      return setError(new Error(`The cash handed in must be at least ${formatMoney(total)}.`));
    }
    if (method === PaymentMethod.MpesaTill && !tillTxId) return setError(new Error('Select the customer’s M-Pesa payment.'));
    setPending(true);
    try {
      // No automatic retry: the API gives one sale per delivery, and a retry after a lost response is refused, not doubled.
      const done = await deliveryOrdersApi.deliver(order.deliveryOrderId, {
        paymentMethod: method,
        amountTendered: method === PaymentMethod.Cash ? tenderedNum : null,
        mpesaTransactionId: method === PaymentMethod.MpesaTill ? tillTxId : null,
        mpesaReference: method === PaymentMethod.MpesaReference ? reference : null,
        overrideCreditLimit: method === PaymentMethod.Credit && override,
        // Leaving both out keeps the order as it was.
        ...(edited
          ? {
              lines: lines.map((l) => ({ productId: l.productId, unitOfMeasureId: l.unitOfMeasureId, quantity: l.quantity })),
              bundles: bundles.map((b) => ({ productBundleId: b.productBundleId, quantity: b.quantity })),
            }
          : {}),
      });
      await Promise.all(DELIVERY_RESOURCES.map((r) => qc.invalidateQueries({ queryKey: [r] })));
      toast.success(`${order.orderNumber} completed: sale ${done.saleNumber ?? ''}${method === PaymentMethod.Credit ? `, charged to ${order.customerName}’s account` : ''}`);
      onOpenChange(false);
    } catch (e) {
      const apiError = normaliseError(e);
      setError(apiError);
      if (apiError.code === 'INVALID_ASSIGNMENT') {
        // Recorded (or returned) by someone else a moment ago, or the till payment was just taken: reload both.
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
          <DialogTitle>Complete sale {order.orderNumber}</DialogTitle>
          <DialogDescription>
            {order.customerName} · by {order.riderName ?? '—'}
            {order.expectedPaymentMethod != null && <> · expected {paymentLabel(order.expectedPaymentMethod)}</>}
            . Change the lines if what was handed over differs.
          </DialogDescription>
        </DialogHeader>

        <ul className="divide-y rounded-md border">
          {lines.map((l, i) => {
            const pl = plainLines[i]?.productId === l.productId ? plainLines[i] : undefined;
            return (
              <li key={l.key} className="flex items-center gap-2 p-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{l.productName} <span className="text-muted-foreground">({l.units[0]?.symbol})</span></span>
                <Input type="number" inputMode="decimal" min={0} step="any" value={l.quantity} onChange={(e) => setQty(l.key, Math.max(0, Number(e.target.value)))} className="h-8 w-20 text-center tabular" aria-label={`Quantity of ${l.productName}`} />
                <span className="w-24 text-right tabular">{pl ? formatMoney(pl.lineTotal) : '—'}</span>
                <Button variant="ghost" size="icon-sm" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label={`Remove ${l.productName}`}><X /></Button>
              </li>
            );
          })}
          {bundles.map((b) => {
            const { summary } = bundlePreview(p, b.productBundleId);
            return (
              <li key={b.productBundleId} className="flex items-center gap-2 p-2 text-sm">
                <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate"><Boxes className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />{b.name}</span>
                <div className="flex items-center">
                  <Button variant="ghost" size="icon-sm" onClick={() => setBundleQty(b.productBundleId, b.quantity - 1)} aria-label={`Fewer ${b.name}`}><Minus /></Button>
                  <Input type="number" inputMode="numeric" min={1} step={1} value={b.quantity} onChange={(e) => setBundleQty(b.productBundleId, Number(e.target.value))} className="h-8 w-14 text-center tabular" aria-label={`Quantity of ${b.name}`} />
                  <Button variant="ghost" size="icon-sm" onClick={() => setBundleQty(b.productBundleId, b.quantity + 1)} aria-label={`More ${b.name}`}><Plus /></Button>
                </div>
                <span className="w-24 text-right tabular">{summary ? formatMoney(summary.total) : '—'}</span>
                <Button variant="ghost" size="icon-sm" onClick={() => setBundles((bs) => bs.filter((x) => x.productBundleId !== b.productBundleId))} aria-label={`Remove ${b.name}`}><X /></Button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">{edited ? 'Total for what was handed over' : 'Total'}</span>
          <span className={cn('text-2xl font-bold tabular', !previewCurrent && 'opacity-60')}>{total === null ? '—' : formatMoney(total)}</span>
        </div>
        {preview.error && <FormAlert error={preview.error} />}

        <div className={cn('grid gap-1.5', methods.length === 4 ? 'grid-cols-4' : 'grid-cols-3')} role="radiogroup" aria-label="Payment">
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
              {paymentLabel(value)}
            </button>
          ))}
        </div>

        {method === PaymentMethod.Cash && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="delivery-cash">Cash handed in</Label>
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
        {method === PaymentMethod.MpesaReference && <MpesaReferenceEntry total={total ?? order.estimatedTotal} value={reference} onChange={setReference} onSubmit={submit} />}
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
            Complete sale{total !== null ? ` · ${formatMoney(total)}` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** How a delivery is paid, in the words used at the counter. */
export function paymentLabel(method: PaymentMethod): string {
  return method === PaymentMethod.Credit ? 'Pay later (account)' : labels.paymentMethod[method];
}

/** "2 × 20L Water (refill), 1 × 20L bottle + water": a bundle is one item, its parts are not listed. */
export function describeLines(order: Pick<DeliveryOrderDto, 'lines'>): string {
  const plain = order.lines.filter((l) => !l.productBundleId).map((l) => `${formatQty(l.quantity)} × ${l.unitSymbol ? `${l.unitSymbol} ` : ''}${l.productName}`);
  const bundled = groupBundleLines(order.lines).map((b) => `${formatQty(b.quantity)} × ${b.name}`);
  return [...plain, ...bundled].join(', ');
}
