'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Pencil, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/primitives';
import { customersApi } from '@/api/endpoints/business';
import { normaliseError } from '@/api/errors';
import { usePermission } from '@/hooks/useSessionInfo';
import { phone } from '@/lib/schemas';
import type { CustomerDto } from '@/api/dto/business';

/**
 * The Phone column of the customers list, editable where it is: add or change a number without opening the customer. The API replaces the
 * whole customer, so everything else is sent back as it is. Clicks inside never open the row. Only with Customers.Update.
 */
export function PhoneCell({ customer: c }: { customer: CustomerDto }) {
  const canEdit = usePermission('Customers.Update');
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const open = () => { setValue(c.phoneNumber ?? ''); setError(null); setEditing(true); };
  const cancel = () => { setEditing(false); setError(null); };

  async function save() {
    const checked = phone.safeParse(value);
    if (!checked.success) return setError(checked.error.issues[0]?.message ?? 'Enter a valid phone number.');
    const next = checked.data === '' ? null : checked.data;
    if (next === (c.phoneNumber ?? null)) return cancel();
    setSaving(true);
    try {
      await customersApi.update(c.customerId, {
        customerName: c.customerName, kraPin: c.kraPin, contactPerson: c.contactPerson, phoneNumber: next, email: c.email,
        physicalAddress: c.physicalAddress, priceType: c.priceType, creditLimit: c.creditLimit,
      });
      await qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success(next ? `${c.customerName}’s phone saved` : `${c.customerName}’s phone removed`);
      setEditing(false);
    } catch (e) {
      const err = normaliseError(e);
      setError(err.fieldErrors.phoneNumber?.join(' ') || err.message || 'Could not save the phone number.');
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    if (!canEdit) return <>{c.phoneNumber ?? '—'}</>;
    return (
      <span className="group flex items-center gap-1">
        {c.phoneNumber ? <span className="whitespace-nowrap">{c.phoneNumber}</span> : null}
        <Button
          variant="ghost"
          size="icon-sm"
          className={c.phoneNumber ? 'opacity-60 group-hover:opacity-100 focus-visible:opacity-100' : 'w-auto px-2 text-muted-foreground'}
          onClick={(e) => { e.stopPropagation(); open(); }}
          aria-label={c.phoneNumber ? `Edit ${c.customerName}’s phone` : `Add ${c.customerName}’s phone`}
          title={c.phoneNumber ? 'Edit phone' : 'Add phone'}
        >
          {c.phoneNumber ? <Pencil /> : <><Plus />Add</>}
        </Button>
      </span>
    );
  }

  return (
    // Inside a clickable row: nothing here may open the customer.
    <div className="min-w-[13rem] space-y-1" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1">
        <Input
          type="tel"
          inputMode="tel"
          autoFocus
          value={value}
          placeholder="07XX XXX XXX"
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); void save(); }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
          }}
          disabled={saving}
          className="h-8 w-36"
          aria-label={`Phone for ${c.customerName}`}
          aria-invalid={!!error}
        />
        <Button size="icon-sm" variant="ghost" loading={saving} onClick={() => void save()} aria-label="Save phone"><Check /></Button>
        <Button size="icon-sm" variant="ghost" disabled={saving} onClick={cancel} aria-label="Cancel"><X /></Button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
