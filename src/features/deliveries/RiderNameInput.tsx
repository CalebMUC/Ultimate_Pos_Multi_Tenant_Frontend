'use client';

import { forwardRef, useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/primitives';
import { deliveryOrdersApi } from '@/api/endpoints/deliveries';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { addDays, todayIso } from '@/lib/format';

/** Riders are names, matched by the API without regard to case or surrounding spaces. */
export const riderKey = (name: string) => name.trim().toUpperCase();

/**
 * Rider names already used in the last 90 days, from the delivery summary, so "Peter" is not typed five different ways. Empty for users
 * who cannot see deliveries: they can still type a name.
 */
export function useRiderNames(): string[] {
  const key = useQueryKey();
  const canView = usePermission('DeliveryOrders.View');
  const today = todayIso();
  const from = addDays(today, -89);
  const q = useQuery({
    queryKey: key('delivery-orders', { riderNames: true, from, to: today }),
    queryFn: () => deliveryOrdersApi.summary(from, today),
    enabled: canView,
    staleTime: 5 * 60_000,
  });
  return (q.data?.byRider ?? []).map((r) => r.riderName).filter((n) => n.trim() !== '').sort((a, b) => a.localeCompare(b));
}

/** The name as already spelled on the board when it is the same rider ("peter " → "Peter"), else the trimmed name. */
export function knownRiderName(value: string, names: readonly string[]): string {
  const trimmed = value.trim();
  return names.find((n) => riderKey(n) === riderKey(trimmed)) ?? trimmed;
}

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string; onChange(value: string): void };

/** A free-text rider name that offers the names already used and snaps to their spelling when it leaves the box. */
export const RiderNameInput = forwardRef<HTMLInputElement, Props>(function RiderNameInput({ value, onChange, onBlur, ...props }, ref) {
  const names = useRiderNames();
  const listId = useId();
  return (
    <>
      <Input
        ref={ref}
        list={listId}
        autoComplete="off"
        maxLength={100}
        placeholder="Rider’s name"
        {...props}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          const known = knownRiderName(value, names);
          if (known !== value) onChange(known);
          onBlur?.(e);
        }}
      />
      <datalist id={listId}>
        {names.map((n) => <option key={n} value={n} />)}
      </datalist>
    </>
  );
});
