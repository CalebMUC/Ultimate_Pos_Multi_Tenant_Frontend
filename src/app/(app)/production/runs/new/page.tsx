'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Calculator, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle, Card, CardContent, CardHeader, CardTitle, Input, NativeSelect, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { MoneyText, PageHeader, StatCard } from '@/components/shared/Display';
import { Field, FieldMessage } from '@/components/shared/Field';
import { FormAlert } from '@/components/shared/States';
import { formulasApi, productionApi } from '@/api/endpoints/other';
import { normaliseError } from '@/api/errors';
import { enumOptions, labels, ProductionCostType } from '@/api/enums';
import { useProductDetail } from '@/hooks/useLookups';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { applyApiErrors } from '@/lib/forms';
import { formatMoney, formatPercent, formatQty } from '@/lib/format';
import { optionalNumber, requiredNumber, text } from '@/lib/schemas';
import { cn, emptyToNull } from '@/lib/utils';
import { humanize } from '@/api/mappers';
import { sellableUnits } from '@/features/pos/cartActions';
import type { CreateProductionRunRequestDto, ProductionPreviewDto } from '@/api/dto/production';

const schema = z.object({
  formulaId: z.string().min(1, 'Select a formula.'),
  quantityToProduce: requiredNumber('Quantity', { gt: 0 }),
  unitOfMeasureId: z.string().min(1, 'Select a unit.'),
  actualQuantityProduced: optionalNumber({ min: 0, label: 'Actual quantity' }),
  notes: text(500),
  additionalCosts: z.array(z.object({
    costType: z.coerce.number().pipe(z.nativeEnum(ProductionCostType)),
    description: text(200),
    amount: requiredNumber('Amount', { gt: 0 }),
  })),
});
type Values = z.infer<typeof schema>;

function toRequest(v: Values): CreateProductionRunRequestDto {
  return {
    formulaId: v.formulaId,
    quantityToProduce: v.quantityToProduce,
    unitOfMeasureId: v.unitOfMeasureId,
    actualQuantityProduced: v.actualQuantityProduced,
    notes: emptyToNull(v.notes),
    additionalCosts: v.additionalCosts.length ? v.additionalCosts.map((c) => ({ ...c, description: emptyToNull(c.description) })) : null,
  };
}

