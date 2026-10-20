'use client';

import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Input, NativeSelect, Separator, Textarea } from '@/components/ui/primitives';
import { Switch } from '@/components/ui/overlays';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { CategorySelect, UnitSelect } from '@/components/shared/Pickers';
import { productsApi } from '@/api/endpoints/catalog';
import { enumOptions, ItemType, labels, TaxClassification } from '@/api/enums';
import { requiredId, requiredNumber, requiredText, text } from '@/lib/schemas';
import { emptyToNull } from '@/lib/utils';
import { useActiveBusiness } from '@/hooks/useSessionInfo';
import type { ProductDto } from '@/api/dto/catalog';

const schema = z.object({
  name: requiredText('Name', 200),
  description: text(1000),
  categoryId: requiredId('Category'),
  itemType: z.coerce.number().pipe(z.nativeEnum(ItemType)),
  taxClassification: z.coerce.number().pipe(z.nativeEnum(TaxClassification)),
  baseUnitOfMeasureId: requiredId('Base unit'),
  reorderLevel: requiredNumber('Reorder level', { min: 0 }),
  barcode: z.string().trim().max(64, 'At most 64 characters.').refine((v) => !/\s/.test(v), 'No spaces in a barcode.'),
  isBatchTracked: z.boolean(),
  requiresPrescription: z.boolean(),
  genericName: text(200),
  strength: text(50),
  dosageForm: text(50),
  manufacturer: text(200),
});
type Values = z.infer<typeof schema>;

export function ProductFormDialog({ open, onOpenChange, product, onSaved }: { open: boolean; onOpenChange(o: boolean): void; product?: ProductDto | null; onSaved?(p: ProductDto): void }) {
  const qc = useQueryClient();
  const editing = !!product;
  const { hasModule } = useActiveBusiness();
  // Module options are offered only where the business uses them; a product that already has one keeps showing it (read-only),
  // because the API still needs batches and prescriptions for such products.
  const production = hasModule('production');
  const batches = hasModule('batches');
  const prescriptions = hasModule('prescriptions');
  const itemTypes = enumOptions(labels.itemType).filter((o) => production || o.value === ItemType.FinishedGood || o.value === product?.itemType);
  const hasRxDetails = !!(product?.requiresPrescription || product?.genericName || product?.strength || product?.dosageForm);
  const showRx = prescriptions || hasRxDetails;
  return (
    <FormDialog<Values>
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit ${product!.name}` : 'New product'}
      description={editing ? `SKU ${product!.sku}` : 'The SKU is generated from the category code and item type.'}
      size="xl"
      schema={schema}
      defaultValues={{
        name: product?.name ?? '',
        description: product?.description ?? '',
        categoryId: product?.categoryId ?? '',
        itemType: product?.itemType ?? ItemType.FinishedGood,
        taxClassification: product?.taxClassification ?? TaxClassification.Standard,
        baseUnitOfMeasureId: product?.baseUnitOfMeasureId ?? '',
        reorderLevel: product?.reorderLevel ?? 0,
        barcode: product?.barcode ?? '',
        isBatchTracked: product?.isBatchTracked ?? false,
        requiresPrescription: product?.requiresPrescription ?? false,
        genericName: product?.genericName ?? '',
        strength: product?.strength ?? '',
        dosageForm: product?.dosageForm ?? '',
        manufacturer: product?.manufacturer ?? '',
      }}
      onSubmit={async (v) => {
        const body = {
          ...v,
          description: emptyToNull(v.description),
          barcode: emptyToNull(v.barcode),
          genericName: emptyToNull(v.genericName),
          strength: emptyToNull(v.strength),
          dosageForm: emptyToNull(v.dosageForm),
          manufacturer: emptyToNull(v.manufacturer),
        };
        const saved = editing ? await productsApi.update(product!.productId, body) : await productsApi.create(body);
        await qc.invalidateQueries({ queryKey: ['products'] });
        toast.success(editing ? 'Product updated' : `${saved.name} added as ${saved.sku}`);
        onSaved?.(saved);
      }}
    >
      {(form) => {
        const e = form.formState.errors;
        return (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Name" required error={e.name} className="sm:col-span-2"><Input autoFocus {...form.register('name')} /></Field>
              <Field label="Barcode" error={e.barcode}><Input {...form.register('barcode')} placeholder="Scan or type" /></Field>
              <Field label="Category" required error={e.categoryId}><CategorySelect {...form.register('categoryId')} /></Field>
              <Field label="Item type" error={e.itemType} hint={!production ? 'Raw materials and packaging are for businesses that make their own products.' : editing ? undefined : 'Only finished goods can be sold.'}>
                <NativeSelect {...form.register('itemType')}>
                  {itemTypes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="VAT" error={e.taxClassification}>
                <NativeSelect {...form.register('taxClassification')}>
                  {enumOptions(labels.taxClassification).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Base unit" required error={e.baseUnitOfMeasureId} hint="Stock is counted in this unit."><UnitSelect {...form.register('baseUnitOfMeasureId')} /></Field>
              <Field label="Reorder level" required error={e.reorderLevel} hint="In the base unit.">
                <Input type="number" min={0} step="any" {...form.register('reorderLevel', { valueAsNumber: true })} />
              </Field>
              <Field label="Description" error={e.description} className="sm:col-span-2 lg:col-span-3"><Textarea {...form.register('description')} /></Field>
            </div>
            <Separator />
            <div className="space-y-3">
              <p className="text-sm font-semibold">{showRx ? 'Medicine details' : 'More details'}</p>
              {(batches || product?.isBatchTracked || showRx) && (
                <div className="flex flex-wrap gap-6">
                  {(batches || product?.isBatchTracked) && (
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={form.watch('isBatchTracked')}
                        disabled={!batches}
                        onCheckedChange={(v) => form.setValue('isBatchTracked', v, { shouldDirty: true })}
                      />
                      Batch-tracked (batch numbers and expiry dates)
                    </label>
                  )}
                  {showRx && (
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={form.watch('requiresPrescription')}
                        disabled={!prescriptions}
                        onCheckedChange={(v) => form.setValue('requiresPrescription', v, { shouldDirty: true })}
                      />
                      Prescription only (Rx)
                    </label>
                  )}
                </div>
              )}
              {editing && form.watch('isBatchTracked') !== product!.isBatchTracked && (
                <p className="text-xs text-warning-foreground dark:text-warning">Batch tracking can only change while the product has no stock.</p>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {showRx && (
                  <>
                    <Field label="Generic name" error={e.genericName}><Input readOnly={!prescriptions} {...form.register('genericName')} placeholder="Amoxicillin" /></Field>
                    <Field label="Strength" error={e.strength}><Input readOnly={!prescriptions} {...form.register('strength')} placeholder="500mg" /></Field>
                    <Field label="Dosage form" error={e.dosageForm}><Input readOnly={!prescriptions} {...form.register('dosageForm')} placeholder="Capsule" /></Field>
                  </>
                )}
                <Field label="Manufacturer" error={e.manufacturer}><Input {...form.register('manufacturer')} /></Field>
              </div>
            </div>
          </div>
        );
      }}
    </FormDialog>
  );
}
