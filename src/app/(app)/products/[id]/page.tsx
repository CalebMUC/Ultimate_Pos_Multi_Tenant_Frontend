'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardHeader, CardTitle, Input, NativeSelect } from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { ActivationButton } from '@/components/shared/ActivationButton';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { DetailList, MoneyText, PageHeader, ProductFlags, QuantityText, StatCard, StatusBadge } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { UnitSelect } from '@/components/shared/Pickers';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { productsApi } from '@/api/endpoints/catalog';
import { stockApi } from '@/api/endpoints/inventory';
import { enumOptions, labels, PriceType } from '@/api/enums';
import { usePermission, usePermissions, useQueryKey } from '@/hooks/useSessionInfo';
import { formatDate, formatDateOnly, formatDateTime, formatQty, toIsoDate } from '@/lib/format';
import { requiredId, requiredNumber } from '@/lib/schemas';
import { ProductFormDialog } from '@/features/products/ProductFormDialog';
import { ActivityTimeline } from '@/features/audit/ActivityTimeline';
import type { ProductDetailDto, ProductPriceTierDto, ProductUnitConversionDto } from '@/api/dto/catalog';
import type { StockBatchDto, StockMovementDto } from '@/api/dto/inventory';

/** The tier in force for each unit and price type: the latest one whose date has come. */
function currentTierIds(tiers: ProductPriceTierDto[]): Set<string> {
  const now = Date.now();
  const best = new Map<string, ProductPriceTierDto>();
  for (const t of tiers) {
    if (new Date(t.effectiveFrom).getTime() > now) continue;
    const k = `${t.unitOfMeasureId}:${t.priceType}`;
    const prev = best.get(k);
    if (!prev || new Date(t.effectiveFrom) > new Date(prev.effectiveFrom)) best.set(k, t);
  }
  return new Set(Array.from(best.values()).map((t) => t.productPriceTierId));
}

function unitLabel(p: ProductDetailDto, unitId: string) {
  if (unitId === p.baseUnitOfMeasureId) return p.baseUnitSymbol ?? 'base';
  return p.unitConversions.find((c) => c.packUnitOfMeasureId === unitId)?.packUnitSymbol ?? '—';
}

const tierSchema = z.object({
  unitOfMeasureId: requiredId('Unit'),
  priceType: z.coerce.number().pipe(z.nativeEnum(PriceType)),
  price: requiredNumber('Price', { gt: 0 }),
  effectiveFrom: z.string().min(1, 'Pick a date.'),
});
const conversionSchema = z.object({ packUnitOfMeasureId: requiredId('Pack unit'), conversionFactor: requiredNumber('Factor', { gt: 0 }) });
const factorSchema = z.object({ conversionFactor: requiredNumber('Factor', { gt: 0 }) });

