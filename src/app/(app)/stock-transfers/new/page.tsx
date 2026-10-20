'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFieldArray, useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, Input, NativeSelect, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow, Textarea } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { PageHeader } from '@/components/shared/Display';
import { Field, FieldMessage } from '@/components/shared/Field';
import { ProductPicker } from '@/components/shared/Pickers';
import { FormAlert } from '@/components/shared/States';
import { stockTransfersApi } from '@/api/endpoints/branches';
import { stockApi } from '@/api/endpoints/inventory';
import { normaliseError } from '@/api/errors';
import { useProductDetail } from '@/hooks/useLookups';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { applyApiErrors } from '@/lib/forms';
import { formatQty } from '@/lib/format';
import { requiredNumber, text } from '@/lib/schemas';
import { emptyToNull } from '@/lib/utils';
import { useSession } from '@/stores/session';
import { sellableUnits } from '@/features/pos/cartActions';
import { branchLabel, useBranchDirectory } from '@/features/branches/branches';
import type { StockLevelDto } from '@/api/dto/inventory';

const schema = z
  .object({
    fromBranchId: z.string().min(1, 'Choose where the stock comes from.'),
    toBranchId: z.string().min(1, 'Choose where it goes.'),
    notes: text(500),
    lines: z
      .array(z.object({
        productId: z.string().min(1, 'Select a product.'),
        productLabel: z.string(),
        unitOfMeasureId: z.string().min(1, 'Select a unit.'),
        quantity: requiredNumber('Quantity', { gt: 0 }),
      }))
      .min(1, 'Add at least one line.')
      .refine((ls) => new Set(ls.map((l) => l.productId).filter(Boolean)).size === ls.filter((l) => l.productId).length, 'Each product can appear only once: combine the lines.'),
  })
  .refine((v) => v.fromBranchId !== v.toBranchId, { path: ['toBranchId'], message: 'Choose a different branch to send the stock to.' });
type Values = z.infer<typeof schema>;

const emptyLine = { productId: '', productLabel: '', unitOfMeasureId: '', quantity: undefined as unknown as number };

function UnitCell({ form, index }: { form: UseFormReturn<Values>; index: number }) {
  const productId = useWatch({ control: form.control, name: `lines.${index}.productId` });
  const product = useProductDetail(productId || null);
  return (
    <NativeSelect {...form.register(`lines.${index}.unitOfMeasureId`)} className="h-8 w-24" disabled={!product.data} aria-label="Unit">
      {product.data ? sellableUnits(product.data).map((u) => <option key={u.unitOfMeasureId} value={u.unitOfMeasureId}>{u.symbol}</option>) : <option value="">—</option>}
    </NativeSelect>
  );
}

