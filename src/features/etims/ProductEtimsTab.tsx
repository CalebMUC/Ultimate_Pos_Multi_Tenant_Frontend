'use client';

import { forwardRef, useState, type SelectHTMLAttributes } from 'react';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, Card, CardContent, CardHeader, CardTitle, Input, NativeSelect } from '@/components/ui/primitives';
import { Can } from '@/components/shared/Can';
import { DetailList } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { etimsApi } from '@/api/endpoints/etims';
import { useQueryKey } from '@/hooks/useSessionInfo';
import type { EtimsCodeDto, EtimsProductProfileDto } from '@/api/dto/etims';
import { ItemClassPicker } from './ItemClassPicker';
import { useListsDevice, useTwoLetterCodes } from './etims';

const twoLetters = (label: string) => z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, `${label}: two letters.`);
const schema = z.object({
  itemClassCode: z.string().trim().max(20),
  quantityUnitCode: twoLetters('Quantity unit'),
  packagingUnitCode: twoLetters('Packaging unit'),
});
type Values = z.infer<typeof schema>;

/** How the product is described to KRA (Etims.View). KRA registers an item once, so it can change only until then (Etims.Manage). */
export function ProductEtimsTab({ productId, categoryName }: { productId: string; categoryName?: string | null }) {
  const key = useQueryKey();
  const profile = useQuery({ queryKey: key('etims', { product: productId }), queryFn: () => etimsApi.product(productId) });
  const device = useListsDevice();
  const [editing, setEditing] = useState(false);

  if (profile.isLoading) return <LoadingState />;
  if (profile.error || !profile.data) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />;
  const p = profile.data;
  const classification = p.itemClassCode
    ? p.itemClassCode
    : p.effectiveItemClassCode
      ? `From category${categoryName ? ` ${categoryName}` : ''}: ${p.effectiveItemClassCode}`
      : `Device default${device?.defaultItemClassCode ? `: ${device.defaultItemClassCode}` : ''}`;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>KRA eTIMS</CardTitle>
          <p className="text-sm text-muted-foreground">How this product is registered with KRA. It is sent by itself before its first sale.</p>
        </div>
        {!p.isRegistered && <Can permission="Etims.Manage"><Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil />Edit</Button></Can>}
      </CardHeader>
      <CardContent className="space-y-3">
        <DetailList
          columns={3}
          items={[
            { label: 'KRA item code', value: p.itemCode ? <span className="font-mono">{p.itemCode}</span> : 'Not registered with KRA yet' },
            { label: 'Item classification', value: classification },
            { label: 'Quantity unit', value: p.quantityUnitCode },
            { label: 'Packaging unit', value: p.packagingUnitCode },
            { label: 'Origin', value: p.originCountryCode },
          ]}
        />
        {p.isRegistered && (
          <Alert variant="info"><Lock /><AlertDescription>KRA registers an item once and does not allow changes.</AlertDescription></Alert>
        )}
      </CardContent>
      {!p.isRegistered && <ProductEtimsDialog profile={p} open={editing} onOpenChange={setEditing} />}
    </Card>
  );
}

export function ProductEtimsDialog({ profile: p, open, onOpenChange }: { profile: EtimsProductProfileDto; open: boolean; onOpenChange(open: boolean): void }) {
  const qc = useQueryClient();
  const quantity = useTwoLetterCodes('10');
  const packaging = useTwoLetterCodes('17');
  return (
    <FormDialog<Values>
      open={open}
      onOpenChange={onOpenChange}
      title="KRA eTIMS details"
      description="Set these before the product's first sale: KRA registers an item once and does not allow changes."
      schema={schema}
      defaultValues={{ itemClassCode: p.itemClassCode ?? '', quantityUnitCode: p.quantityUnitCode || 'NO', packagingUnitCode: p.packagingUnitCode || 'NT' }}
      onSubmit={async (v) => {
        // No classification of its own (null): the category's, else the device default. Null origin keeps it.
        await etimsApi.updateProduct(p.productId, {
          itemClassCode: v.itemClassCode || null,
          quantityUnitCode: v.quantityUnitCode,
          packagingUnitCode: v.packagingUnitCode,
          originCountryCode: null,
        });
        await qc.invalidateQueries({ queryKey: ['etims'] });
        toast.success('KRA details saved');
      }}
    >
      {(form) => {
        const e = form.formState.errors;
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Item classification" error={e.itemClassCode} className="sm:col-span-2" hint="Empty: the category's, else the device default.">
              <ItemClassPicker
                value={form.watch('itemClassCode') || null}
                onChange={(code) => form.setValue('itemClassCode', code ?? '', { shouldDirty: true })}
                emptyLabel="Use the category's"
              />
            </Field>
            <Field label="Quantity unit" required error={e.quantityUnitCode} className="sm:col-span-2"
              hint="KRA builds item codes only from two-letter units. Pieces, litres and grams are reported as NO (number).">
              <UnitCodeSelect codes={quantity.codes} available={quantity.available} current={p.quantityUnitCode} {...form.register('quantityUnitCode')} />
            </Field>
            <Field label="Packaging unit" required error={e.packagingUnitCode}>
              <UnitCodeSelect codes={packaging.codes} available={packaging.available} current={p.packagingUnitCode} {...form.register('packagingUnitCode')} />
            </Field>
          </div>
        );
      }}
    </FormDialog>
  );
}

type UnitCodeSelectProps = SelectHTMLAttributes<HTMLSelectElement> & { codes: EtimsCodeDto[]; available: boolean; current: string };

/** KRA's two-letter units; before KRA's lists are downloaded, the two letters are typed. */
const UnitCodeSelect = forwardRef<HTMLSelectElement & HTMLInputElement, UnitCodeSelectProps>(({ codes, available, current, ...rest }, ref) => {
  if (!available) return <Input {...(rest as React.InputHTMLAttributes<HTMLInputElement>)} ref={ref} maxLength={2} className="uppercase" />;
  // The API's suggestion stays choosable even if KRA's list has since dropped it.
  const options = codes.some((c) => c.code === current) || current.length !== 2 ? codes : [{ code: current, name: current } as EtimsCodeDto, ...codes];
  return (
    <NativeSelect ref={ref} {...rest}>
      {options.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
    </NativeSelect>
  );
});
UnitCodeSelect.displayName = 'UnitCodeSelect';
