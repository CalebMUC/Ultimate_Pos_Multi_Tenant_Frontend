'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Separator, Textarea } from '@/components/ui/primitives';
import { Switch } from '@/components/ui/overlays';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { BrandPicker, CategorySelect, UnitSelect } from '@/components/shared/Pickers';
import { productsApi } from '@/api/endpoints/catalog';
import { enumOptions, ItemType, labels, TaxClassification } from '@/api/enums';
import { optionalNumber, requiredId, requiredNumber, requiredText, text } from '@/lib/schemas';
import { emptyToNull } from '@/lib/utils';
import { unitSymbol, useUnits } from '@/hooks/useLookups';
import { useActiveBusiness, usePermission } from '@/hooks/useSessionInfo';
import { BrandFormDialog } from './BrandFormDialog';
import type { ProductDto, UpdateProductRequestDto } from '@/api/dto/catalog';

const price = optionalNumber({ label: 'Price' }).refine((v) => v === null || v > 0, 'Price must be greater than zero.');

const schema = z.object({
  name: requiredText('Name', 200),
  description: text(1000),
  categoryId: requiredId('Category'),
  /** '' means no brand. */
  brandId: z.string(),
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
  // Create only: saved with the product, all or nothing. Prices are per base unit (or per pack), from now.
  retailPrice: price,
  wholesalePrice: price,
  packs: z.array(z.object({
    packUnitOfMeasureId: requiredId('Pack unit'),
    conversionFactor: requiredNumber('How many', { gt: 0 }),
    retailPrice: price,
    wholesalePrice: price,
  })),
});
type Values = z.infer<typeof schema>;

/** The brand part of an edit: brandId when it changed, removeBrand when cleared, neither when unchanged (the API then keeps it). '' is no brand. */
export function brandChange(before: string, after: string): Pick<UpdateProductRequestDto, 'brandId' | 'removeBrand'> {
  if (after === before) return {};
  return after ? { brandId: after } : { removeBrand: true };
}

export function ProductFormDialog({ open, onOpenChange, product, onSaved }: { open: boolean; onOpenChange(o: boolean): void; product?: ProductDto | null; onSaved?(p: ProductDto): void }) {
  const qc = useQueryClient();
  const editing = !!product;
  const { hasModule } = useActiveBusiness();
  // Module options are offered only where the business uses them; a product that already has one keeps showing it (read-only),
  // because the API still needs batches and prescriptions for such products.
  const production = hasModule('production');
  const batches = hasModule('batches');
  const prescriptions = hasModule('prescriptions');
  const etims = hasModule('etims');
  const itemTypes = enumOptions(labels.itemType).filter((o) => production || o.value === ItemType.FinishedGood || o.value === product?.itemType);
  const hasRxDetails = !!(product?.requiresPrescription || product?.genericName || product?.strength || product?.dosageForm);
  const showRx = prescriptions || hasRxDetails;
  const canManageBrands = usePermission('Products.ManageBrands');
  // The API refuses prices and packs (403) without these.
  const canPrice = usePermission('Products.ManagePricing');
  const canPacks = usePermission('Products.ManageUnitConversions');
  const [newBrand, setNewBrand] = useState<((id: string, name: string) => void) | null>(null);
  const [brandLabel, setBrandLabel] = useState<string | null>(null);
  useEffect(() => {
    if (open) setBrandLabel(null);
  }, [open]);
  return (
    <>
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
          brandId: product?.brandId ?? '',
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
          retailPrice: null,
          wholesalePrice: null,
          packs: [],
        }}
        onSubmit={async ({ brandId, retailPrice, wholesalePrice, packs, ...v }) => {
          const body = {
            ...v,
            description: emptyToNull(v.description),
            barcode: emptyToNull(v.barcode),
            genericName: emptyToNull(v.genericName),
            strength: emptyToNull(v.strength),
            dosageForm: emptyToNull(v.dosageForm),
            manufacturer: emptyToNull(v.manufacturer),
          };
          const saved = editing
            ? await productsApi.update(product!.productId, { ...body, ...brandChange(product!.brandId ?? '', brandId) })
            : await productsApi.create({
                ...body,
                brandId: brandId || null,
                ...(canPrice ? { retailPrice, wholesalePrice } : {}),
                packs: canPacks && packs.length
                  ? packs.map((pk) => ({
                      packUnitOfMeasureId: pk.packUnitOfMeasureId,
                      conversionFactor: pk.conversionFactor,
                      ...(canPrice ? { retailPrice: pk.retailPrice, wholesalePrice: pk.wholesalePrice } : {}),
                    }))
                  : undefined,
              });
          await qc.invalidateQueries({ queryKey: ['products'] });
          // Product counts per brand.
          await qc.invalidateQueries({ queryKey: ['brands'] });
          toast.success(editing ? 'Product updated' : `${saved.name} added as ${saved.sku}`, {
            description: !editing && etims ? 'Set its KRA classification on the product’s eTIMS tab before its first sale, if the category’s is not right.' : undefined,
          });
          onSaved?.(saved);
        }}
      >
        {(form) => {
          const e = form.formState.errors;
          return (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Name" required error={e.name} className="sm:col-span-2" hint="Include the brand and size in the name, e.g. Soko Maize Meal 2kg. It is what prints on the receipt.">
                  <Input autoFocus {...form.register('name')} />
                </Field>
                <Field label="Barcode" error={e.barcode}><Input {...form.register('barcode')} placeholder="Scan or type" /></Field>
                <Field label="Category" required error={e.categoryId}><CategorySelect {...form.register('categoryId')} /></Field>
                <Field label="Brand" error={e.brandId}>
                  <BrandPicker
                    value={form.watch('brandId') || null}
                    selectedLabel={brandLabel ?? product?.brandName}
                    invalid={!!e.brandId}
                    clearable
                    onChange={(id, b) => {
                      setBrandLabel(b?.name ?? null);
                      form.setValue('brandId', id ?? '', { shouldDirty: true });
                      form.clearErrors('brandId');
                    }}
                    footer={canManageBrands && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setNewBrand(() => (id: string, name: string) => {
                          setBrandLabel(name);
                          form.setValue('brandId', id, { shouldDirty: true });
                          form.clearErrors('brandId');
                        })}
                      >
                        <Plus />New brand
                      </Button>
                    )}
                  />
                </Field>
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
              {/* Edits keep prices on the Pricing tab: a price change is a new price from a date, and past sales keep the old one. */}
              {!editing && (canPrice || canPacks) && <NewProductPrices form={form} canPrice={canPrice} canPacks={canPacks} />}
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
      <BrandFormDialog
        open={newBrand !== null}
        onOpenChange={(o) => !o && setNewBrand(null)}
        onSaved={(b) => newBrand?.(b.brandId, b.name)}
      />
    </>
  );
}

