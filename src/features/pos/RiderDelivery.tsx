'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, Bike, CreditCard, Smartphone, Store } from 'lucide-react';
import { Card, Input, Label, NativeSelect, Textarea } from '@/components/ui/primitives';
import { customersApi } from '@/api/endpoints/business';
import { deliveryOrdersApi } from '@/api/endpoints/deliveries';
import { DeliveryMode, PaymentMethod } from '@/api/enums';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { addDays, todayIso } from '@/lib/format';
import { cn, emptyToNull } from '@/lib/utils';
import { emptyDelivery, useCartStore, type Cart, type DeliveryDraft } from '@/stores/cart';
import type { Guid } from '@/api/dto/common';
import type { CreateDeliveryOrderRequestDto } from '@/api/dto/deliveries';
import { RiderNameInput } from '@/features/deliveries/RiderNameInput';
import { paymentLabel } from '@/features/deliveries/DeliveryDialogs';
import { useDebouncedValue } from '@/hooks/useDebounce';

export const isRiderCart = (cart: Pick<Cart, 'deliveryMode'>) => cart.deliveryMode === DeliveryMode.Rider;

/** Changes the cart's delivery details only (the lines are untouched). */
export function patchDelivery(businessId: Guid, patch: Partial<DeliveryDraft> | ((d: DeliveryDraft) => Partial<DeliveryDraft>)) {
  useCartStore.getState().update(businessId, (cart) => {
    const current = cart.delivery ?? emptyDelivery();
    return { ...cart, delivery: { ...current, ...(typeof patch === 'function' ? patch(current) : patch) } };
  });
}

/**
 * The cart as a delivery order: no prices (the API prices it) and no discounts (orders carry none). With a rider it goes straight out,
 * on a new trip or the one chosen; without, it waits on the board for someone to dispatch it.
 */
export function toDeliveryOrderRequest(cart: Cart): CreateDeliveryOrderRequestDto {
  const d = cart.delivery ?? emptyDelivery();
  const rider = emptyToNull(d.riderName);
  return {
    customerId: cart.customerId!,
    deliveryAddress: d.address.trim(),
    contactPhone: emptyToNull(d.contactPhone),
    notes: emptyToNull(d.notes),
    lines: cart.lines.map((l) => ({ productId: l.productId, unitOfMeasureId: l.unitOfMeasureId, quantity: l.quantity })),
    bundles: cart.bundles?.length ? cart.bundles.map((b) => ({ productBundleId: b.productBundleId, quantity: b.quantity })) : null,
    expectedPaymentMethod: d.expectedPaymentMethod,
    ...(rider ? { riderName: rider, deliveryTripId: d.deliveryTripId } : {}),
  };
}

/** Why a rider cart can't be sent yet, beyond what a counter sale checks. */
export function riderBlockers(cart: Cart, needsRx: boolean): string[] {
  const d = cart.delivery ?? emptyDelivery();
  const out: string[] = [];
  if (!cart.customerId) out.push('A delivery needs a registered customer.');
  if (!d.address.trim()) out.push('Enter the delivery address.');
  if (needsRx) out.push('Prescription-only products cannot be ordered for delivery.');
  const discounted = !!cart.saleDiscountAmount || cart.lines.some((l) => l.discountAmount || l.discountPercent)
    || !!cart.bundles?.some((b) => b.discountAmount || b.discountPercent);
  if (discounted) out.push('Discounts are not carried on deliveries: remove them.');
  return out;
}

/** Counter (a sale now) or Rider (a delivery order, completed when the rider is back). */
export function DeliveryModeToggle({ value, onChange }: { value: DeliveryMode; onChange(v: DeliveryMode): void }) {
  const options = [
    { value: DeliveryMode.Counter, label: 'Counter', icon: Store },
    { value: DeliveryMode.Rider, label: 'Rider', icon: Bike },
  ];
  return (
    <div className="grid grid-cols-2 gap-1 rounded-md border p-0.5" role="radiogroup" aria-label="Delivery">
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn('flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors', value === v ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}
        >
          <Icon className="size-3.5" />{label}
        </button>
      ))}
    </div>
  );
}

const EXPECTED = [
  { value: PaymentMethod.Cash, icon: Banknote },
  { value: PaymentMethod.MpesaReference, icon: Smartphone },
  { value: PaymentMethod.MpesaTill, icon: Smartphone },
  { value: PaymentMethod.Credit, icon: CreditCard },
] as const;

