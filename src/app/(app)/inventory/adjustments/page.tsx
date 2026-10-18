'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileBarChart, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Input, NativeSelect, Textarea } from '@/components/ui/primitives';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DetailList, PageHeader, ProductFlags } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { ProductPicker } from '@/components/shared/Pickers';
import { FormAlert } from '@/components/shared/States';
import { stockApi } from '@/api/endpoints/inventory';
import { normaliseError } from '@/api/errors';
import { useProductDetail } from '@/hooks/useLookups';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { applyApiErrors } from '@/lib/forms';
import { formatDateOnly, formatQty } from '@/lib/format';
import { optionalNumber, requiredNumber, requiredText, text } from '@/lib/schemas';
import { cn, emptyToNull } from '@/lib/utils';
import { sellableUnits } from '@/features/pos/cartActions';
import type { StockLevelDto } from '@/api/dto/inventory';

const schema = z.object({
  productId: z.string().min(1, 'Select a product.'),
  unitOfMeasureId: z.string().min(1, 'Select a unit.'),
  direction: z.enum(['in', 'out']),
  quantity: requiredNumber('Quantity', { gt: 0 }),
  reason: requiredText('Reason', 500),
  unitCost: optionalNumber({ min: 0, label: 'Unit cost' }),
  stockBatchId: z.string(),
  batchNumber: text(64),
  expiryDate: z.string(),
  manufactureDate: z.string(),
});
type Values = z.infer<typeof schema>;

const REASONS = ['Stock count correction', 'Damaged', 'Expired', 'Theft or loss', 'Opening stock', 'Found stock', 'Sample / own use'];