/** What the source branch has of a product, in its base unit (the unexpired quantity for batch-tracked products). */
function Available({ level }: { level: StockLevelDto | undefined }) {
  if (!level) return <span className="text-xs text-muted-foreground">None</span>;
  const qty = level.sellableQuantity ?? level.quantityOnHand;
  return <span className={`text-xs tabular ${qty <= 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{formatQty(qty, level.baseUnitSymbol)}{level.isBatchTracked ? ' unexpired' : ''}</span>;
}

function NewTransfer() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const key = useQueryKey();
  const activeBranchId = useSession((s) => s.activeBranchId);
  const myBranches = useSession((s) => s.branches);
  const directory = useBranchDirectory();
  const [messages, setMessages] = useState<string[]>([]);
  const requestedFrom = params.get('fromBranchId');
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      fromBranchId: requestedFrom && myBranches.some((b) => b.branchId === requestedFrom) ? requestedFrom : activeBranchId ?? '',
      toBranchId: '',
      notes: '',
      lines: [emptyLine],
    },
  });
  const lines = useFieldArray({ control: form.control, name: 'lines' });
  const watched = useWatch({ control: form.control, name: 'lines' });
  const fromBranchId = useWatch({ control: form.control, name: 'fromBranchId' });
  const stock = useQuery({ queryKey: key('stock', { levels: true, branchId: fromBranchId }), queryFn: () => stockApi.levels(false, { branchId: fromBranchId }), enabled: !!fromBranchId });
  const levelOf = (productId: string) => stock.data?.find((s) => s.productId === productId);
  const destinations = (directory.data ?? []).filter((b) => b.branchId !== fromBranchId).sort((a, b) => a.branchNumber - b.branchNumber);
  const e = form.formState.errors;

  async function submit(v: Values) {
    setMessages([]);
    try {
      const t = await stockTransfersApi.create({
        fromBranchId: v.fromBranchId,
        toBranchId: v.toBranchId,
        notes: emptyToNull(v.notes),
        lines: v.lines.map(({ productId, unitOfMeasureId, quantity }) => ({ productId, unitOfMeasureId, quantity })),
      });
      await qc.invalidateQueries({ queryKey: ['stock-transfers'] });
      toast.success(`${t.transferNumber} saved as a draft. Dispatch it to send the stock.`);
      router.push(`/stock-transfers/${t.stockTransferId}`);
    } catch (err) {
      const rest = applyApiErrors(form, err);
      setMessages(rest.length ? rest : normaliseError(err).hasFieldErrors() ? [] : [normaliseError(err).message]);
    }
  }

  return (
    <>
      <PageHeader
        title="New transfer"
        description="Saved as a draft: nothing moves until it is dispatched."
        actions={<Button variant="ghost" asChild><Link href="/stock-transfers"><ArrowLeft />Transfers</Link></Button>}
      />
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
        <FormAlert messages={messages} />
        <Card>
          <CardContent className="grid items-start gap-3 pt-4 sm:grid-cols-[1fr_auto_1fr]">
            <Field label="From" required error={e.fromBranchId} hint={myBranches.length > 1 ? 'Any branch you work at.' : undefined}>
              {myBranches.length > 1 ? (
                <NativeSelect {...form.register('fromBranchId')}>
                  {myBranches.map((b) => <option key={b.branchId} value={b.branchId}>{branchLabel(b)}{b.branchId === activeBranchId ? ' (here)' : ''}</option>)}
                </NativeSelect>
              ) : (
                // One branch: nothing to choose. Not registered, so the value stays in the form's defaults.
                <Input readOnly className="bg-muted" value={branchLabel(myBranches[0])} />
              )}
            </Field>
            <ArrowRight className="mt-8 hidden size-5 text-muted-foreground sm:block" />
            <Field label="To" required error={e.toBranchId}>
              <NativeSelect {...form.register('toBranchId')}>
                <option value="">{directory.isLoading ? 'Loading…' : 'Choose the branch'}</option>
                {destinations.map((b) => <option key={b.branchId} value={b.branchId}>{branchLabel(b)}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Notes" error={e.notes} className="sm:col-span-3"><Textarea className="min-h-9" {...form.register('notes')} /></Field>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[18rem]">Product</TableHead>
                <TableHead>Available at source</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.fields.map((field, i) => {
                const le = e.lines?.[i];
                const l = watched?.[i];
                return (
                  <TableRow key={field.id} className="align-top">
                    <TableCell>
                      <ProductPicker
                        value={l?.productId || null}
                        selectedLabel={l?.productLabel}
                        invalid={!!le?.productId}
                        filter={{}}
                        onChange={(id, item) => {
                          form.setValue(`lines.${i}.productId`, id ?? '', { shouldValidate: true });
                          form.setValue(`lines.${i}.productLabel`, item ? `${item.name} (${item.sku})` : '');
                          form.setValue(`lines.${i}.unitOfMeasureId`, item?.baseUnitOfMeasureId ?? '');
                        }}
                      />
                      <FieldMessage error={le?.productId} />
                    </TableCell>
                    <TableCell>{l?.productId ? (stock.isLoading ? <span className="text-xs text-muted-foreground">…</span> : <Available level={levelOf(l.productId)} />) : null}</TableCell>
                    <TableCell><UnitCell form={form} index={i} /><FieldMessage error={le?.unitOfMeasureId} /></TableCell>
                    <TableCell className="text-right">
                      <Input type="number" step="any" min={0} className="ml-auto h-8 w-24 text-right" aria-invalid={!!le?.quantity} aria-label="Quantity" {...form.register(`lines.${i}.quantity`, { valueAsNumber: true })} />
                      <FieldMessage error={le?.quantity} />
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="icon-sm" disabled={lines.fields.length === 1} onClick={() => lines.remove(i)} aria-label="Remove line"><Trash2 /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow><TableCell colSpan={5}><Button type="button" variant="outline" size="sm" onClick={() => lines.append(emptyLine)}><Plus />Add line</Button></TableCell></TableRow>
            </TableFooter>
          </Table>
        </Card>
        {typeof e.lines?.message === 'string' && <p className="text-sm text-destructive">{e.lines.message}</p>}
        {typeof e.lines?.root?.message === 'string' && <p className="text-sm text-destructive">{e.lines.root.message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild><Link href="/stock-transfers">Cancel</Link></Button>
          <Button type="submit" loading={form.formState.isSubmitting}>Save draft</Button>
        </div>
      </form>
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="StockTransfers.Create"><NewTransfer /></PermissionRoute>;
}