/** How the customer will pay the rider. A guide for the rider, not a payment: nothing is tendered here. */
export function ExpectedPaymentPicker({ businessId, value }: { businessId: Guid; value: PaymentMethod }) {
  const canCredit = usePermission('DeliveryOrders.AcceptCredit');
  const methods = EXPECTED.filter((m) => m.value !== PaymentMethod.Credit || canCredit);
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Customer will pay the rider by</p>
      <div className={cn('grid gap-1.5', methods.length === 4 ? 'grid-cols-4' : 'grid-cols-3')} role="radiogroup" aria-label="Expected payment">
        {methods.map(({ value: v, icon: Icon }) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => patchDelivery(businessId, { expectedPaymentMethod: v })}
            className={cn('flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[11px] font-medium transition-colors', value === v ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent')}
          >
            <Icon className="size-4" />
            {v === PaymentMethod.Credit ? 'Pay later' : paymentLabel(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Where it goes and who takes it. The address is prefilled from the customer; the phone defaults to theirs. */
export function RiderDeliveryFields({ businessId, cart }: { businessId: Guid; cart: Cart }) {
  const qc = useQueryClient();
  const key = useQueryKey();
  const d = cart.delivery ?? emptyDelivery();
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);

  useEffect(() => {
    setCustomerPhone(null);
    const customerId = cart.customerId;
    if (!customerId) return;
    let live = true;
    qc.fetchQuery({ queryKey: key('customers', { detail: customerId }), queryFn: () => customersApi.get(customerId), staleTime: 60_000 })
      .then((c) => {
        if (!live) return;
        setCustomerPhone(c.phoneNumber);
        // Only into an empty box: never over what the cashier typed.
        if (c.physicalAddress) patchDelivery(businessId, (cur) => (cur.address.trim() ? {} : { address: c.physicalAddress! }));
      })
      .catch(() => undefined);
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.customerId, businessId]);

  const rider = useDebouncedValue(d.riderName.trim(), 300);
  const trips = useOpenTrips(rider);
  // A trip that came back (or is someone else's) since it was picked is no longer offered: start a new one.
  useEffect(() => {
    if (d.deliveryTripId && trips.data && !trips.data.some((t) => t.deliveryTripId === d.deliveryTripId)) patchDelivery(businessId, { deliveryTripId: null });
  }, [trips.data, d.deliveryTripId, businessId]);

  return (
    <Card className="m-3">
      <div className="space-y-2 p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold"><Bike className="size-4 text-primary" />Delivery by rider</p>
        <div className="space-y-1">
          <Label htmlFor="delivery-address" className="text-xs">Address *</Label>
          <Textarea id="delivery-address" value={d.address} maxLength={500} onChange={(e) => patchDelivery(businessId, { address: e.target.value })} placeholder="Estate, road, gate, landmark" className="min-h-[48px]" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="delivery-phone" className="text-xs">Phone on arrival</Label>
            <Input id="delivery-phone" type="tel" inputMode="tel" value={d.contactPhone} onChange={(e) => patchDelivery(businessId, { contactPhone: e.target.value })} placeholder={customerPhone ?? 'Customer’s phone'} className="h-8" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="delivery-rider" className="text-xs">Rider</Label>
            <RiderNameInput id="delivery-rider" value={d.riderName} onChange={(v) => patchDelivery(businessId, { riderName: v })} className="h-8" />
          </div>
        </div>
        {!d.riderName.trim() && <p className="text-xs text-muted-foreground">No rider: the order waits on the Deliveries board for someone to dispatch it.</p>}
        {!!trips.data?.length && (
          <div className="space-y-1">
            <Label htmlFor="delivery-trip" className="text-xs">Trip</Label>
            <NativeSelect id="delivery-trip" value={d.deliveryTripId ?? ''} onChange={(e) => patchDelivery(businessId, { deliveryTripId: e.target.value || null })} className="h-8">
              <option value="">New trip</option>
              {trips.data.map((t) => <option key={t.deliveryTripId} value={t.deliveryTripId}>Add to {t.tripNumber} ({t.outCount} still out)</option>)}
            </NativeSelect>
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="delivery-notes" className="text-xs">Notes</Label>
          <Input id="delivery-notes" value={d.notes} maxLength={1000} onChange={(e) => patchDelivery(businessId, { notes: e.target.value })} placeholder="e.g. call at the gate" className="h-8" />
        </div>
      </div>
    </Card>
  );
}

/** The rider's trips that are still out (from yesterday on), which a new order can join. */
function useOpenTrips(riderName: string) {
  const key = useQueryKey();
  const canView = usePermission('DeliveryOrders.View');
  const today = todayIso();
  const from = addDays(today, -1);
  return useQuery({
    queryKey: key('delivery-orders', { trips: true, from, to: today, riderName }),
    queryFn: () => deliveryOrdersApi.trips({ from, to: today, riderName }),
    enabled: canView && riderName.length > 0,
    select: (trips) => trips.filter((t) => !t.isBack),
    staleTime: 15_000,
  });
}
