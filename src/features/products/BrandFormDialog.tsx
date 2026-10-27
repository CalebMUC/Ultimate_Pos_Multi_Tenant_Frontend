'use client';

import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Input } from '@/components/ui/primitives';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { brandsApi } from '@/api/endpoints/catalog';
import { requiredText } from '@/lib/schemas';
import type { BrandDto } from '@/api/dto/catalog';

const schema = z.object({ name: requiredText('Name', 100) });
type Values = z.infer<typeof schema>;

/** Create a brand, or rename one when given. Names are unique ignoring case; the API's 400 shows under the field. */
export function BrandFormDialog({ open, onOpenChange, brand, initialName, onSaved }: {
  open: boolean;
  onOpenChange(o: boolean): void;
  brand?: BrandDto | null;
  initialName?: string;
  onSaved?(b: BrandDto): void;
}) {
  const qc = useQueryClient();
  return (
    <FormDialog<Values>
      open={open}
      onOpenChange={onOpenChange}
      title={brand ? `Rename ${brand.name}` : 'New brand'}
      description={brand ? 'The new name shows on every product with this brand. Product names don’t change.' : undefined}
      size="sm"
      schema={schema}
      defaultValues={{ name: brand?.name ?? initialName ?? '' }}
      onSubmit={async (v) => {
        const saved = brand ? await brandsApi.update(brand.brandId, v) : await brandsApi.create(v);
        await qc.invalidateQueries({ queryKey: ['brands'] });
        // Product rows carry the brand name.
        if (brand) await qc.invalidateQueries({ queryKey: ['products'] });
        toast.success(brand ? 'Brand renamed' : `${saved.name} added`);
        onSaved?.(saved);
      }}
    >
      {(form) => (
        <Field label="Name" required error={form.formState.errors.name}>
          <Input autoFocus placeholder="Soko" {...form.register('name')} />
        </Field>
      )}
    </FormDialog>
  );
}
