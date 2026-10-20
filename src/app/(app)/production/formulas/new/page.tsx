'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFieldArray, useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Input, NativeSelect, Textarea } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { PageHeader } from '@/components/shared/Display';
import { Field, FieldMessage } from '@/components/shared/Field';
import { ProductPicker } from '@/components/shared/Pickers';
import { FormAlert } from '@/components/shared/States';
import { formulasApi } from '@/api/endpoints/other';
import { normaliseError } from '@/api/errors';
import { ItemType } from '@/api/enums';
import { useProductDetail } from '@/hooks/useLookups';
import { applyApiErrors } from '@/lib/forms';
import { requiredNumber, text } from '@/lib/schemas';
import { emptyToNull } from '@/lib/utils';
import { sellableUnits } from '@/features/pos/cartActions';

const schema = z.object({
  productId: z.string().min(1, 'Select the product this formula makes.'),
  productLabel: z.string(),
  outputQuantity: requiredNumber('Output quantity', { gt: 0 }),
  outputUnitOfMeasureId: z.string().min(1, 'Select a unit.'),
  notes: text(500),
  lines: z
    .array(z.object({
      ingredientProductId: z.string().min(1, 'Select an ingredient.'),
      ingredientLabel: z.string(),
      unitOfMeasureId: z.string().min(1, 'Select a unit.'),
      quantity: requiredNumber('Quantity', { gt: 0 }),
    }))
    .min(1, 'Add at least one ingredient.'),
});
type Values = z.infer<typeof schema>;

function UnitsFor({ form, productField, name }: { form: UseFormReturn<Values>; productField: `lines.${number}.ingredientProductId` | 'productId'; name: `lines.${number}.unitOfMeasureId` | 'outputUnitOfMeasureId' }) {
  const productId = useWatch({ control: form.control, name: productField });
  const product = useProductDetail(productId || null);
  return (
    <NativeSelect {...form.register(name)} disabled={!product.data} aria-label="Unit">
      {product.data ? sellableUnits(product.data).map((u) => <option key={u.unitOfMeasureId} value={u.unitOfMeasureId}>{u.symbol}</option>) : <option value="">—</option>}
    </NativeSelect>
  );
}

function NewFormula() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<string[]>([]);
  const emptyLine = { ingredientProductId: '', ingredientLabel: '', unitOfMeasureId: '', quantity: undefined as unknown as number };
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { productId: params.get('productId') ?? '', productLabel: '', outputQuantity: 1, outputUnitOfMeasureId: '', notes: '', lines: [emptyLine] },
  });
  const lines = useFieldArray({ control: form.control, name: 'lines' });
  const watched = useWatch({ control: form.control, name: 'lines' });
  const e = form.formState.errors;

  async function submit(v: Values) {
    setMessages([]);
    try {
      const f = await formulasApi.create({
        productId: v.productId,
        outputQuantity: v.outputQuantity,
        outputUnitOfMeasureId: v.outputUnitOfMeasureId,
        notes: emptyToNull(v.notes),
        lines: v.lines.map(({ ingredientProductId, unitOfMeasureId, quantity }) => ({ ingredientProductId, unitOfMeasureId, quantity })),
      });
      await qc.invalidateQueries({ queryKey: ['formulas'] });
      toast.success(`Formula v${f.versionNumber} for ${f.productName} saved`);
      router.push(`/production/formulas/${f.formulaId}`);
    } catch (err) {
      const rest = applyApiErrors(form, err);
      setMessages(rest.length ? rest : normaliseError(err).hasFieldErrors() ? [] : [normaliseError(err).message]);
    }
  }

  return (
    <>
      <PageHeader title="New formula" actions={<Button variant="ghost" asChild><Link href="/production/formulas"><ArrowLeft />Formulas</Link></Button>} />
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
        <FormAlert messages={messages} />
        <Card>
          <CardHeader><CardTitle>Output</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <Field label="Product made" required error={e.productId} className="sm:col-span-2">
              <div>
                <ProductPicker
                  value={form.watch('productId') || null}
                  selectedLabel={form.watch('productLabel')}
                  invalid={!!e.productId}
                  filter={{ itemType: ItemType.FinishedGood }}
                  onChange={(id, item) => {
                    form.setValue('productId', id ?? '', { shouldValidate: true });
                    form.setValue('productLabel', item ? `${item.name} (${item.sku})` : '');
                    form.setValue('outputUnitOfMeasureId', item?.baseUnitOfMeasureId ?? '');
                  }}
                />
              </div>
            </Field>
            <Field label="Batch size" required error={e.outputQuantity}><Input type="number" step="any" min={0} {...form.register('outputQuantity', { valueAsNumber: true })} /></Field>
            <Field label="Unit" required error={e.outputUnitOfMeasureId}><UnitsFor form={form} productField="productId" name="outputUnitOfMeasureId" /></Field>
            <Field label="Notes" error={e.notes} className="sm:col-span-4"><Textarea {...form.register('notes')} placeholder="Method, mixing order, QC checks…" /></Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Ingredients and packaging per batch</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {lines.fields.map((field, i) => {
              const le = e.lines?.[i];
              return (
                <div key={field.id} className="grid items-start gap-2 sm:grid-cols-[1fr_8rem_7rem_auto]">
                  <div>
                    <ProductPicker
                      value={watched?.[i]?.ingredientProductId || null}
                      selectedLabel={watched?.[i]?.ingredientLabel}
                      invalid={!!le?.ingredientProductId}
                      filter={{}}
                      onChange={(id, item) => {
                        form.setValue(`lines.${i}.ingredientProductId`, id ?? '', { shouldValidate: true });
                        form.setValue(`lines.${i}.ingredientLabel`, item ? `${item.name} (${item.sku})` : '');
                        form.setValue(`lines.${i}.unitOfMeasureId`, item?.baseUnitOfMeasureId ?? '');
                      }}
                      placeholder="Ingredient or packaging…"
                    />
                    <FieldMessage error={le?.ingredientProductId} />
                  </div>
                  <div>
                    <Input type="number" step="any" min={0} placeholder="Qty" aria-invalid={!!le?.quantity} {...form.register(`lines.${i}.quantity`, { valueAsNumber: true })} />
                    <FieldMessage error={le?.quantity} />
                  </div>
                  <UnitsFor form={form} productField={`lines.${i}.ingredientProductId`} name={`lines.${i}.unitOfMeasureId`} />
                  <Button type="button" variant="ghost" size="icon" disabled={lines.fields.length === 1} onClick={() => lines.remove(i)} aria-label="Remove ingredient"><Trash2 /></Button>
                </div>
              );
            })}
            {typeof e.lines?.message === 'string' && <p className="text-sm text-destructive">{e.lines.message}</p>}
            <Button type="button" variant="outline" size="sm" onClick={() => lines.append(emptyLine)}><Plus />Add ingredient</Button>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild><Link href="/production/formulas">Cancel</Link></Button>
          <Button type="submit" loading={form.formState.isSubmitting}>Save formula</Button>
        </div>
      </form>
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Formulas.Create" module="production"><Suspense><NewFormula /></Suspense></PermissionRoute>;
}
