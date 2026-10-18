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
import { Alert, AlertDescription, Card, CardContent, Input, NativeSelect, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow, Textarea } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { MoneyText, PageHeader } from '@/components/shared/Display';
import { Field, FieldMessage } from '@/components/shared/Field';
import { ProductPicker, SupplierPicker } from '@/components/shared/Pickers';
import { FormAlert } from '@/components/shared/States';
import { purchaseOrdersApi } from '@/api/endpoints/inventory';
import { normaliseError } from '@/api/errors';
import { labels } from '@/api/enums';
import { useProductDetail, usePurchasableItemTypes } from '@/hooks/useLookups';
import { applyApiErrors } from '@/lib/forms';
import { requiredNumber, text } from '@/lib/schemas';
import { emptyToNull, round2, sum } from '@/lib/utils';
import { sellableUnits } from '@/features/pos/cartActions';

const lineSchema = z.object({
  productId: z.string().min(1, 'Select a product.'),
  productLabel: z.string(),
  unitOfMeasureId: z.string().min(1, 'Select a unit.'),
  quantityOrdered: requiredNumber('Quantity', { gt: 0 }),
  unitCost: requiredNumber('Unit cost', { min: 0 }),
});
const schema = z.object({
  supplierId: z.string().min(1, 'Select a supplier.'),
  expectedDeliveryDate: z.string(),
  notes: text(500),
  lines: z.array(lineSchema).min(1, 'Add at least one line.'),
});
type Values = z.infer<typeof schema>;

const emptyLine = { productId: '', productLabel: '', unitOfMeasureId: '', quantityOrdered: 1, unitCost: undefined as unknown as number };

function UnitCell({ form, index }: { form: UseFormReturn<Values>; index: number }) {
  const productId = useWatch({ control: form.control, name: `lines.${index}.productId` });
  const product = useProductDetail(productId || null);
  return (
    <NativeSelect {...form.register(`lines.${index}.unitOfMeasureId`)} className="h-8 w-24" disabled={!product.data} aria-label="Unit">
      {product.data ? sellableUnits(product.data).map((u) => <option key={u.unitOfMeasureId} value={u.unitOfMeasureId}>{u.symbol}</option>) : <option value="">—</option>}
    </NativeSelect>
  );
}

function NewPurchaseOrder() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const purchasable = usePurchasableItemTypes();
  const [messages, setMessages] = useState<string[]>([]);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { supplierId: params.get('supplierId') ?? '', expectedDeliveryDate: '', notes: '', lines: [emptyLine] },
  });
  const lines = useFieldArray({ control: form.control, name: 'lines' });
  const watched = useWatch({ control: form.control, name: 'lines' });
  const total = round2(sum(watched ?? [], (l) => (Number(l.quantityOrdered) || 0) * (Number(l.unitCost) || 0)));
  const e = form.formState.errors;

  async function submit(v: Values) {
    setMessages([]);
    try {
      const po = await purchaseOrdersApi.create({
        supplierId: v.supplierId,
        expectedDeliveryDate: v.expectedDeliveryDate ? new Date(`${v.expectedDeliveryDate}T00:00:00`).toISOString() : null,
        notes: emptyToNull(v.notes),
        lines: v.lines.map(({ productId, unitOfMeasureId, quantityOrdered, unitCost }) => ({ productId, unitOfMeasureId, quantityOrdered, unitCost })),
      });
      await qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success(`Order ${po.orderNumber} created`);
      router.push(`/purchase-orders/${po.purchaseOrderId}`);
    } catch (err) {
      const rest = applyApiErrors(form, err);
      setMessages(rest.length ? rest : normaliseError(err).hasFieldErrors() ? [] : [normaliseError(err).message]);
    }
  }

  return (
    <>
      <PageHeader title="New purchase order" actions={<Button variant="ghost" asChild><Link href="/purchase-orders"><ArrowLeft />Purchase orders</Link></Button>} />
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
        <FormAlert messages={messages} />
        {purchasable.data && (
          <Alert variant="info">
            <AlertDescription>This business may buy: {purchasable.data.map((t) => labels.itemType[t].toLowerCase()).join(', ')}.</AlertDescription>
          </Alert>
        )}
        <Card>
          <CardContent className="grid gap-3 pt-4 sm:grid-cols-3">
            <Field label="Supplier" required error={e.supplierId}>
              <div><SupplierPicker value={form.watch('supplierId') || null} invalid={!!e.supplierId} onChange={(id) => form.setValue('supplierId', id ?? '', { shouldValidate: true })} /></div>
            </Field>
            <Field label="Expected delivery" error={e.expectedDeliveryDate}><Input type="date" {...form.register('expectedDeliveryDate')} /></Field>
            <Field label="Notes" error={e.notes}><Textarea className="min-h-9" {...form.register('notes')} /></Field>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[18rem]">Product</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit cost (KES)</TableHead>
                <TableHead className="text-right">Line total</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.fields.map((field, index) => {
                const le = e.lines?.[index];
                const l = watched?.[index];
                return (
                  <TableRow key={field.id} className="align-top">
                    <TableCell>
                      <ProductPicker
                        value={l?.productId || null}
                        selectedLabel={l?.productLabel}
                        invalid={!!le?.productId}
                        filter={{ itemType: undefined }}
                        onChange={(id, item) => {
                          form.setValue(`lines.${index}.productId`, id ?? '', { shouldValidate: true });
                          form.setValue(`lines.${index}.productLabel`, item ? `${item.name} (${item.sku})` : '');
                          form.setValue(`lines.${index}.unitOfMeasureId`, item?.baseUnitOfMeasureId ?? '');
                        }}
                      />
                      <FieldMessage error={le?.productId} />
                    </TableCell>
                    <TableCell><UnitCell form={form} index={index} /><FieldMessage error={le?.unitOfMeasureId} /></TableCell>
                    <TableCell className="text-right">
                      <Input type="number" step="any" min={0} className="ml-auto h-8 w-24 text-right" aria-invalid={!!le?.quantityOrdered} {...form.register(`lines.${index}.quantityOrdered`, { valueAsNumber: true })} />
                      <FieldMessage error={le?.quantityOrdered} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" step="0.01" min={0} className="ml-auto h-8 w-28 text-right" aria-invalid={!!le?.unitCost} {...form.register(`lines.${index}.unitCost`, { valueAsNumber: true })} />
                      <FieldMessage error={le?.unitCost} />
                    </TableCell>
                    <TableCell className="text-right"><MoneyText value={round2((Number(l?.quantityOrdered) || 0) * (Number(l?.unitCost) || 0))} currency={false} /></TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="icon-sm" disabled={lines.fields.length === 1} onClick={() => lines.remove(index)} aria-label="Remove line"><Trash2 /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4}>
                  <Button type="button" variant="outline" size="sm" onClick={() => lines.append(emptyLine)}><Plus />Add line</Button>
                </TableCell>
                <TableCell className="text-right text-base"><MoneyText value={total} /></TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </Card>
        {typeof e.lines?.message === 'string' && <p className="text-sm text-destructive">{e.lines.message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild><Link href="/purchase-orders">Cancel</Link></Button>
          <Button type="submit" loading={form.formState.isSubmitting}>Create order</Button>
        </div>
      </form>
    </>
  );
}

export default function Page() {
  return (
    <PermissionRoute permission="PurchaseOrders.Create">
      <Suspense><NewPurchaseOrder /></Suspense>
    </PermissionRoute>
  );
}
