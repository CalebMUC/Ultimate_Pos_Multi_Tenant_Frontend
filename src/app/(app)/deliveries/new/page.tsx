'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, CornerDownRight, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Input, NativeSelect, Textarea } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { MoneyText, PageHeader } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { CustomerPicker, ProductPicker } from '@/components/shared/Pickers';
import { EmptyState, FormAlert } from '@/components/shared/States';
import { productsApi } from '@/api/endpoints/catalog';
import { deliveryOrdersApi } from '@/api/endpoints/deliveries';
import { normaliseError } from '@/api/errors';
import { ItemType } from '@/api/enums';
import { useActiveBusiness, usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { formatQty } from '@/lib/format';
import { cn, emptyToNull } from '@/lib/utils';
import { CustomerFormDialog } from '@/features/customers/CustomerFormDialog';
import { addLine, withContainers } from '@/features/pos/cartActions';
import { ContainerToggle, QuickKeys } from '@/features/pos/QuickKeys';
import { useLinesPreview } from '@/features/deliveries/useLinesPreview';
import type { CartLine } from '@/stores/cart';
import type { CustomerDto } from '@/api/dto/business';

function NewDeliveryOrder() {
  const router = useRouter();
  const qc = useQueryClient();
  const key = useQueryKey();
  const { activeBusinessId, hasModule } = useActiveBusiness();
  const businessId = activeBusinessId!;
  const canRegister = usePermission('Customers.Register');
  const [customer, setCustomer] = useState<Pick<CustomerDto, 'customerId' | 'customerName'> | null>(null);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<CartLine[]>([]);
  const [needsContainer, setNeedsContainer] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const preview = useLinesPreview(customer?.customerId ?? null, lines);
  const p = preview.data;
  const previewCurrent = !!p && !preview.isFetching && !preview.isPlaceholderData && p.lines.length === lines.length;
  const short = previewCurrent ? p.lines.filter((l) => !l.stockSufficient) : [];

  // Every change goes through here so the container lines follow their refills, as in the POS cart.
  const change = (fn: (ls: CartLine[]) => CartLine[], needs = needsContainer) => setLines((ls) => withContainers(fn(ls), needs));

  function pickCustomer(c: CustomerDto | null) {
    setCustomer(c);
    if (c?.physicalAddress && !address.trim()) setAddress(c.physicalAddress);
    if (c?.phoneNumber && !phone.trim()) setPhone(c.phoneNumber);
  }

  async function add(productId: string, unitId?: string) {
    try {
      const detail = await qc.fetchQuery({ queryKey: key('products', { detail: productId }), queryFn: () => productsApi.get(productId), staleTime: 60_000 });
      change((ls) => addLine(ls, detail, 1, p?.priceType ?? null, unitId));
    } catch (e) {
      toast.error(normaliseError(e).message);
    }
  }

  async function save() {
    setError(null);
    if (!customer) return setError(new Error('Choose the customer, or register them first.'));
    if (!address.trim()) return setError(new Error('Where is it going? Enter the delivery address.'));
    if (lines.length === 0) return setError(new Error('Add what they ordered.'));
    if (lines.some((l) => !(l.quantity > 0))) return setError(new Error('Every line needs a quantity above zero.'));
    setSaving(true);
    try {
      const order = await deliveryOrdersApi.create({
        customerId: customer.customerId,
        deliveryAddress: address.trim(),
        contactPhone: emptyToNull(phone),
        notes: emptyToNull(notes),
        lines: lines.map((l) => ({ productId: l.productId, unitOfMeasureId: l.unitOfMeasureId, quantity: l.quantity })),
      });
      await Promise.all(['delivery-orders', 'stock'].map((r) => qc.invalidateQueries({ queryKey: [r] })));
      toast.success(`${order.orderNumber} taken for ${order.customerName}`);
      router.push('/deliveries');
    } catch (e) {
      // 409 INSUFFICIENT_STOCK names what is short; re-price so the lines show it.
      setError(e);
      if (normaliseError(e).code === 'INSUFFICIENT_STOCK') void qc.invalidateQueries({ queryKey: ['sale-preview'] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="New delivery order"
        description="The items are held for this order until it is delivered or cancelled."
        actions={<Button variant="ghost" asChild><Link href="/deliveries"><ArrowLeft />Deliveries</Link></Button>}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader><CardTitle>What they ordered</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {hasModule('containers') && <QuickKeys businessId={businessId} onAdd={(k) => add(k.productId, k.unitOfMeasureId)} />}
            <ProductPicker value={null} onChange={(id) => id && add(id)} filter={{ itemType: ItemType.FinishedGood }} placeholder="Add a product…" />
            {lines.length === 0 ? (
              <EmptyState title="Nothing added yet" message="Tap a quick key or pick a product." className="py-8" />
            ) : (
              <ul className={cn('divide-y rounded-md border', !previewCurrent && p && 'opacity-80')}>
                {lines.map((l, i) => {
                  const pl = p?.lines[i]?.productId === l.productId ? p.lines[i] : undefined;
                  if (l.containerFor) {
                    return (
                      <li key={l.key} className="flex items-center gap-2 p-2 pl-6 text-sm">
                        <CornerDownRight className="size-3.5 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{formatQty(l.quantity)} × {l.productName} <span className="text-xs text-muted-foreground">(container)</span></span>
                        {pl && <MoneyText value={pl.lineTotal} />}
                      </li>
                    );
                  }
                  return (
                    <li key={l.key} className="space-y-1 p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate font-medium">{l.productName}</span>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          value={l.quantity}
                          onChange={(e) => change((ls) => ls.map((x) => (x.key === l.key ? { ...x, quantity: Math.max(0, Number(e.target.value)) } : x)))}
                          className="h-8 w-20 text-center tabular"
                          aria-label={`Quantity of ${l.productName}`}
                        />
                        {l.units.length > 1 ? (
                          <NativeSelect value={l.unitOfMeasureId} onChange={(e) => change((ls) => ls.map((x) => (x.key === l.key ? { ...x, unitOfMeasureId: e.target.value } : x)))} className="h-8 w-24" aria-label="Unit">
                            {l.units.map((u) => <option key={u.unitOfMeasureId} value={u.unitOfMeasureId}>{u.symbol}</option>)}
                          </NativeSelect>
                        ) : <span className="w-24 text-xs text-muted-foreground">{l.units[0]?.symbol}</span>}
                        <span className="w-24 text-right">{pl ? <MoneyText value={pl.lineTotal} /> : '—'}</span>
                        <Button variant="ghost" size="icon-sm" onClick={() => change((ls) => ls.filter((x) => x.key !== l.key))} aria-label={`Remove ${l.productName}`}><X /></Button>
                      </div>
                      {pl && !pl.stockSufficient && (
                        <p className="flex items-center gap-1 text-xs text-destructive">
                          <AlertTriangle className="size-3.5" />Only {formatQty(Math.max(0, pl.availableInBaseUnits), l.units[0]?.symbol)} free (not held for other orders); needs {formatQty(pl.requiredInBaseUnits, l.units[0]?.symbol)}.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <ContainerToggle
              lines={lines}
              needsContainer={needsContainer}
              onChange={(needs) => {
                setNeedsContainer(needs);
                change((ls) => ls, needs);
              }}
            />
            {preview.error && <FormAlert error={preview.error} />}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Deliver to</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Field label="Customer" required hint="A delivery needs a registered customer.">
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <CustomerPicker value={customer?.customerId ?? null} selectedLabel={customer?.customerName} onChange={(_, c) => pickCustomer(c)} placeholder="Search name or phone…" />
                  </div>
                  {canRegister && (
                    <Button variant="outline" size="icon" onClick={() => setRegistering(true)} aria-label="Register new customer" title="Register new customer"><UserPlus /></Button>
                  )}
                </div>
              </Field>
              <Field label="Address" required><Textarea value={address} maxLength={300} onChange={(e) => setAddress(e.target.value)} placeholder="Estate, road, gate, landmark" /></Field>
              <Field label="Phone on arrival" hint="Leave empty to use the customer’s phone."><Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
              <Field label="Notes"><Input value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. after 5 pm" /></Field>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Estimated total</span>
                <span className="text-2xl font-bold tabular">{p && lines.length ? <MoneyText value={p.totalAmount} /> : '—'}</span>
              </div>
              <p className="text-xs text-muted-foreground">At this customer’s prices. Delivery is free. They pay when it arrives: cash, M-Pesa till or on account.</p>
              {short.length > 0 && <p className="text-xs text-destructive">Not enough stock for some lines.</p>}
              <FormAlert error={error} />
              <Button className="w-full" size="lg" loading={saving} disabled={short.length > 0} onClick={save}>Take order</Button>
            </CardContent>
          </Card>
        </div>
      </div>
      <CustomerFormDialog open={registering} onOpenChange={setRegistering} quick onSaved={(c) => pickCustomer(c)} />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="DeliveryOrders.Create" module="deliveries"><NewDeliveryOrder /></PermissionRoute>;
}