/** Prices and packs for a new product. All optional: a product saved without them is priced later on its Pricing tab. */
function NewProductPrices({ form, canPrice, canPacks }: { form: UseFormReturn<Values>; canPrice: boolean; canPacks: boolean }) {
  const units = useUnits();
  const packs = useFieldArray({ control: form.control, name: 'packs' });
  const baseId = form.watch('baseUnitOfMeasureId');
  const base = unitSymbol(units.data, baseId) || 'base unit';
  const packUnitIds = (units.data ?? []).filter((u) => u.unitOfMeasureId !== baseId).map((u) => u.unitOfMeasureId);
  const e = form.formState.errors;
  return (
    <>
      <Separator />
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold">Prices</p>
          <p className="text-xs text-muted-foreground">Optional, and saved together with the product. You can also price it later on its Pricing tab.</p>
        </div>
        {canPrice && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={`Retail price per ${base}`} error={e.retailPrice}>
              <Input type="number" min={0} step="any" {...form.register('retailPrice', { valueAsNumber: true })} />
            </Field>
            <Field label={`Wholesale price per ${base}`} error={e.wholesalePrice}>
              <Input type="number" min={0} step="any" {...form.register('wholesalePrice', { valueAsNumber: true })} />
            </Field>
          </div>
        )}
        {canPacks && (
          <>
            {packs.fields.map((field, i) => {
              const pe = e.packs?.[i];
              return (
                <div key={field.id} className="grid items-start gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                  <Field label="Pack unit" required error={pe?.packUnitOfMeasureId}>
                    <UnitSelect placeholder="Select pack" allowedIds={packUnitIds} {...form.register(`packs.${i}.packUnitOfMeasureId`)} />
                  </Field>
                  <Field label={`How many ${base} in one pack`} required error={pe?.conversionFactor}>
                    <Input type="number" min={0} step="any" {...form.register(`packs.${i}.conversionFactor`, { valueAsNumber: true })} />
                  </Field>
                  {canPrice && (
                    <>
                      <Field label="Retail price per pack" error={pe?.retailPrice}>
                        <Input type="number" min={0} step="any" {...form.register(`packs.${i}.retailPrice`, { valueAsNumber: true })} />
                      </Field>
                      <Field label="Wholesale price per pack" error={pe?.wholesalePrice}>
                        <Input type="number" min={0} step="any" {...form.register(`packs.${i}.wholesalePrice`, { valueAsNumber: true })} />
                      </Field>
                    </>
                  )}
                  <Button type="button" variant="ghost" size="icon" className="sm:mt-6" onClick={() => packs.remove(i)} aria-label="Remove pack"><Trash2 /></Button>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => packs.append({ packUnitOfMeasureId: '', conversionFactor: NaN, retailPrice: null, wholesalePrice: null })}
            >
              <Plus />Add pack
            </Button>
          </>
        )}
      </div>
    </>
  );
}
