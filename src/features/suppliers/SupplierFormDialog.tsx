'use client';

import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Input, Textarea } from '@/components/ui/primitives';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { suppliersApi } from '@/api/endpoints/inventory';
import { email, kraPin, optionalNumber, phone, requiredText, text } from '@/lib/schemas';
import { emptyToNull } from '@/lib/utils';
import type { SupplierDto } from '@/api/dto/inventory';

const schema = z.object({
  supplierName: requiredText('Name', 150),
  kraPin,
  contactPerson: text(100),
  phoneNumber: phone,
  email,
  physicalAddress: text(250),
  paymentTermDays: optionalNumber({ min: 0, max: 365, label: 'Payment terms' }),
});
type Values = z.infer<typeof schema>;

export function SupplierFormDialog({ open, onOpenChange, supplier, onSaved }: { open: boolean; onOpenChange(o: boolean): void; supplier?: SupplierDto | null; onSaved?(s: SupplierDto): void }) {
  const qc = useQueryClient();
  const editing = !!supplier;
  return (
    <FormDialog<Values>
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit ${supplier!.supplierName}` : 'New supplier'}
      size="lg"
      schema={schema}
      defaultValues={{
        supplierName: supplier?.supplierName ?? '',
        kraPin: supplier?.kraPin ?? '',
        contactPerson: supplier?.contactPerson ?? '',
        phoneNumber: supplier?.phoneNumber ?? '',
        email: supplier?.email ?? '',
        physicalAddress: supplier?.physicalAddress ?? '',
        paymentTermDays: supplier?.paymentTermDays ?? null,
      }}
      onSubmit={async (v) => {
        const body = {
          supplierName: v.supplierName,
          kraPin: emptyToNull(v.kraPin),
          contactPerson: emptyToNull(v.contactPerson),
          phoneNumber: emptyToNull(v.phoneNumber),
          email: emptyToNull(v.email),
          physicalAddress: emptyToNull(v.physicalAddress),
          paymentTermDays: v.paymentTermDays,
        };
        const saved = editing ? await suppliersApi.update(supplier!.supplierId, body) : await suppliersApi.create(body);
        await qc.invalidateQueries({ queryKey: ['suppliers'] });
        toast.success(editing ? 'Supplier updated' : `${saved.supplierName} added`);
        onSaved?.(saved);
      }}
    >
      {(form) => {
        const e = form.formState.errors;
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" required error={e.supplierName} className="sm:col-span-2"><Input autoFocus {...form.register('supplierName')} /></Field>
            <Field label="Phone" error={e.phoneNumber}><Input type="tel" {...form.register('phoneNumber')} /></Field>
            <Field label="Email" error={e.email}><Input type="email" {...form.register('email')} /></Field>
            <Field label="KRA PIN" error={e.kraPin}><Input className="uppercase" {...form.register('kraPin')} /></Field>
            <Field label="Contact person" error={e.contactPerson}><Input {...form.register('contactPerson')} /></Field>
            <Field label="Payment terms (days)" error={e.paymentTermDays} hint="e.g. 30 for net 30. Empty for cash on delivery.">
              <Input type="number" min={0} {...form.register('paymentTermDays', { valueAsNumber: true })} />
            </Field>
            <Field label="Address" error={e.physicalAddress} className="sm:col-span-2"><Textarea {...form.register('physicalAddress')} /></Field>
          </div>
        );
      }}
    </FormDialog>
  );
}
