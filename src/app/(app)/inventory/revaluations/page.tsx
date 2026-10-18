'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, Card, CardContent, CardHeader, CardTitle, Input, NativeSelect, Textarea } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { DetailList, PageHeader } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { ProductPicker } from '@/components/shared/Pickers';
import { FormAlert } from '@/components/shared/States';
import { costingApi } from '@/api/endpoints/inventory';
import { normaliseError } from '@/api/errors';
import { useProductDetail } from '@/hooks/useLookups';
import { applyApiErrors } from '@/lib/forms';
import { formatMoney, formatQty } from '@/lib/format';
import { requiredNumber, requiredText } from '@/lib/schemas';
import { sellableUnits } from '@/features/pos/cartActions';
import type { StockValuationRowDto } from '@/api/dto/inventory';

const schema = z.object({
  productId: z.string().min(1, 'Select a product.'),
  unitOfMeasureId: z.string().min(1, 'Select a unit.'),
  unitCost: requiredNumber('Unit cost', { gt: 0 }),
  reason: requiredText('Reason', 500),
});
type Values = z.infer<typeof schema>;

function Revaluations() {
  const qc = useQueryClient();
  const [messages, setMessages] = useState<string[]>([]);
  const [result, setResult] = useState<StockValuationRowDto | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { productId: '', unitOfMeasureId: '', unitCost: undefined as unknown as number, reason: '' } });
  const productId = form.watch('productId');
  const product = useProductDetail(productId || null);
  const e = form.formState.errors;

  async function submit(v: Values) {
    setMessages([]);
    try {
      const row = await costingApi.revalue(v);
      setResult(row);
      await Promise.all(['stock', 'dashboard'].map((r) => qc.invalidateQueries({ queryKey: [r] })));
      toast.success(`${row.productName} revalued`);
      form.reset({ productId: '', unitOfMeasureId: '', unitCost: undefined as unknown as number, reason: '' });
    } catch (err) {
      const rest = applyApiErrors(form, err);
      setMessages(rest.length ? rest : normaliseError(err).hasFieldErrors() ? [] : [normaliseError(err).message]);
    }
  }

  return (
    <>
      <PageHeader title="Revalue stock" description="Set a product’s unit cost when it is missing or wrong. Quantities don’t change; the stock value and future margins do." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="pt-4">
            <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
              <FormAlert messages={messages} />
              <Field label="Product" required error={e.productId}>
                <div>
                  <ProductPicker
                    value={productId || null}
                    invalid={!!e.productId}
                    filter={{}}
                    onChange={(id, item) => {
                      form.setValue('productId', id ?? '', { shouldValidate: true });
                      form.setValue('unitOfMeasureId', item?.baseUnitOfMeasureId ?? '');
                    }}
                  />
                </div>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="New unit cost (KES)" required error={e.unitCost}><Input type="number" step="0.01" min={0} {...form.register('unitCost', { valueAsNumber: true })} /></Field>
                <Field label="Per" required error={e.unitOfMeasureId}>
                  <NativeSelect {...form.register('unitOfMeasureId')} disabled={!product.data}>
                    {product.data ? sellableUnits(product.data).map((u) => <option key={u.unitOfMeasureId} value={u.unitOfMeasureId}>{u.symbol}</option>) : <option value="">—</option>}
                  </NativeSelect>
                </Field>
              </div>
              <Field label="Reason" required error={e.reason}><Textarea {...form.register('reason')} placeholder="e.g. Opening stock was entered without cost" /></Field>
              <Button type="submit" loading={form.formState.isSubmitting}>Revalue</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Result</CardTitle></CardHeader>
          <CardContent>
            {result ? (
              <DetailList
                columns={1}
                items={[
                  { label: 'Product', value: result.productName },
                  { label: 'On hand', value: formatQty(result.quantityOnHand) },
                  { label: 'Average unit cost', value: formatMoney(result.averageUnitCost) },
                  { label: 'Stock value', value: formatMoney(result.stockValue) },
                ]}
              />
            ) : (
              <Alert variant="info"><AlertDescription>Revaluations are kept in the stock movement history of the product.</AlertDescription></Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Costing.Revalue"><Revaluations /></PermissionRoute>;
}
