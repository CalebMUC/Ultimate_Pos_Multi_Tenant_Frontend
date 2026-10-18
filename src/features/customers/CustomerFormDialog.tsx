'use client';

import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Input, NativeSelect, Textarea } from '@/components/ui/primitives';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { customersApi } from '@/api/endpoints/business';
import { enumOptions, labels, PriceType } from '@/api/enums';
import { email, kraPin, optionalNumber, phone, requiredText, text } from '@/lib/schemas';
import { emptyToNull } from '@/lib/utils';
import type { CustomerDto } from '@/api/dto/business';

const schema = z.object({
  customerName: requiredText('Name', 150),
  kraPin,
  contactPerson: text(100),
  phoneNumber: phone,
  email,
  physicalAddress: text(250),
  priceType: z.coerce.number().pipe(z.nativeEnum(PriceType)),
  creditLimit: optionalNumber({ min: 0, label: 'Credit limit' }),
});
type Values = z.infer<typeof schema>;

export function CustomerFormDialog({ open, onOpenChange, customer, onSaved }: {
  open: boolean;
  onOpenChange(o: boolean): void;
  customer?: CustomerDto | null;
  onSaved?(c: CustomerDto): void;
}) {
  const qc = useQueryClient();
  const editing = !!customer;
  return (
    <FormDialog<Values>
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit ${customer!.customerName}` : 'New customer'}
      schema={schema}
      size="lg"
      defaultValues={{
        customerName: customer?.customerName ?? '',
        kraPin: customer?.kraPin ?? '',
        contactPerson: customer?.contactPerson ?? '',
        phoneNumber: customer?.phoneNumber ?? '',
        email: customer?.email ?? '',
        physicalAddress: customer?.physicalAddress ?? '',
        priceType: customer?.priceType ?? PriceType.Retail,
        creditLimit: customer?.creditLimit ?? null,
      }}
      onSubmit={async (v) => {
        const body = {
          customerName: v.customerName,
          kraPin: emptyToNull(v.kraPin),
          contactPerson: emptyToNull(v.contactPerson),
          phoneNumber: emptyToNull(v.phoneNumber),
          email: emptyToNull(v.email),
          physicalAddress: emptyToNull(v.physicalAddress),
          priceType: v.priceType,
          creditLimit: v.creditLimit,
        };
        // Never send businessId: the token decides the business.
        const saved = editing ? await customersApi.update(customer!.customerId, body) : await customersApi.create(body);
        await qc.invalidateQueries({ queryKey: ['customers'] });
        toast.success(editing ? 'Customer updated' : `${saved.customerName} added`);
        onSaved?.(saved);
      }}
    >
      {(form) => {
        const e = form.formState.errors;
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" required error={e.customerName} className="sm:col-span-2"><Input autoFocus {...form.register('customerName')} /></Field>
            <Field label="Phone" error={e.phoneNumber}><Input type="tel" {...form.register('phoneNumber')} /></Field>
            <Field label="Email" error={e.email}><Input type="email" {...form.register('email')} /></Field>
            <Field label="KRA PIN" error={e.kraPin}><Input className="uppercase" {...form.register('kraPin')} /></Field>
            <Field label="Contact person" error={e.contactPerson}><Input {...form.register('contactPerson')} /></Field>
            <Field label="Price list" error={e.priceType} hint="Which prices this customer pays.">
              <NativeSelect {...form.register('priceType')}>
                {enumOptions(labels.priceType).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Credit limit (KES)" error={e.creditLimit} hint="Leave empty for no limit.">
              <Input type="number" step="0.01" min={0} {...form.register('creditLimit', { valueAsNumber: true })} />
            </Field>
            <Field label="Address" error={e.physicalAddress} className="sm:col-span-2"><Textarea {...form.register('physicalAddress')} /></Field>
          </div>
        );
      }}
    </FormDialog>
  );
}
