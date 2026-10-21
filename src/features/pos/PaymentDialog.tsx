'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Banknote, CheckCircle2, CreditCard, Loader2, RefreshCw, Smartphone, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle, Badge, Input, Label } from '@/components/ui/primitives';
import { Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { FormAlert } from '@/components/shared/States';
import { mpesaApi, salesApi } from '@/api/endpoints/sales';
import { normaliseError } from '@/api/errors';
import { PaymentMethod, SaleStatus } from '@/api/enums';
import { useActiveBusiness, usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateTime, formatMoney } from '@/lib/format';
import { round2 } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';
import type { Cart } from '@/stores/cart';
import type { SaleDto, SalePreviewDto } from '@/api/dto/sales';
import { toSaleRequest, type PaymentDetails } from './cartActions';

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  cart: Cart;
  preview: SalePreviewDto;
  includePrescription: boolean;
  onOverrideCreditLimit(value: boolean): void;
  /** Called once the sale is Completed. */
  onCompleted(sale: SaleDto): void;
  /** An STK sale that failed (cart kept) or was left pending (cart cleared). */
  onAbandoned(sale: SaleDto): void;
}

/** Kenyan mobile numbers: 07…, 01…, 2547…, +2547… The API normalises; this only catches typos early. */
const PHONE = /^(?:\+?254|0)?[17]\d{8}$/;
/** M-Pesa confirmation codes: 10 letters and digits, e.g. SJK4H7LM2P. */
export const MPESA_REFERENCE = /^[A-Z0-9]{10}$/;
export const normaliseMpesaReference = (v: string) => v.replace(/\s/g, '').toUpperCase();

