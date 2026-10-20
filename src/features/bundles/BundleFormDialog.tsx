'use client';

import { useEffect, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { Alert, AlertDescription, Input, NativeSelect, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea } from '@/components/ui/primitives';
import { Field } from '@/components/shared/Field';
import { ProductPicker } from '@/components/shared/Pickers';
import { FormAlert } from '@/components/shared/States';
import { productBundlesApi } from '@/api/endpoints/bundles';
import { productsApi } from '@/api/endpoints/catalog';
import { normaliseError } from '@/api/errors';
import { ItemType } from '@/api/enums';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatQty } from '@/lib/format';
import { emptyToNull } from '@/lib/utils';
import { sellableUnits } from '@/features/pos/cartActions';
import type { ProductBundleDto } from '@/api/dto/bundles';

interface PartRow { key: string; productId: string | null; productName: string | null; unitOfMeasureId: string; unitSymbol: string | null; quantity: string }

let seq = 0;
const blankPart = (): PartRow => ({ key: `p${++seq}`, productId: null, productName: null, unitOfMeasureId: '', unitSymbol: null, quantity: '1' });

/** "Per bundle: 20 l Purified Water, 1 pcs 20L Heavy-duty bottle", from the saved parts. */
export function perBundleText(bundle: Pick<ProductBundleDto, 'components'>): string {
  return bundle.components.map((c) => `${formatQty(c.quantityInBaseUnits, c.baseUnitSymbol)} ${c.productName}`).join(', ');
}

/**
 * Creates or edits a bundle: name, code, prices and its parts. Editing sends the full parts list (a replace). Field errors from the
 * API show beside their field; INVALID_ASSIGNMENT (a part that can't be sold in that unit, inactive, ...) shows above the parts.
 */
