'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { Skeleton } from '@/components/ui/primitives';
import { ProductPicker } from '@/components/shared/Pickers';
import { FormAlert } from '@/components/shared/States';
import { productsApi } from '@/api/endpoints/catalog';
import { ItemType, PriceType } from '@/api/enums';
import { flattenCategories, useCategories } from '@/hooks/useLookups';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatMoney, formatQty } from '@/lib/format';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';
import type { ProductDetailDto, ProductPriceTierDto } from '@/api/dto/catalog';
import type { ProductBundleDto } from '@/api/dto/bundles';
import { bundlePrice, groupBundles } from './bundles';

type UnitTileData = { kind: 'unit'; key: string; product: ProductDetailDto; unitOfMeasureId: string; symbol: string; price: number };
type BundleTileData = { kind: 'bundle'; key: string; bundle: ProductBundleDto };
/** One tap on the counter: a water size into the customer's own bottle, or a bundle. */
export type CounterTile = UnitTileData | BundleTileData;

/** The tier in force now for this unit and price list; wholesale falls back to retail, as the API does when there is none. */
function tierPrice(tiers: ProductPriceTierDto[], unitId: string, priceType: PriceType): number | null {
  const now = Date.now();
  const latest = (type: PriceType) =>
    tiers
      .filter((t) => t.unitOfMeasureId === unitId && t.priceType === type && Date.parse(t.effectiveFrom) <= now)
      .sort((a, b) => Date.parse(b.effectiveFrom) - Date.parse(a.effectiveFrom))[0]?.price ?? null;
  return latest(priceType) ?? (priceType === PriceType.Wholesale ? latest(PriceType.Retail) : null);
}

/**
 * The water product whose sizes are the "own bottle" tiles: the one the owner picked on this device, else the product in the business's
 * "Water Refill" category. Nothing is hard-coded: names, sizes and prices all come from the product.
 */
function useWaterProduct(businessId: string) {
  const key = useQueryKey();
  const picked = usePreferences((s) => s.counterWaterProduct[businessId]);
  const categories = useCategories();
  const waterCategory = useMemo(
    () => flattenCategories(categories.data).find((c) => c.isActive && /water\s*refill/i.test(c.name)) ?? null,
    [categories.data],
  );
  const found = useQuery({
    queryKey: key('products', { counterWater: waterCategory?.categoryId }),
    queryFn: () => productsApi.list({ categoryId: waterCategory!.categoryId, isActive: true, itemType: ItemType.FinishedGood, pageSize: 1, sortBy: 'name' }),
    enabled: !picked && !!waterCategory,
    staleTime: 5 * 60_000,
  });
  const productId = picked ?? found.data?.items[0]?.productId ?? null;
  const detail = useQuery({
    queryKey: key('products', { detail: productId }),
    queryFn: () => productsApi.get(productId!),
    enabled: !!productId,
    staleTime: 60_000,
  });
  return { productId, product: detail.data ?? null, isLoading: categories.isLoading || found.isLoading || detail.isLoading, error: detail.error };
}

/** Own-bottle tiles: every unit of the water product with a price, smallest first. */
function unitTiles(product: ProductDetailDto | null, priceType: PriceType): UnitTileData[] {
  if (!product?.isActive) return [];
  const units = [
    { unitOfMeasureId: product.baseUnitOfMeasureId, symbol: product.baseUnitSymbol ?? 'unit', factor: 1 },
    ...product.unitConversions.filter((c) => c.isActive).map((c) => ({ unitOfMeasureId: c.packUnitOfMeasureId, symbol: c.packUnitSymbol ?? 'pack', factor: c.conversionFactor })),
  ].sort((a, b) => a.factor - b.factor);
  return units.flatMap((u) => {
    // Shown only for a unit with a Retail price; the price shown is the customer's list, the preview is what is charged.
    if (tierPrice(product.priceTiers, u.unitOfMeasureId, PriceType.Retail) === null) return [];
    const price = tierPrice(product.priceTiers, u.unitOfMeasureId, priceType) ?? 0;
    return [{ kind: 'unit' as const, key: `u:${u.unitOfMeasureId}`, product, unitOfMeasureId: u.unitOfMeasureId, symbol: u.symbol, price }];
  });
}

/**
 * The refill-station counter: OWN BOTTLE (water sizes), WITH BOTTLE (bottle + water bundles) and PACKS. Tap adds one; keys 1–9 tap
 * the tiles in order when no input has focus. Tiles show the bundle's available count and are disabled at 0 ("Out").
 */