export function PaymentDialog(props: Props) {
  const { cart, preview, open } = props;
  const total = preview.totalAmount;
  const [tendered, setTendered] = useState('');
  const [phone, setPhone] = useState('');
  const [tillTxId, setTillTxId] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [uncertain, setUncertain] = useState(false);
  const [pendingSale, setPendingSale] = useState<SaleDto | null>(null);
  const quickAmounts = usePreferences((s) => s.quickCashAmounts);
  const canOverride = usePermission('Sales.OverrideCreditLimit');
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setTendered('');
      setTillTxId(null);
      setReference('');
      setError(null);
      setUncertain(false);
      setPendingSale(null);
    }
  }, [open]);

  const tenderedNum = Number(tendered);
  const change = tendered !== '' && !Number.isNaN(tenderedNum) ? round2(tenderedNum - total) : null;

  async function charge() {
    setError(null);
    const payment: PaymentDetails = {};
    if (cart.paymentMethod === PaymentMethod.Cash) {
      if (tendered === '' || Number.isNaN(tenderedNum) || tenderedNum < total) {
        setError(new Error(`Amount tendered must be at least ${formatMoney(total)}.`));
        return;
      }
      payment.amountTendered = tenderedNum;
    }
    if (cart.paymentMethod === PaymentMethod.MpesaStkPush) {
      if (!PHONE.test(phone.replace(/\s/g, ''))) {
        setError(new Error('Enter a valid Safaricom number, e.g. 0712 345 678.'));
        return;
      }
      payment.mpesaPhoneNumber = phone.replace(/\s/g, '');
    }
    if (cart.paymentMethod === PaymentMethod.MpesaTill) {
      if (!tillTxId) {
        setError(new Error('Select the customer’s M-Pesa payment.'));
        return;
      }
      payment.mpesaTransactionId = tillTxId;
    }
    if (cart.paymentMethod === PaymentMethod.MpesaReference) {
      if (!MPESA_REFERENCE.test(reference)) {
        setError(new Error('Enter the 10-character M-Pesa code from the customer’s SMS, e.g. SJK4H7LM2P.'));
        return;
      }
      payment.mpesaReference = reference;
    }
    setSubmitting(true);
    try {
      // No automatic retry: the API has no idempotency key, so a retry could record the sale twice.
      const sale = await salesApi.create(toSaleRequest(cart, payment, props.includePrescription));
      if (sale.status === SaleStatus.Pending) setPendingSale(sale);
      else props.onCompleted(sale);
    } catch (e) {
      const apiError = normaliseError(e);
      if (apiError.code === 'NETWORK_ERROR' || apiError.status >= 500) setUncertain(true);
      // Stock ran short since the preview (another counter sold it): re-price so the cart shows which lines are short. Cart kept.
      if (apiError.code === 'INSUFFICIENT_STOCK') {
        void qc.invalidateQueries({ queryKey: ['sale-preview'] });
        void qc.invalidateQueries({ queryKey: ['stock'] });
        void qc.invalidateQueries({ queryKey: ['product-bundles'] });
      }
      // A bundle deactivated or removed meanwhile: refresh the tiles so it disappears.
      if (cart.bundles?.length && (apiError.code === 'INVALID_ASSIGNMENT' || apiError.code === 'NOT_FOUND')) {
        void qc.invalidateQueries({ queryKey: ['product-bundles'] });
        void qc.invalidateQueries({ queryKey: ['sale-preview'] });
      }
      // The till payment was matched to another sale a moment ago: drop the choice and reload the list to pick again.
      if (apiError.code === 'INVALID_ASSIGNMENT' && cart.paymentMethod === PaymentMethod.MpesaTill) {
        setTillTxId(null);
        void qc.invalidateQueries({ queryKey: ['mpesa-unmatched'] });
      }
      setError(apiError);
    } finally {
      setSubmitting(false);
    }
  }

  if (pendingSale) {
    return (
      <Dialog open={open} onOpenChange={() => undefined}>
        <DialogContent size="sm" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()} aria-describedby={undefined}>
          <StkWaiting sale={pendingSale} onCompleted={props.onCompleted} onAbandoned={props.onAbandoned} />
        </DialogContent>
      </Dialog>
    );
  }

  const methodIcon = { [PaymentMethod.Cash]: Banknote, [PaymentMethod.Credit]: CreditCard, [PaymentMethod.MpesaTill]: Smartphone, [PaymentMethod.MpesaStkPush]: Smartphone, [PaymentMethod.MpesaReference]: Smartphone }[cart.paymentMethod];
  const MethodIcon = methodIcon;

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && props.onOpenChange(o)}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MethodIcon className="size-5" />Take payment</DialogTitle>
          <DialogDescription>
            Total due <span className="text-lg font-semibold text-foreground tabular">{formatMoney(total)}</span>
          </DialogDescription>
        </DialogHeader>

        {cart.paymentMethod === PaymentMethod.Cash && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tendered">Amount tendered</Label>
              <Input
                id="tendered"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                autoFocus
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && charge()}
                className="h-14 text-2xl tabular"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setTendered(String(total))}>Exact</Button>
              {quickAmounts.map((a) => (
                <Button key={a} variant="outline" size="sm" onClick={() => setTendered(String((Number(tendered) || 0) + a))}>+{a.toLocaleString()}</Button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setTendered('')}>Clear</Button>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
              <span className="text-sm font-medium">Change</span>
              <span className={`text-2xl font-semibold tabular ${change !== null && change < 0 ? 'text-destructive' : 'text-success'}`}>
                {change === null ? '—' : formatMoney(change)}
              </span>
            </div>
          </div>
        )}

        {cart.paymentMethod === PaymentMethod.Credit && (
          <div className="space-y-3 text-sm">
            <p>Charged to <span className="font-semibold">{cart.customerName}</span>’s account.</p>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-3">
              <span className="text-muted-foreground">Current balance</span>
              <span className="text-right tabular">{formatMoney(preview.customerBalance ?? 0)}</span>
              <span className="text-muted-foreground">Credit limit</span>
              <span className="text-right tabular">{preview.creditLimit === null ? 'No limit' : formatMoney(preview.creditLimit)}</span>
              <span className="text-muted-foreground">Balance after sale</span>
              <span className="text-right font-semibold tabular">{formatMoney((preview.customerBalance ?? 0) + total)}</span>
            </div>
            {preview.creditLimitExceeded && (
              <Alert variant="warning">
                <AlertTriangle />
                <AlertTitle>Credit limit exceeded</AlertTitle>
                <AlertDescription>
                  {canOverride ? (
                    <label className="mt-1 flex items-center gap-2">
                      <Checkbox checked={cart.overrideCreditLimit} onCheckedChange={(v) => props.onOverrideCreditLimit(v === true)} />
                      Override the limit for this sale
                    </label>
                  ) : (
                    'Ask a manager with permission to override the credit limit, or take another payment method.'
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {cart.paymentMethod === PaymentMethod.MpesaStkPush && (
          <div className="space-y-1.5">
            <Label htmlFor="stk-phone">Customer’s M-Pesa number</Label>
            <Input
              id="stk-phone"
              type="tel"
              inputMode="tel"
              autoFocus
              placeholder="07XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && charge()}
              className="h-12 text-lg"
            />
            <p className="text-xs text-muted-foreground">The customer gets a prompt on their phone to enter their M-Pesa PIN.</p>
          </div>
        )}

        {cart.paymentMethod === PaymentMethod.MpesaTill && <TillPayments total={total} value={tillTxId} onChange={setTillTxId} enabled={open} />}

        {cart.paymentMethod === PaymentMethod.MpesaReference && <MpesaReferenceEntry total={total} value={reference} onChange={setReference} onSubmit={charge} />}

        {uncertain && (
          <Alert variant="warning">
            <AlertTriangle />
            <AlertTitle>The sale may have been recorded</AlertTitle>
            <AlertDescription>
              The connection failed after the sale was sent. Check the Sales list for it before charging again, so the customer is not charged twice.
            </AlertDescription>
          </Alert>
        )}
        <FormAlert error={uncertain ? null : error} />

        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={() => props.onOpenChange(false)}>Back</Button>
          <Button
            size="lg"
            variant="success"
            loading={submitting}
            disabled={preview.creditLimitExceeded && cart.paymentMethod === PaymentMethod.Credit && !cart.overrideCreditLimit}
            onClick={charge}
          >
            {cart.paymentMethod === PaymentMethod.MpesaStkPush ? 'Send payment prompt' : `Complete sale · ${formatMoney(total)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Unmatched till payments whose amount equals the sale total. */
export function TillPayments({ total, value, onChange, enabled }: { total: number; value: string | null; onChange(id: string | null): void; enabled: boolean }) {
  const key = useQueryKey();
  const query = useQuery({ queryKey: key('mpesa-unmatched'), queryFn: () => mpesaApi.unmatched(), enabled, refetchInterval: enabled ? 5000 : false });
  const all = query.data ?? [];
  const matching = all.filter((t) => round2(t.amount) === round2(total));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Payments to the till for {formatMoney(total)}</Label>
        <Button variant="ghost" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={query.isFetching ? 'animate-spin' : ''} />Refresh
        </Button>
      </div>
      {query.error ? (
        <FormAlert error={query.error} />
      ) : matching.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          {query.isLoading ? 'Loading…' : 'No matching payment yet. Ask the customer to pay to the till; this list refreshes every few seconds.'}
        </p>
      ) : (
        <ul className="max-h-60 space-y-1.5 overflow-y-auto">
          {matching.map((t) => (
            <li key={t.mpesaTransactionId}>
              <button
                type="button"
                onClick={() => onChange(t.mpesaTransactionId)}
                className={`flex w-full items-center justify-between rounded-md border p-3 text-left text-sm ${value === t.mpesaTransactionId ? 'border-primary bg-primary/5' : 'hover:bg-accent'}`}
              >
                <span>
                  <span className="font-medium">{t.mpesaReceiptNumber ?? '—'}</span>
                  <span className="block text-xs text-muted-foreground">{t.phoneNumber} · {formatDateTime(t.transactionDate)}{t.kraBranchId ? ` · ${t.kraBranchId} till` : ''}</span>
                </span>
                <span className="font-semibold tabular">{formatMoney(t.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {all.length > matching.length && <p className="text-xs text-muted-foreground">{all.length - matching.length} other unmatched payment(s) have a different amount.</p>}
    </div>
  );
}

/** Paid by M-Pesa outside the POS: where the customer pays, and the code from their confirmation SMS. Until till payments reach the POS. */
export function MpesaReferenceEntry({ total, value, onChange, onSubmit }: { total: number; value: string; onChange(v: string): void; onSubmit(): void }) {
  const { business } = useActiveBusiness();
  const payTo = [
    { label: 'Send money to', value: business?.phoneNumber },
    { label: 'Buy goods till', value: business?.mpesaTillNumber },
    { label: 'Paybill', value: business?.mpesaPaybillNumber },
  ].filter((d) => d.value);
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-muted p-3 text-sm">
        <p>Ask the customer to pay <span className="font-semibold tabular">{formatMoney(total)}</span> by M-Pesa{payTo.length ? ':' : ' to the business.'}</p>
        {payTo.length > 0 && (
          <dl className="mt-2 grid grid-cols-2 gap-1">
            {payTo.map((d) => (
              <div key={d.label} className="contents">
                <dt className="text-muted-foreground">{d.label}</dt>
                <dd className="text-right font-semibold tabular">{d.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mpesa-reference">M-Pesa code</Label>
        <Input
          id="mpesa-reference"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="SJK4H7LM2P"
          value={value}
          onChange={(e) => onChange(normaliseMpesaReference(e.target.value))}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          className="h-12 font-mono text-lg uppercase tracking-widest"
        />
        <p className="text-xs text-muted-foreground">From the M-Pesa confirmation SMS. Check the amount and that the business received it before completing.</p>
      </div>
    </div>
  );
}

/** Waits for the STK result: polls the sale, and lets the cashier ask M-Pesa directly (reconcile). */
function StkWaiting({ sale: initial, onCompleted, onAbandoned }: { sale: SaleDto; onCompleted(s: SaleDto): void; onAbandoned(s: SaleDto): void }) {
  const timeoutSeconds = usePreferences((s) => s.stkTimeoutSeconds);
  const [sale, setSale] = useState(initial);
  const [elapsed, setElapsed] = useState(0);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const done = useRef(false);

  const settle = (s: SaleDto) => {
    setSale(s);
    if (s.status === SaleStatus.Completed && !done.current) {
      done.current = true;
      onCompleted(s);
    }
  };

  useEffect(() => {
    if (sale.status !== SaleStatus.Pending) return;
    const tick = setInterval(() => setElapsed((e) => e + 1), 1000);
    const poll = setInterval(async () => {
      try {
        settle(await salesApi.get(initial.saleId));
      } catch {
        // Keep polling through blips.
      }
    }, 3000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sale.status, initial.saleId]);

  async function reconcile() {
    setChecking(true);
    setError(null);
    try {
      settle(await salesApi.reconcileMpesa(initial.saleId));
    } catch (e) {
      setError(e);
    } finally {
      setChecking(false);
    }
  }

  const timedOut = elapsed >= timeoutSeconds;

  if (sale.status === SaleStatus.Failed) {
    return (
      <div className="space-y-4 text-center">
        <XCircle className="mx-auto size-12 text-destructive" />
        <DialogTitle>Payment failed</DialogTitle>
        <p className="text-sm text-muted-foreground">
          Sale {sale.saleNumber} was not paid{sale.notes ? `: ${sale.notes}` : '.'} The cart is kept so you can try again or take another payment method.
        </p>
        <Button className="w-full" onClick={() => onAbandoned(sale)}>Back to cart</Button>
      </div>
    );
  }

  if (sale.status === SaleStatus.Completed) {
    return (
      <div className="space-y-3 text-center">
        <CheckCircle2 className="mx-auto size-12 text-success" />
        <DialogTitle>Payment received</DialogTitle>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DialogTitle className="text-center">Waiting for the customer</DialogTitle>
      <div className="flex flex-col items-center gap-2 text-center">
        <Loader2 className="size-12 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">A payment prompt for <span className="font-semibold text-foreground">{formatMoney(sale.totalAmount)}</span> was sent. Ask the customer to enter their M-Pesa PIN.</p>
        <Badge variant="warning">Sale {sale.saleNumber} · Pending · {elapsed}s</Badge>
      </div>
      {timedOut && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>No answer yet</AlertTitle>
          <AlertDescription>Check with M-Pesa. If the customer never paid, the sale stays Pending and can be checked later from the Sales list.</AlertDescription>
        </Alert>
      )}
      <FormAlert error={error} />
      <div className="flex flex-col gap-2">
        <Button variant="outline" loading={checking} onClick={reconcile}><RefreshCw />Check with M-Pesa</Button>
        {timedOut && <Button variant="ghost" onClick={() => onAbandoned(sale)}>Leave pending and start a new sale</Button>}
      </div>
    </div>
  );
}