export function BundleFormDialog({ bundle, open, onOpenChange }: { bundle: ProductBundleDto | null; open: boolean; onOpenChange(o: boolean): void }) {
  const qc = useQueryClient();
  const key = useQueryKey();
  const editing = !!bundle;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [retail, setRetail] = useState('');
  const [wholesale, setWholesale] = useState('');
  const [parts, setParts] = useState<PartRow[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [partsError, setPartsError] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(bundle?.name ?? '');
    setCode(bundle?.code ?? '');
    setDescription(bundle?.description ?? '');
    setRetail(bundle ? String(bundle.retailPrice) : '');
    setWholesale(bundle?.wholesalePrice != null ? String(bundle.wholesalePrice) : '');
    setParts(bundle?.components.length
      ? bundle.components.map((c) => ({ key: c.productBundleComponentId, productId: c.productId, productName: c.productName, unitOfMeasureId: c.unitOfMeasureId, unitSymbol: c.unitSymbol, quantity: String(c.quantity) }))
      : [blankPart(), blankPart()]);
    setFieldErrors({});
    setPartsError(null);
    setError(null);
  }, [open, bundle]);

  // Each part's units: its base unit and active pack units (from the product), so a bottle can't be given "20L".
  const details = useQueries({
    queries: parts.map((p) => ({
      queryKey: key('products', { detail: p.productId }),
      queryFn: () => productsApi.get(p.productId!),
      enabled: open && !!p.productId,
      staleTime: 60_000,
    })),
  });

  const setPart = (k: string, patch: Partial<PartRow>) => setParts((ps) => ps.map((p) => (p.key === k ? { ...p, ...patch } : p)));
  const err = (field: string) => (fieldErrors[field]?.length ? { message: fieldErrors[field].join(' ') } : undefined);

  async function save() {
    setFieldErrors({});
    setPartsError(null);
    setError(null);
    const chosen = parts.filter((p) => p.productId);
    if (!name.trim()) return setFieldErrors({ name: ['Name is required.'] });
    if (!(Number(retail) > 0)) return setFieldErrors({ retailPrice: ['The retail price must be more than zero.'] });
    if (wholesale !== '' && !(Number(wholesale) > 0)) return setFieldErrors({ wholesalePrice: ['Leave empty, or more than zero.'] });
    if (chosen.length === 0) return setPartsError('Add at least one part.');
    if (chosen.some((p) => !p.unitOfMeasureId || !(Number(p.quantity) > 0))) return setPartsError('Every part needs a unit and a quantity above zero.');
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        code: emptyToNull(code),
        description: emptyToNull(description),
        retailPrice: Number(retail),
        wholesalePrice: wholesale === '' ? null : Number(wholesale),
        components: chosen.map((p) => ({ productId: p.productId!, unitOfMeasureId: p.unitOfMeasureId, quantity: Number(p.quantity) })),
      };
      const saved = editing ? await productBundlesApi.update(bundle!.productBundleId, body) : await productBundlesApi.create(body);
      await qc.invalidateQueries({ queryKey: ['product-bundles'] });
      toast.success(editing ? `${saved.name} saved` : `${saved.name} created`);
      onOpenChange(false);
    } catch (e) {
      const apiError = normaliseError(e);
      if (apiError.code === 'INVALID_ASSIGNMENT') setPartsError(apiError.message);
      else if (apiError.hasFieldErrors()) {
        setFieldErrors(apiError.fieldErrors);
        const partErrors = Object.entries(apiError.fieldErrors).filter(([k]) => k.startsWith('components')).flatMap(([, m]) => m);
        if (partErrors.length) setPartsError(partErrors.join(' '));
      } else setError(apiError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${bundle!.name}` : 'New bundle'}</DialogTitle>
          <DialogDescription>Several products sold together at one price, rung up as one item. Each part leaves its own stock.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required error={err('name')} className="sm:col-span-2"><Input autoFocus maxLength={200} value={name} onChange={(e) => setName(e.target.value)} placeholder="20L Heavy-duty bottle + water" /></Field>
          <Field label="Code" error={err('code')} hint="Optional. Typed at the till to add it."><Input className="uppercase" maxLength={50} value={code} onChange={(e) => setCode(e.target.value)} placeholder="HD20" /></Field>
          <div />
          <Field label="Retail price (KES)" required error={err('retailPrice')}><Input type="number" min={0} step="0.01" value={retail} onChange={(e) => setRetail(e.target.value)} /></Field>
          <Field label="Wholesale price (KES)" error={err('wholesalePrice')} hint="Empty: wholesale customers pay the retail price."><Input type="number" min={0} step="0.01" value={wholesale} onChange={(e) => setWholesale(e.target.value)} /></Field>
          <Field label="Description" error={err('description')} className="sm:col-span-2"><Textarea maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-12" /></Field>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Parts</p>
          {partsError && <Alert variant="destructive"><AlertDescription>{partsError}</AlertDescription></Alert>}
          <Table>
            <TableHeader>
              <TableRow><TableHead>Product</TableHead><TableHead>Unit</TableHead><TableHead className="w-28">Quantity</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {parts.map((p, i) => {
                const detail = details[i]?.data;
                const units = detail ? sellableUnits(detail) : p.unitOfMeasureId ? [{ unitOfMeasureId: p.unitOfMeasureId, symbol: p.unitSymbol ?? '…' }] : [];
                return (
                  <TableRow key={p.key}>
                    <TableCell className="min-w-56">
                      <ProductPicker
                        value={p.productId}
                        selectedLabel={p.productName}
                        filter={{ itemType: ItemType.FinishedGood }}
                        onChange={(id, item) => setPart(p.key, { productId: id, productName: item?.name ?? null, unitOfMeasureId: item?.baseUnitOfMeasureId ?? '', unitSymbol: item?.baseUnitSymbol ?? null })}
                      />
                    </TableCell>
                    <TableCell>
                      <NativeSelect
                        value={p.unitOfMeasureId}
                        disabled={!p.productId}
                        onChange={(e) => setPart(p.key, { unitOfMeasureId: e.target.value, unitSymbol: units.find((u) => u.unitOfMeasureId === e.target.value)?.symbol ?? null })}
                        className="h-9 w-28"
                        aria-label="Unit"
                      >
                        {units.length === 0 && <option value="">—</option>}
                        {units.map((u) => <option key={u.unitOfMeasureId} value={u.unitOfMeasureId}>{u.symbol}</option>)}
                      </NativeSelect>
                    </TableCell>
                    <TableCell>
                      <Input type="number" min={0} step="any" value={p.quantity} onChange={(e) => setPart(p.key, { quantity: e.target.value })} className="h-9" aria-label="Quantity" />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" disabled={parts.length <= 1} onClick={() => setParts((ps) => ps.filter((x) => x.key !== p.key))} aria-label="Remove part"><X /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Button variant="outline" size="sm" disabled={parts.length >= 20} onClick={() => setParts((ps) => [...ps, blankPart()])}><Plus />Add part</Button>
          {bundle && <p className="text-xs text-muted-foreground">Per bundle (as saved): {perBundleText(bundle)}</p>}
          <p className="text-xs text-muted-foreground">
            Parts with their own price (water) count at that price; parts without one (bottles) take the rest. Half a litre is 0.5 in litres.
          </p>
        </div>

        <FormAlert error={error} />
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={saving} onClick={save}>{editing ? 'Save bundle' : 'Create bundle'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