function Adjustments() {
  const qc = useQueryClient();
  const key = useQueryKey();
  const [messages, setMessages] = useState<string[]>([]);
  const [last, setLast] = useState<StockLevelDto | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { productId: '', unitOfMeasureId: '', direction: 'in', quantity: undefined as unknown as number, reason: '', unitCost: null, stockBatchId: '', batchNumber: '', expiryDate: '', manufactureDate: '' },
  });
  const productId = form.watch('productId');
  const direction = form.watch('direction');
  const product = useProductDetail(productId || null);
  const p = product.data;
  const level = useQuery({ queryKey: key('stock', { productId }), queryFn: () => stockApi.level(productId), enabled: !!productId, retry: false });
  const batches = useQuery({
    queryKey: key('stock', { batches: { productId } }),
    queryFn: () => stockApi.batches({ productId, includeExpired: true }),
    enabled: !!p?.isBatchTracked && direction === 'out',
  });

  async function submit(v: Values) {
    setMessages([]);
    try {
      const result = await stockApi.adjust({
        productId: v.productId,
        unitOfMeasureId: v.unitOfMeasureId,
        quantityChange: v.direction === 'in' ? v.quantity : -v.quantity,
        reason: v.reason,
        unitCost: v.direction === 'in' ? v.unitCost : null,
        stockBatchId: p?.isBatchTracked && v.direction === 'out' ? v.stockBatchId || null : null,
        batchNumber: p?.isBatchTracked && v.direction === 'in' ? emptyToNull(v.batchNumber) : null,
        expiryDate: p?.isBatchTracked && v.direction === 'in' ? v.expiryDate || null : null,
        manufactureDate: p?.isBatchTracked && v.direction === 'in' ? v.manufactureDate || null : null,
      });
      await Promise.all(['stock', 'dashboard'].map((r) => qc.invalidateQueries({ queryKey: [r] })));
      toast.success(`Stock adjusted. ${result.productName} now ${formatQty(result.quantityOnHand, result.baseUnitSymbol)}`);
      setLast(result);
      form.reset({ ...form.getValues(), quantity: undefined as unknown as number, unitCost: null, stockBatchId: '', batchNumber: '', expiryDate: '', manufactureDate: '' });
    } catch (e) {
      const rest = applyApiErrors(form, e);
      setMessages(rest.length ? rest : normaliseError(e).hasFieldErrors() ? [] : [normaliseError(e).message]);
    }
  }

  const e = form.formState.errors;
  return (
    <>
      <PageHeader
        title="Adjust stock"
        description="Correct stock after a count, write off damage or expiry, or enter opening stock. Every adjustment needs a reason."
        actions={<Can permission="InventoryReports.View"><Button variant="outline" asChild><Link href="/reports/stock-adjustments"><FileBarChart />Adjustment history</Link></Button></Can>}
      />
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
                    onChange={(id, item) => {
                      form.setValue('productId', id ?? '', { shouldValidate: true });
                      form.setValue('unitOfMeasureId', item?.baseUnitOfMeasureId ?? '');
                      setLast(null);
                    }}
                  />
                </div>
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Direction" error={e.direction}>
                  <div className="grid grid-cols-2 gap-1 rounded-md border p-1">
                    {(['in', 'out'] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => form.setValue('direction', d)}
                        className={cn('flex items-center justify-center gap-1 rounded py-1.5 text-sm font-medium', direction === d ? (d === 'in' ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground') : 'hover:bg-accent')}
                      >
                        {d === 'in' ? <><Plus className="size-4" />Add</> : <><Minus className="size-4" />Remove</>}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Quantity" required error={e.quantity}><Input type="number" step="any" min={0} {...form.register('quantity', { valueAsNumber: true })} /></Field>
                <Field label="Unit" required error={e.unitOfMeasureId}>
                  <NativeSelect {...form.register('unitOfMeasureId')} disabled={!p}>
                    {p ? sellableUnits(p).map((u) => <option key={u.unitOfMeasureId} value={u.unitOfMeasureId}>{u.symbol}</option>) : <option value="">—</option>}
                  </NativeSelect>
                </Field>
              </div>
              {direction === 'in' && (
                <Field label="Unit cost (KES per unit chosen)" error={e.unitCost} hint="Needed when the product has no cost yet, e.g. opening stock. Leave empty to use the current average cost.">
                  <Input type="number" step="0.01" min={0} {...form.register('unitCost', { valueAsNumber: true })} />
                </Field>
              )}
              {p?.isBatchTracked && direction === 'in' && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Batch number" required error={e.batchNumber}><Input {...form.register('batchNumber')} /></Field>
                  <Field label="Expiry date" error={e.expiryDate}><Input type="date" {...form.register('expiryDate')} /></Field>
                  <Field label="Manufacture date" error={e.manufactureDate}><Input type="date" {...form.register('manufactureDate')} /></Field>
                </div>
              )}
              {p?.isBatchTracked && direction === 'out' && (
                <Field label="Batch" required error={e.stockBatchId}>
                  <NativeSelect {...form.register('stockBatchId')}>
                    <option value="">{batches.isLoading ? 'Loading…' : 'Select the batch'}</option>
                    {batches.data?.map((b) => (
                      <option key={b.stockBatchId} value={b.stockBatchId}>
                        {b.batchNumber} · exp {formatDateOnly(b.expiryDate)} · {formatQty(b.quantityOnHand, b.baseUnitSymbol)}{b.expiryStatus === 'Expired' ? ' · EXPIRED' : ''}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              )}
              <Field label="Reason" required error={e.reason}>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {REASONS.map((r) => <Button key={r} type="button" variant="outline" size="sm" onClick={() => form.setValue('reason', r, { shouldValidate: true })}>{r}</Button>)}
                  </div>
                  <Textarea {...form.register('reason')} />
                </div>
              </Field>
              <Button type="submit" loading={form.formState.isSubmitting}>Save adjustment</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Current stock</CardTitle></CardHeader>
          <CardContent>
            {!p ? (
              <p className="text-sm text-muted-foreground">Pick a product to see its stock.</p>
            ) : (
              <DetailList
                columns={1}
                items={[
                  { label: 'Product', value: <span className="flex items-center gap-2">{p.name} <ProductFlags requiresPrescription={p.requiresPrescription} isBatchTracked={p.isBatchTracked} /></span> },
                  { label: 'On hand', value: level.data ? formatQty((last ?? level.data).quantityOnHand, p.baseUnitSymbol) : level.error ? 'No stock yet' : '…' },
                  ...(p.isBatchTracked ? [{ label: 'Sellable (unexpired)', value: level.data ? formatQty((last ?? level.data).sellableQuantity, p.baseUnitSymbol) : '—' }] : []),
                  { label: 'Pack units', value: p.unitConversions.filter((c) => c.isActive).map((c) => `1 ${c.packUnitSymbol} = ${c.conversionFactor} ${p.baseUnitSymbol}`).join(', ') || 'None' },
                ]}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Stock.Adjust"><Adjustments /></PermissionRoute>;
}