export function RefillCounter({ businessId, priceType, bundles, bundlesLoading, keysEnabled, onTile }: {
  businessId: string;
  priceType: PriceType;
  bundles: ProductBundleDto[] | undefined;
  bundlesLoading: boolean;
  /** Off while a dialog is open. */
  keysEnabled: boolean;
  onTile(tile: CounterTile): void;
}) {
  const water = useWaterProduct(businessId);
  const [choosing, setChoosing] = useState(false);
  const own = unitTiles(water.product, priceType);
  const { withBottle, packs } = groupBundles(bundles ?? []);
  const toTile = (b: ProductBundleDto): BundleTileData => ({ kind: 'bundle', key: `b:${b.productBundleId}`, bundle: b });
  const withTiles = withBottle.map(toTile);
  const packTiles = packs.map(toTile);
  const ordered: CounterTile[] = [...own, ...withTiles, ...packTiles];
  const number = (tile: CounterTile) => ordered.indexOf(tile) + 1;
  const disabled = (tile: CounterTile) => tile.kind === 'bundle' && tile.bundle.availableQuantity === 0;

  useEffect(() => {
    if (!keysEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.ctrlKey || e.altKey || e.metaKey || !/^[1-9]$/.test(e.key)) return;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      const tile = ordered[Number(e.key) - 1];
      if (!tile || disabled(tile)) return;
      e.preventDefault();
      onTile(tile);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="space-y-3" aria-label="Counter">
      <Row
        title="Own bottle"
        action={<Button variant="ghost" size="icon-sm" onClick={() => setChoosing(true)} aria-label="Choose the water product" title="Choose the water product"><Settings2 /></Button>}
      >
        {water.isLoading ? (
          <TileSkeletons count={3} />
        ) : own.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {water.productId ? 'The water product has no priced sizes yet.' : 'No water product found.'}{' '}
            <button type="button" className="text-primary underline" onClick={() => setChoosing(true)}>Choose it</button>
          </p>
        ) : (
          own.map((t) => <Tile key={t.key} n={number(t)} title={t.symbol} price={t.price} onClick={() => onTile(t)} />)
        )}
      </Row>
      {(bundlesLoading || withBottle.length > 0) && (
        <Row title="With bottle">
          {bundlesLoading ? <TileSkeletons count={4} /> : withTiles.map((t) => <BundleTile key={t.key} tile={t} n={number(t)} priceType={priceType} onTile={onTile} />)}
        </Row>
      )}
      {packTiles.length > 0 && (
        <Row title="Packs">
          {packTiles.map((t) => <BundleTile key={t.key} tile={t} n={number(t)} priceType={priceType} onTile={onTile} />)}
        </Row>
      )}
      {choosing && <WaterProductDialog businessId={businessId} current={water.product} onClose={() => setChoosing(false)} />}
    </div>
  );
}

function Row({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border p-3" aria-label={title}>
      <h2 className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}{action}</h2>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

function TileSkeletons({ count }: { count: number }) {
  return <>{Array.from({ length: count }).map((_, i) => <Skeleton key={i} className="h-16 w-28" />)}</>;
}

function Tile({ n, title, subtitle, price, count, out, onClick }: {
  n: number; title: string; subtitle?: string | null; price: number; count?: number | null; out?: boolean; onClick(): void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={out}
      className={cn(
        'relative flex min-h-16 min-w-28 max-w-56 flex-col items-start justify-center rounded-lg border-2 bg-card px-3 py-2 text-left transition-colors',
        out ? 'cursor-not-allowed border-dashed opacity-60' : 'border-primary/40 hover:border-primary hover:bg-primary/5 active:scale-[0.98]',
      )}
      aria-label={`${title}${subtitle ? ` (${subtitle})` : ''}, ${formatMoney(price)}${out ? ', out of stock' : count != null ? `, ${count} available` : ''}`}
    >
      {n <= 9 && <span className="absolute right-1.5 top-1 text-[10px] text-muted-foreground">{n}</span>}
      <span className="line-clamp-2 pr-3 text-sm font-semibold leading-tight">{title}</span>
      {subtitle && <span className="text-[11px] text-muted-foreground">{subtitle}</span>}
      <span className="mt-0.5 flex items-baseline gap-1.5 text-sm tabular">
        {formatMoney(price, { currency: false })}
        {out ? <span className="text-xs font-semibold text-destructive">Out</span> : count != null && <span className="text-xs text-muted-foreground">· {formatQty(count)}</span>}
      </span>
    </button>
  );
}

function BundleTile({ tile, n, priceType, onTile }: { tile: BundleTileData; n: number; priceType: PriceType; onTile(t: CounterTile): void }) {
  const b = tile.bundle;
  return (
    <Tile
      n={n}
      title={b.name}
      subtitle={b.code}
      price={bundlePrice(b, priceType)}
      count={b.availableQuantity}
      out={b.availableQuantity === 0}
      onClick={() => onTile(tile)}
    />
  );
}

/** The owner picks the water product once; saved on this device for this business. */
function WaterProductDialog({ businessId, current, onClose }: { businessId: string; current: ProductDetailDto | null; onClose(): void }) {
  const [picked, setPicked] = useState<{ id: string | null; name: string | null }>({ id: current?.productId ?? null, name: current?.name ?? null });
  const [error, setError] = useState<unknown>(null);
  function save() {
    if (!picked.id) return setError(new Error('Pick the water product.'));
    const { counterWaterProduct, set } = usePreferences.getState();
    set('counterWaterProduct', { ...counterWaterProduct, [businessId]: picked.id });
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Water product</DialogTitle>
          <DialogDescription>Its priced sizes become the Own bottle tiles. Saved on this device.</DialogDescription>
        </DialogHeader>
        <ProductPicker value={picked.id} selectedLabel={picked.name} filter={{ itemType: ItemType.FinishedGood }} onChange={(id, p) => setPicked({ id, name: p?.name ?? null })} />
        <FormAlert error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