function NewRun() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const key = useQueryKey();
  const canSeeCost = usePermission('Costing.View');
  const formulas = useQuery({ queryKey: key('formulas', { activeOnly: true }), queryFn: () => formulasApi.list({ activeOnly: true }) });
  const [messages, setMessages] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ data: ProductionPreviewDto; snapshot: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { formulaId: params.get('formulaId') ?? '', quantityToProduce: undefined as unknown as number, unitOfMeasureId: '', actualQuantityProduced: null, notes: '', additionalCosts: [] },
  });
  const costs = useFieldArray({ control: form.control, name: 'additionalCosts' });
  const values = useWatch({ control: form.control });
  const formula = formulas.data?.find((f) => f.formulaId === values.formulaId);
  const product = useProductDetail(formula?.productId ?? null);
  const snapshot = JSON.stringify(values);
  const previewFresh = preview && preview.snapshot === snapshot;
  const e = form.formState.errors;

  function fail(err: unknown) {
    const rest = applyApiErrors(form, err);
    setMessages(rest.length ? rest : normaliseError(err).hasFieldErrors() ? [] : [normaliseError(err).message]);
  }

  const runPreview = form.handleSubmit(async (v) => {
    setMessages([]);
    setPreviewing(true);
    try {
      setPreview({ data: await productionApi.preview(toRequest(v)), snapshot: JSON.stringify(form.getValues()) });
    } catch (err) {
      fail(err);
    } finally {
      setPreviewing(false);
    }
  });

  const record = form.handleSubmit(async (v) => {
    setMessages([]);
    try {
      const run = await productionApi.record(toRequest(v));
      await Promise.all(['production-runs', 'stock', 'dashboard'].map((r) => qc.invalidateQueries({ queryKey: [r] })));
      toast.success(`Run ${run.runNumber} recorded: ${formatQty(run.quantityProduced)} ${run.productName}`);
      router.push(`/production/runs/${run.productionRunId}`);
    } catch (err) {
      fail(err);
    }
  });

  const p = previewFresh ? preview!.data : null;

  return (
    <>
      <PageHeader title="New production run" actions={<Button variant="ghost" asChild><Link href="/production/runs"><ArrowLeft />Production runs</Link></Button>} />
      <div className="grid gap-4 xl:grid-cols-5">
        <form className="space-y-4 xl:col-span-2" noValidate onSubmit={(ev) => { ev.preventDefault(); void runPreview(); }}>
          <FormAlert messages={messages} />
          <Card>
            <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
              <Field label="Formula" required error={e.formulaId} className="sm:col-span-2">
                <NativeSelect
                  {...form.register('formulaId', {
                    onChange: (ev) => {
                      const f = formulas.data?.find((x) => x.formulaId === ev.target.value);
                      form.setValue('unitOfMeasureId', f?.outputUnitOfMeasureId ?? '');
                      form.setValue('quantityToProduce', f?.outputQuantity ?? (undefined as unknown as number));
                    },
                  })}
                >
                  <option value="">{formulas.isLoading ? 'Loading…' : 'Select a formula'}</option>
                  {formulas.data?.map((f) => <option key={f.formulaId} value={f.formulaId}>{f.productName} · v{f.versionNumber}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Quantity to produce" required error={e.quantityToProduce}><Input type="number" step="any" min={0} {...form.register('quantityToProduce', { valueAsNumber: true })} /></Field>
              <Field label="Unit" required error={e.unitOfMeasureId}>
                <NativeSelect {...form.register('unitOfMeasureId')} disabled={!product.data}>
                  {product.data ? sellableUnits(product.data).map((u) => <option key={u.unitOfMeasureId} value={u.unitOfMeasureId}>{u.symbol}</option>) : <option value="">—</option>}
                </NativeSelect>
              </Field>
              <Field label="Actually produced" error={e.actualQuantityProduced} hint="If the yield differs from the plan. Empty = as planned." className="sm:col-span-2">
                <Input type="number" step="any" min={0} {...form.register('actualQuantityProduced', { valueAsNumber: true })} />
              </Field>
              <Field label="Notes" error={e.notes} className="sm:col-span-2"><Textarea {...form.register('notes')} /></Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Other costs</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {costs.fields.map((field, i) => (
                <div key={field.id} className="grid items-start gap-2 sm:grid-cols-[8rem_1fr_7rem_auto]">
                  <NativeSelect {...form.register(`additionalCosts.${i}.costType`)} aria-label="Cost type">
                    {enumOptions(labels.productionCostType).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </NativeSelect>
                  <Input placeholder="Description" {...form.register(`additionalCosts.${i}.description`)} />
                  <div>
                    <Input type="number" step="0.01" min={0} placeholder="KES" aria-invalid={!!e.additionalCosts?.[i]?.amount} {...form.register(`additionalCosts.${i}.amount`, { valueAsNumber: true })} />
                    <FieldMessage error={e.additionalCosts?.[i]?.amount} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => costs.remove(i)} aria-label="Remove cost"><Trash2 /></Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => costs.append({ costType: ProductionCostType.Labour, description: '', amount: undefined as unknown as number })}>
                <Plus />Add cost
              </Button>
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Button type="submit" variant="outline" loading={previewing}><Calculator />Check materials</Button>
            <Button type="button" loading={form.formState.isSubmitting} disabled={!p?.canProduce} onClick={() => void record()}>Record run</Button>
          </div>
          {preview && !previewFresh && <p className="text-xs text-muted-foreground">You changed the form: check materials again before recording.</p>}
        </form>

        <div className="space-y-4 xl:col-span-3">
          {!p ? (
            <Alert variant="info"><Calculator /><AlertDescription>Check materials to see what this run needs, whether there is enough stock, and what it will cost.</AlertDescription></Alert>
          ) : (
            <>
              {p.canProduce ? (
                <Alert variant="success"><CheckCircle2 /><AlertTitle>Enough stock to produce</AlertTitle><AlertDescription>{formatQty(p.quantityToProduce)} {p.productName}, formula v{p.formulaVersion}.</AlertDescription></Alert>
              ) : (
                <Alert variant="destructive"><AlertTriangle /><AlertTitle>Not enough stock</AlertTitle><AlertDescription>Some ingredients are short. Receive or adjust stock first.</AlertDescription></Alert>
              )}
              {canSeeCost && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatCard label="Materials" value={formatMoney(p.estimatedMaterialCost)} />
                  <StatCard label="Total cost" value={formatMoney(p.estimatedTotalCost)} hint={p.costComplete ? undefined : 'Some ingredients have no cost'} tone={p.costComplete ? 'default' : 'warning'} />
                  <StatCard label="Cost per unit" value={formatMoney(p.estimatedCostPerUnit)} />
                </div>
              )}
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingredient</TableHead>
                      <TableHead className="text-right">Needed</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Short</TableHead>
                      {canSeeCost && <TableHead className="text-right">Cost</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.requirements.map((r) => (
                      <TableRow key={r.ingredientProductId} className={cn(r.shortfallInBaseUnits > 0 && 'bg-destructive/5')}>
                        <TableCell><span className="font-medium">{r.ingredientName}</span><span className="block text-xs text-muted-foreground">{r.ingredientSku}</span></TableCell>
                        <TableCell className="text-right tabular">{formatQty(r.requiredInBaseUnits)}</TableCell>
                        <TableCell className="text-right tabular">{formatQty(r.availableInBaseUnits)}</TableCell>
                        <TableCell className={cn('text-right tabular', r.shortfallInBaseUnits > 0 && 'font-semibold text-destructive')}>{r.shortfallInBaseUnits > 0 ? formatQty(r.shortfallInBaseUnits) : '—'}</TableCell>
                        {canSeeCost && <TableCell className="text-right"><MoneyText value={r.estimatedCost} currency={false} /></TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
              {canSeeCost && p.priceChecks.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Margin at current prices</CardTitle></CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    {p.priceChecks.map((c) => (
                      <div key={c.priceType} className="rounded-md border p-3 text-sm">
                        <p className="font-medium">{humanize(c.priceType)} · {formatMoney(c.price)}</p>
                        <p className={cn('tabular', c.margin < 0 ? 'text-destructive' : 'text-success')}>Margin {formatMoney(c.margin)} ({formatPercent(c.marginPercent)})</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Production.Run" requires="production"><Suspense><NewRun /></Suspense></PermissionRoute>;
}