function ProductDetail({ id }: { id: string }) {
  const key = useQueryKey();
  const qc = useQueryClient();
  const can = usePermissions();
  const canStock = usePermission('Stock.View');
  const canAudit = usePermission('AuditLog.View');
  const product = useQuery({ queryKey: key('products', { detail: id }), queryFn: () => productsApi.get(id) });
  const level = useQuery({ queryKey: key('stock', { productId: id }), queryFn: () => stockApi.level(id), enabled: canStock });
  const movements = useQuery({ queryKey: key('stock', { productId: id, movements: true }), queryFn: () => stockApi.movements(id), enabled: canStock });
  const batches = useQuery({
    queryKey: key('stock', { batches: { productId: id } }),
    queryFn: () => stockApi.batches({ productId: id, includeExpired: true }),
    enabled: canStock && !!product.data?.isBatchTracked,
  });
  const [editing, setEditing] = useState(false);
  const [addingTier, setAddingTier] = useState(false);
  const [addingConversion, setAddingConversion] = useState(false);
  const [editingConversion, setEditingConversion] = useState<ProductUnitConversionDto | null>(null);

  if (product.isLoading) return <LoadingState />;
  if (product.error || !product.data) return <ErrorState error={product.error} onRetry={() => product.refetch()} />;
  const p = product.data;
  const current = currentTierIds(p.priceTiers);
  const refresh = () => qc.invalidateQueries({ queryKey: ['products'] });
  const allowedUnits = [p.baseUnitOfMeasureId, ...p.unitConversions.filter((c) => c.isActive).map((c) => c.packUnitOfMeasureId)];

  const tierColumns: ColumnDef<ProductPriceTierDto, unknown>[] = [
    { header: 'Unit', id: 'unit', cell: ({ row }) => unitLabel(p, row.original.unitOfMeasureId) },
    { header: 'Price list', accessorKey: 'priceType', cell: ({ row }) => labels.priceType[row.original.priceType] },
    { header: 'Price', accessorKey: 'price', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.price} className="font-medium" /> },
    { header: 'Effective from', accessorKey: 'effectiveFrom', cell: ({ row }) => formatDate(row.original.effectiveFrom) },
    {
      header: '',
      id: 'state',
      cell: ({ row }) =>
        current.has(row.original.productPriceTierId) ? <Badge variant="success">Current</Badge>
          : new Date(row.original.effectiveFrom).getTime() > Date.now() ? <Badge variant="info">Scheduled</Badge>
            : <Badge variant="secondary">Superseded</Badge>,
    },
  ];

  const conversionColumns: ColumnDef<ProductUnitConversionDto, unknown>[] = [
    { header: 'Pack unit', accessorKey: 'packUnitSymbol', cell: ({ row }) => <span className="font-medium">{row.original.packUnitSymbol}</span> },
    { header: 'Contains', accessorKey: 'conversionFactor', cell: ({ row }) => `${formatQty(row.original.conversionFactor)} ${p.baseUnitSymbol ?? ''}` },
    { header: 'Status', accessorKey: 'isActive', cell: ({ row }) => <StatusBadge kind="active" value={row.original.isActive} /> },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right' },
      cell: ({ row }) =>
        can('Products.ManageUnitConversions') && (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEditingConversion(row.original)}><Pencil />Factor</Button>
            <ActivationButton
              isActive={row.original.isActive}
              name={row.original.packUnitSymbol ?? 'pack unit'}
              activate={() => productsApi.activateUnitConversion(id, row.original.productUnitConversionId)}
              deactivate={() => productsApi.deactivateUnitConversion(id, row.original.productUnitConversionId)}
              invalidate={['products']}
            />
          </div>
        ),
    },
  ];

  const movementColumns: ColumnDef<StockMovementDto, unknown>[] = [
    { header: 'Date', accessorKey: 'createdAt', cell: ({ row }) => formatDateTime(row.original.createdAt) },
    { header: 'Movement', accessorKey: 'movementTypeName' },
    { header: 'Reference', accessorKey: 'referenceType' },
    { header: 'Batch', accessorKey: 'batchNumber', cell: ({ row }) => row.original.batchNumber ?? '' },
    { header: 'Notes', accessorKey: 'notes', meta: { className: 'max-w-xs truncate' }, cell: ({ row }) => row.original.notes ?? '' },
    {
      header: 'Change',
      accessorKey: 'quantityChange',
      meta: { align: 'right' },
      cell: ({ row }) => <span className={`tabular font-medium ${row.original.quantityChange < 0 ? 'text-destructive' : 'text-success'}`}>{row.original.quantityChange > 0 ? '+' : ''}{formatQty(row.original.quantityChange)}</span>,
    },
  ];

  const batchColumns: ColumnDef<StockBatchDto, unknown>[] = [
    { header: 'Batch', accessorKey: 'batchNumber', cell: ({ row }) => <span className="font-medium">{row.original.batchNumber}</span> },
    { header: 'Expiry', accessorKey: 'expiryDate', cell: ({ row }) => formatDateOnly(row.original.expiryDate) },
    { header: 'Status', accessorKey: 'expiryStatus', cell: ({ row }) => <StatusBadge kind="expiry" value={row.original.expiryStatus} /> },
    { header: 'Days left', accessorKey: 'daysToExpiry', meta: { align: 'right' }, cell: ({ row }) => row.original.daysToExpiry ?? '—' },
    { header: 'On hand', accessorKey: 'quantityOnHand', meta: { align: 'right' }, cell: ({ row }) => <QuantityText value={row.original.quantityOnHand} unit={row.original.baseUnitSymbol} /> },
    { header: 'Unit cost', accessorKey: 'unitCost', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.unitCost} currency={false} /> },
  ];

  return (
    <>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-2">{p.name}{p.strength ? ` ${p.strength}` : ''} <StatusBadge kind="active" value={p.isActive} /><ProductFlags requiresPrescription={p.requiresPrescription} isBatchTracked={p.isBatchTracked} /></span>}
        description={<span>{p.sku} · {p.categoryName} · {labels.itemType[p.itemType]}</span>}
        actions={
          <>
            <Button variant="ghost" asChild><Link href="/products"><ArrowLeft />Products</Link></Button>
            <Can permission="Products.Update"><Button variant="outline" onClick={() => setEditing(true)}><Pencil />Edit</Button></Can>
            <Can permission="Products.Deactivate">
              <ActivationButton size="default" isActive={p.isActive} name={p.name} activate={() => productsApi.activate(id)} deactivate={() => productsApi.deactivate(id)} invalidate={['products']} />
            </Can>
          </>
        }
      />
      {canStock && level.data && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <StatCard label="On hand" value={formatQty(level.data.quantityOnHand, level.data.baseUnitSymbol)} tone={level.data.belowReorderLevel ? 'warning' : 'default'} hint={level.data.belowReorderLevel ? 'Below reorder level' : undefined} />
          {p.isBatchTracked && <StatCard label="Sellable (unexpired)" value={formatQty(level.data.sellableQuantity, level.data.baseUnitSymbol)} />}
          <StatCard label="Reorder level" value={formatQty(level.data.reorderLevel, level.data.baseUnitSymbol)} />
        </div>
      )}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="units">Pack units</TabsTrigger>
          {canStock && <TabsTrigger value="movements">Stock movements</TabsTrigger>}
          {canStock && p.isBatchTracked && <TabsTrigger value="batches">Batches</TabsTrigger>}
          {canAudit && <TabsTrigger value="activity">Activity</TabsTrigger>}
        </TabsList>
        <TabsContent value="overview">
          <Card>
            <CardContent className="pt-4">
              <DetailList
                columns={3}
                items={[
                  { label: 'Barcode', value: p.barcode },
                  { label: 'Base unit', value: p.baseUnitSymbol },
                  { label: 'VAT', value: labels.taxClassification[p.taxClassification] },
                  { label: 'Generic name', value: p.genericName },
                  { label: 'Strength', value: p.strength },
                  { label: 'Dosage form', value: p.dosageForm },
                  { label: 'Manufacturer', value: p.manufacturer },
                  { label: 'Description', value: p.description },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="pricing">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Price tiers</CardTitle>
                <p className="text-sm text-muted-foreground">Prices include VAT. A new price takes effect from its date; old ones stay as history.</p>
              </div>
              <Can permission="Products.ManagePricing"><Button size="sm" onClick={() => setAddingTier(true)}><Plus />New price</Button></Can>
            </CardHeader>
            <CardContent>
              <DataTable columns={tierColumns} data={[...p.priceTiers].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))} getRowId={(t) => t.productPriceTierId} emptyTitle="No prices yet" emptyMessage="This product can’t be sold until it has a price." />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="units">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Pack units</CardTitle>
                <p className="text-sm text-muted-foreground">Larger units this product is bought or sold in, e.g. a box of 12 {p.baseUnitSymbol}.</p>
              </div>
              <Can permission="Products.ManageUnitConversions"><Button size="sm" onClick={() => setAddingConversion(true)}><Plus />Add pack unit</Button></Can>
            </CardHeader>
            <CardContent>
              <DataTable columns={conversionColumns} data={p.unitConversions} getRowId={(c) => c.productUnitConversionId} emptyTitle="Sold in the base unit only" />
            </CardContent>
          </Card>
        </TabsContent>
        {canStock && (
          <TabsContent value="movements">
            <DataTable columns={movementColumns} data={movements.data} isLoading={movements.isLoading} error={movements.error} getRowId={(m) => m.stockMovementId} emptyTitle="No stock movements yet" />
          </TabsContent>
        )}
        {canStock && p.isBatchTracked && (
          <TabsContent value="batches">
            <DataTable columns={batchColumns} data={batches.data} isLoading={batches.isLoading} error={batches.error} getRowId={(b) => b.stockBatchId} emptyTitle="No batches in stock" />
          </TabsContent>
        )}
        {canAudit && (
          <TabsContent value="activity">
            <Card><CardContent className="pt-4"><ActivityTimeline entityType="Product" entityId={id} /></CardContent></Card>
          </TabsContent>
        )}
      </Tabs>

      <ProductFormDialog open={editing} onOpenChange={setEditing} product={p} />
      <FormDialog
        open={addingTier}
        onOpenChange={setAddingTier}
        title="New price"
        schema={tierSchema}
        defaultValues={{ unitOfMeasureId: p.baseUnitOfMeasureId, priceType: PriceType.Retail, price: undefined as unknown as number, effectiveFrom: toIsoDate(new Date()) }}
        onSubmit={async (v) => {
          // A date picked as today takes effect now; a later date from the start of that local day.
          const effectiveFrom = v.effectiveFrom === toIsoDate(new Date()) ? new Date().toISOString() : new Date(`${v.effectiveFrom}T00:00:00`).toISOString();
          await productsApi.addPriceTier(id, { ...v, effectiveFrom });
          await refresh();
          toast.success('Price added');
        }}
      >
        {(form) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Unit" required error={form.formState.errors.unitOfMeasureId}><UnitSelect allowedIds={allowedUnits} {...form.register('unitOfMeasureId')} /></Field>
            <Field label="Price list" error={form.formState.errors.priceType}>
              <NativeSelect {...form.register('priceType')}>{enumOptions(labels.priceType).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
            </Field>
            <Field label="Price (KES, VAT incl.)" required error={form.formState.errors.price}><Input type="number" step="0.01" min={0} autoFocus {...form.register('price', { valueAsNumber: true })} /></Field>
            <Field label="Effective from" required error={form.formState.errors.effectiveFrom}><Input type="date" {...form.register('effectiveFrom')} /></Field>
          </div>
        )}
      </FormDialog>
      <FormDialog
        open={addingConversion}
        onOpenChange={setAddingConversion}
        title="Add pack unit"
        schema={conversionSchema}
        size="sm"
        defaultValues={{ packUnitOfMeasureId: '', conversionFactor: undefined as unknown as number }}
        onSubmit={async (v) => {
          await productsApi.addUnitConversion(id, v);
          await refresh();
          toast.success('Pack unit added');
        }}
      >
        {(form) => (
          <>
            <Field label="Pack unit" required error={form.formState.errors.packUnitOfMeasureId}><UnitSelect {...form.register('packUnitOfMeasureId')} /></Field>
            <Field label={`How many ${p.baseUnitSymbol ?? 'base units'} in one?`} required error={form.formState.errors.conversionFactor}>
              <Input type="number" step="any" min={0} {...form.register('conversionFactor', { valueAsNumber: true })} />
            </Field>
          </>
        )}
      </FormDialog>
      <FormDialog
        open={!!editingConversion}
        onOpenChange={(o) => !o && setEditingConversion(null)}
        title={`Change ${editingConversion?.packUnitSymbol ?? ''} factor`}
        description="Stock already counted is not changed: only future conversions use the new factor."
        schema={factorSchema}
        size="sm"
        defaultValues={{ conversionFactor: editingConversion?.conversionFactor ?? 1 }}
        onSubmit={async (v) => {
          await productsApi.updateUnitConversion(id, editingConversion!.productUnitConversionId, v.conversionFactor);
          await refresh();
          toast.success('Factor updated');
        }}
      >
        {(form) => (
          <Field label={`${p.baseUnitSymbol ?? 'Base units'} per ${editingConversion?.packUnitSymbol ?? 'pack'}`} required error={form.formState.errors.conversionFactor}>
            <Input type="number" step="any" min={0} autoFocus {...form.register('conversionFactor', { valueAsNumber: true })} />
          </Field>
        )}
      </FormDialog>
    </>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <PermissionRoute permission="Products.View"><ProductDetail id={id} /></PermissionRoute>;
}
