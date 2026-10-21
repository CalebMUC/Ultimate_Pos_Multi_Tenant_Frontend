'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle, Banknote, Boxes, ClipboardList, CornerDownRight, CreditCard, Minus, PauseCircle, Pill, Plus, ScanBarcode, Search, ShoppingCart,
  Smartphone, Trash2, UserPlus, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle, Badge, Card, Input, Label, NativeSelect, Skeleton, Textarea } from '@/components/ui/primitives';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays';
import { CustomerPicker } from '@/components/shared/Pickers';
import { MoneyText, ProductFlags } from '@/components/shared/Display';
import { EmptyState, FormAlert } from '@/components/shared/States';
import { productsApi } from '@/api/endpoints/catalog';
import { productBundlesApi } from '@/api/endpoints/bundles';
import { isApiError, normaliseError } from '@/api/errors';
import { ItemType, PaymentMethod, PriceType, SaleStatus, labels } from '@/api/enums';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { useActiveBusiness, usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateTime, formatMoney, formatQty, todayIso } from '@/lib/format';
import { cn } from '@/lib/utils';
import { isCartEmpty, useCartStore, type CartBundle } from '@/stores/cart';
import { usePreferences, type QuickKey } from '@/stores/preferences';
import { ContainerToggle, QuickKeys, QuickKeyToggle } from './QuickKeys';
import { CustomerFormDialog } from '@/features/customers/CustomerFormDialog';
import type { ProductDetailDto, ProductDto } from '@/api/dto/catalog';
import type { SaleDto, SalePreviewDto } from '@/api/dto/sales';
import type { ProductBundleDto } from '@/api/dto/bundles';
import { ReceiptDialog } from '@/features/sales/Receipt';
import { addBundleToCart, addProductToCart, patchCart, removeBundle, removeLine, updateBundle, updateLine, useCart } from './cartActions';
import { bundlePreview, bundlePrice, useActiveBundles } from './bundles';
import { RefillCounter, type CounterTile } from './RefillCounter';
import { PaymentDialog } from './PaymentDialog';
import { useSalePreview } from './usePreview';

const METHODS = [
  { value: PaymentMethod.Cash, icon: Banknote },
  { value: PaymentMethod.MpesaReference, icon: Smartphone },
  { value: PaymentMethod.MpesaStkPush, icon: Smartphone },
  { value: PaymentMethod.MpesaTill, icon: Smartphone },
  { value: PaymentMethod.Credit, icon: CreditCard },
] as const;

const NO_HELD: never[] = [];

export function PosPage() {
  const { activeBusinessId, business, hasModule } = useActiveBusiness();
  const businessId = activeBusinessId!;
  const cart = useCart(businessId);
  const held = useCartStore((s) => s.held[businessId]) ?? NO_HELD;
  // Actions only: reading them doesn't need a subscription.
  const store = useCartStore.getState();
  const qc = useQueryClient();
  const key = useQueryKey();
  const preview = useSalePreview(cart);
  const canDiscount = usePermission('Sales.ApplyDiscount');
  const canDispense = usePermission('Prescriptions.Dispense');
  const canRegisterCustomer = usePermission('Customers.Register');
  const quickSale = hasModule('containers');
  const bundlesOn = hasModule('bundles');
  // A refill station (bundles and containers): the counter's tiles replace the quick keys and the container toggle.
  const counterLayout = bundlesOn && quickSale;
  const activeBundles = useActiveBundles();
  const [paying, setPaying] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [receipt, setReceipt] = useState<SaleDto | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const p = preview.data;
  const empty = isCartEmpty(cart);
  // The preview lists the cart's lines in order, then one line per bundle part: match cart lines against the plain ones only.
  const plainLines = p?.lines.filter((l) => !l.productBundleId) ?? [];
  // A preview made for an older cart (still loading the new one) is shown dimmed and can't be charged.
  const previewCurrent = !!p && !preview.isPlaceholderData && !preview.isFetching
    && plainLines.length === cart.lines.length && (p.bundles?.length ?? 0) === (cart.bundles?.length ?? 0);
  const previewError = preview.error ? normaliseError(preview.error) : null;
  const needsRx = !!p?.requiresPrescription || cart.lines.some((l) => l.requiresPrescription);
  const rx = cart.prescription;
  const rxComplete = !!(rx.prescriberName?.trim() && rx.patientName?.trim() && rx.prescriptionDate);
  const creditNeedsCustomer = cart.paymentMethod === PaymentMethod.Credit && !cart.customerId;

  // Batch-tracked stock is never sold beyond unexpired lots; other stock only where the business allows selling below zero.
  // The API enforces both (409 INSUFFICIENT_STOCK); this stops the cashier before charging.
  const strictStock = business?.allowNegativeStock === false;
  const stockBlocks = !!p && p.lines.some((l) => !l.stockSufficient && (l.isBatchTracked || strictStock));

  const blockers: string[] = [];
  if (empty) blockers.push('Add at least one item.');
  if (stockBlocks) blockers.push('Some items are short of stock.');
  if (creditNeedsCustomer) blockers.push('A credit sale needs a customer.');
  if (needsRx && !canDispense) blockers.push('Only staff allowed to dispense can sell prescription-only items.');
  if (needsRx && canDispense && !rxComplete) blockers.push('Fill in the prescription: prescriber, patient and date.');
  const canCharge = previewCurrent && !previewError && blockers.length === 0;

  async function addProduct(product: ProductDto | ProductDetailDto, unitId?: string) {
    if (!product.isActive) {
      toast.error(`${product.name} is inactive.`);
      return;
    }
    if (product.itemType !== ItemType.FinishedGood) {
      toast.error(`${product.name} is a ${labels.itemType[product.itemType].toLowerCase()}: only finished goods can be sold.`);
      return;
    }
    try {
      const detail = 'priceTiers' in product
        ? product
        : await qc.fetchQuery({ queryKey: key('products', { detail: product.productId }), queryFn: () => productsApi.get(product.productId), staleTime: 60_000 });
      addProductToCart(businessId, detail, 1, p?.priceType ?? null, unitId);
    } catch (e) {
      toast.error(normaliseError(e).message);
    }
  }

  function addBundle(bundle: Pick<ProductBundleDto, 'productBundleId' | 'name' | 'code' | 'availableQuantity'>) {
    if (bundle.availableQuantity === 0) {
      toast.error(`${bundle.name} is out of stock.`);
      return;
    }
    addBundleToCart(businessId, bundle);
  }

  function onTile(tile: CounterTile) {
    if (tile.kind === 'bundle') addBundle(tile.bundle);
    else void addProduct(tile.product, tile.unitOfMeasureId);
  }

  // A bundle deactivated or removed since the list was loaded: refresh the tiles (the preview names it; the cashier removes it).
  const bundleGone = !!cart.bundles?.length && !!previewError && (previewError.code === 'INVALID_ASSIGNMENT' || previewError.code === 'NOT_FOUND');
  useEffect(() => {
    if (bundleGone) void qc.invalidateQueries({ queryKey: ['product-bundles'] });
  }, [bundleGone, qc]);

  async function addQuickKey(k: QuickKey) {
    try {
      const detail = await qc.fetchQuery({ queryKey: key('products', { detail: k.productId }), queryFn: () => productsApi.get(k.productId), staleTime: 60_000 });
      await addProduct(detail, k.unitOfMeasureId);
    } catch (e) {
      toast.error(normaliseError(e).message);
    }
  }

  function complete(sale: SaleDto) {
    setPaying(false);
    store.reset(businessId);
    setReceipt(sale);
    toast.success(`Sale ${sale.saleNumber} completed`);
    qc.invalidateQueries({ queryKey: ['sales'] });
    qc.invalidateQueries({ queryKey: ['stock'] });
    // Bundle counts and the water's stock change with every sale.
    qc.invalidateQueries({ queryKey: ['product-bundles'] });
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['mpesa-unmatched'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    // A sale can raise stock alerts, which the API's worker sends within about 5 s: check then rather than at the next poll.
    setTimeout(() => qc.invalidateQueries({ queryKey: ['notifications'] }), 6_000);
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function abandoned(sale: SaleDto) {
    setPaying(false);
    qc.invalidateQueries({ queryKey: ['sales'] });
    if (sale.status === SaleStatus.Pending) {
      store.reset(businessId);
      toast.info(`Sale ${sale.saleNumber} left pending. Check it later from Sales.`);
    }
  }

  // F2: search. F9: pay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'F9' && canCharge && !paying) {
        e.preventDefault();
        setPaying(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canCharge, paying]);

  return (
    <div className="-m-4 grid min-h-[calc(100vh-3.5rem)] md:-m-6 lg:grid-cols-[1fr_28rem]">
      {/* Products */}
      <section className="flex min-w-0 flex-col gap-3 p-4 md:p-5">
        {counterLayout ? (
          <RefillCounter
            businessId={businessId}
            priceType={p?.priceType ?? PriceType.Retail}
            bundles={activeBundles.data}
            bundlesLoading={activeBundles.isLoading}
            keysEnabled={!paying && !registering && !receipt}
            onTile={onTile}
          />
        ) : (
          quickSale && <QuickKeys businessId={businessId} onAdd={addQuickKey} />
        )}
        <ProductSearch
          inputRef={searchRef}
          onAdd={addProduct}
          bundles={bundlesOn ? activeBundles.data ?? [] : null}
          priceType={p?.priceType ?? PriceType.Retail}
          onAddBundle={addBundle}
          onEmptyEnter={() => canCharge && !paying && setPaying(true)}
        />
      </section>

      {/* Cart */}
      <section className="flex flex-col border-t bg-card lg:border-l lg:border-t-0">
        <div className="flex items-center gap-2 border-b p-3">
          <div className="min-w-0 flex-1">
            <CustomerPicker
              value={cart.customerId}
              selectedLabel={cart.customerName}
              clearable
              onChange={(id, c) => patchCart(businessId, { customerId: id, customerName: c?.customerName ?? null, overrideCreditLimit: false })}
            />
          </div>
          {canRegisterCustomer && (
            <Button variant="outline" size="icon" onClick={() => setRegistering(true)} aria-label="Register new customer" title="Register new customer">
              <UserPlus />
            </Button>
          )}
          <HeldCarts
            held={held}
            onHold={() => {
              store.hold(businessId, cart.customerName ?? `Walk-in ${new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}`);
              toast.success('Sale held');
            }}
            canHold={!empty}
            onRecall={(id) => store.recall(businessId, id)}
            onDiscard={(id) => store.discardHeld(businessId, id)}
          />
          <Button variant="ghost" size="icon" disabled={empty} onClick={() => store.reset(businessId)} aria-label="Clear cart" title="Clear cart">
            <Trash2 />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {empty ? (
            <EmptyState title="Cart is empty" message={counterLayout ? 'Tap a size or a bottle, or press 1–9. F2 jumps to search.' : 'Scan a barcode or search for a product. F2 jumps to search.'} className="py-16" />
          ) : (
            <ul className={cn('divide-y transition-opacity', !previewCurrent && p && 'opacity-80')}>
              {cart.lines.map((line, index) => {
                const pl = plainLines[index]?.productId === line.productId ? plainLines[index] : undefined;
                if (line.containerFor) {
                  return (
                    <li key={line.key} className="flex items-center gap-2 px-3 py-2 pl-6 text-sm">
                      <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">
                        {formatQty(line.quantity)} × {line.productName}
                        <span className="block text-xs text-muted-foreground">Container for the refill above</span>
                      </span>
                      {pl ? <MoneyText value={pl.lineTotal} className="text-sm font-semibold" /> : <Skeleton className="h-4 w-16" />}
                    </li>
                  );
                }
                return (
                  <li key={line.key} className="space-y-2 p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{line.productName}</p>
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {line.sku}
                          {pl && <> · @ {formatMoney(pl.unitPrice, { currency: false })}</>}
                          <ProductFlags requiresPrescription={line.requiresPrescription} isBatchTracked={line.isBatchTracked} />
                        </p>
                      </div>
                      <div className="text-right">
                        {pl ? <MoneyText value={pl.lineTotal} className="text-sm font-semibold" /> : <Skeleton className="h-4 w-16" />}
                        {pl && pl.discountAmount > 0 && <p className="text-xs text-success">−{formatMoney(pl.discountAmount, { currency: false })}</p>}
                      </div>
                      <Button variant="ghost" size="icon-sm" onClick={() => removeLine(businessId, line.key)} aria-label={`Remove ${line.productName}`}>
                        <X />
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center rounded-md border">
                        <Button variant="ghost" size="icon-sm" onClick={() => updateLine(businessId, line.key, { quantity: Math.max(1, line.quantity - 1) })} aria-label="Decrease">
                          <Minus />
                        </Button>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          value={line.quantity}
                          onChange={(e) => updateLine(businessId, line.key, { quantity: Math.max(0, Number(e.target.value)) })}
                          className="h-8 w-16 border-0 text-center shadow-none tabular"
                          aria-label="Quantity"
                        />
                        <Button variant="ghost" size="icon-sm" onClick={() => updateLine(businessId, line.key, { quantity: line.quantity + 1 })} aria-label="Increase">
                          <Plus />
                        </Button>
                      </div>
                      {line.units.length > 1 ? (
                        <NativeSelect
                          value={line.unitOfMeasureId}
                          onChange={(e) => updateLine(businessId, line.key, { unitOfMeasureId: e.target.value })}
                          className="h-8 w-24"
                          aria-label="Unit"
                        >
                          {line.units.map((u) => <option key={u.unitOfMeasureId} value={u.unitOfMeasureId}>{u.symbol}</option>)}
                        </NativeSelect>
                      ) : (
                        <span className="text-xs text-muted-foreground">{line.units[0]?.symbol}</span>
                      )}
                      {quickSale && <QuickKeyToggle businessId={businessId} line={line} />}
                      {canDiscount && (
                        <div className="ml-auto flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Disc %"
                            value={line.discountPercent ?? ''}
                            onChange={(e) => updateLine(businessId, line.key, { discountPercent: e.target.value === '' ? null : Number(e.target.value), discountAmount: null })}
                            className="h-8 w-20"
                            aria-label="Discount percent"
                          />
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Disc KES"
                            value={line.discountAmount ?? ''}
                            onChange={(e) => updateLine(businessId, line.key, { discountAmount: e.target.value === '' ? null : Number(e.target.value), discountPercent: null })}
                            className="h-8 w-24"
                            aria-label="Discount amount"
                          />
                        </div>
                      )}
                    </div>
                    {pl && !pl.stockSufficient && (
                      <p className={cn('flex items-center gap-1 text-xs', line.isBatchTracked || strictStock ? 'text-destructive' : 'text-warning-foreground dark:text-warning')}>
                        <AlertTriangle className="size-3.5 shrink-0" />
                        Only {formatQty(Math.max(0, pl.availableInBaseUnits), line.units[0]?.symbol)} in stock{line.isBatchTracked ? ' (unexpired)' : ''}; needs {formatQty(pl.requiredInBaseUnits, line.units[0]?.symbol)}.
                        {!line.isBatchTracked && !strictStock && ' Stock will show below zero.'}
                      </p>
                    )}
                  </li>
                );
              })}
              {(cart.bundles ?? []).map((b) => (
                <BundleRow
                  key={b.productBundleId}
                  businessId={businessId}
                  bundle={b}
                  preview={p}
                  strictStock={strictStock}
                  canDiscount={canDiscount}
                />
              ))}
            </ul>
          )}

          {needsRx && cart.lines.length > 0 && (
            <PrescriptionSection businessId={businessId} canDispense={canDispense} />
          )}
        </div>

        {/* Totals and payment */}
        <div className="space-y-3 border-t p-3">
          {!counterLayout && (
            <ContainerToggle
              lines={cart.lines}
              needsContainer={!!cart.needsContainer}
              onChange={(needsContainer) => patchCart(businessId, { needsContainer })}
            />
          )}
          {previewError && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertDescription>{previewError.message}</AlertDescription>
            </Alert>
          )}
          {canDiscount && !empty && (
            <div className="flex items-center gap-2">
              <Label htmlFor="sale-discount" className="flex-1 text-xs text-muted-foreground">
                Discount on sale (KES){business?.maxDiscountPercent != null && ` · max ${business.maxDiscountPercent}%`}
              </Label>
              <Input
                id="sale-discount"
                type="number"
                min={0}
                step="0.01"
                value={cart.saleDiscountAmount ?? ''}
                onChange={(e) => patchCart(businessId, { saleDiscountAmount: e.target.value === '' ? null : Number(e.target.value) })}
                className="h-8 w-28"
              />
            </div>
          )}
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular">{p ? formatMoney(p.subtotal) : '—'}</dd></div>
            {p && p.discountTotal > 0 && (
              <div className="flex justify-between text-success"><dt>Discount</dt><dd className="tabular">−{formatMoney(p.discountTotal)}</dd></div>
            )}
            {business?.isVatRegistered && (
              <div className="flex justify-between"><dt className="text-muted-foreground">VAT (included)</dt><dd className="tabular">{p ? formatMoney(p.taxTotal) : '—'}</dd></div>
            )}
            <div className="flex items-baseline justify-between pt-1">
              <dt className="font-semibold">Total</dt>
              <dd className="text-3xl font-bold tabular">{!empty && p ? formatMoney(p.totalAmount) : formatMoney(0)}</dd>
            </div>
            {p && <p className="text-right text-xs text-muted-foreground">{labels.priceType[p.priceType]} prices</p>}
          </dl>

          <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Payment method">
            {METHODS.map(({ value, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={cart.paymentMethod === value}
                onClick={() => patchCart(businessId, { paymentMethod: value, overrideCreditLimit: false })}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[11px] font-medium transition-colors',
                  cart.paymentMethod === value ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent',
                )}
              >
                <Icon className="size-4" />
                {labels.paymentMethod[value]}
              </button>
            ))}
          </div>

          {blockers.length > 0 && !empty && (
            <ul className="space-y-0.5 text-xs text-warning-foreground dark:text-warning">
              {blockers.map((b) => <li key={b} className="flex items-center gap-1"><AlertTriangle className="size-3" />{b}</li>)}
            </ul>
          )}

          <Button size="xl" variant="success" className="w-full" disabled={!canCharge} onClick={() => setPaying(true)}>
            <ShoppingCart />Charge {p && !empty ? formatMoney(p.totalAmount) : ''}
            <kbd className="ml-auto rounded bg-black/15 px-1.5 text-xs">F9</kbd>
          </Button>
        </div>
      </section>

      {p && (
        <PaymentDialog
          open={paying}
          onOpenChange={setPaying}
          cart={cart}
          preview={p}
          includePrescription={needsRx}
          onOverrideCreditLimit={(v) => patchCart(businessId, { overrideCreditLimit: v })}
          onCompleted={complete}
          onAbandoned={abandoned}
        />
      )}
      <CustomerFormDialog
        open={registering}
        onOpenChange={setRegistering}
        quick
        onSaved={(c) => patchCart(businessId, { customerId: c.customerId, customerName: c.customerName, overrideCreditLimit: false })}
      />
      <ReceiptDialog
        sale={receipt}
        open={!!receipt}
        onOpenChange={(o) => !o && setReceipt(null)}
        title={receipt ? `Sale ${receipt.saleNumber} complete` : 'Receipt'}
        actions={<Button variant="outline" onClick={() => setReceipt(null)}>New sale</Button>}
      />
    </div>
  );
}

/**
 * Search box that also takes barcode scans: Enter tries a bundle code, then an exact barcode/SKU lookup. Enter on an empty box opens
 * Pay. Where the business uses bundles, matching bundles show in the results with a Bundle badge.
 */
function ProductSearch({ inputRef, onAdd, bundles, priceType, onAddBundle, onEmptyEnter }: {
  inputRef: React.RefObject<HTMLInputElement>;
  onAdd(p: ProductDto | ProductDetailDto): void;
  /** Active bundles, or null where the business doesn't use them. */
  bundles: ProductBundleDto[] | null;
  priceType: PriceType;
  onAddBundle(b: ProductBundleDto): void;
  onEmptyEnter(): void;
}) {
  const [text, setText] = useState('');
  const [looking, setLooking] = useState(false);
  const scannerSuffix = usePreferences((s) => s.scannerSuffix);
  const debounced = useDebouncedValue(text.trim(), 250);
  const key = useQueryKey();
  const results = useQuery({
    queryKey: key('products', { pos: true, search: debounced }),
    queryFn: ({ signal }) => productsApi.list({ search: debounced || undefined, isActive: true, itemType: ItemType.FinishedGood, pageSize: 24, sortBy: 'name' }, signal),
    staleTime: 60_000,
  });
  const bundleResults = useQuery({
    queryKey: key('product-bundles', { isActive: true, search: debounced }),
    queryFn: ({ signal }) => productBundlesApi.list({ isActive: true, search: debounced }, signal),
    enabled: bundles !== null && debounced.length > 0,
    staleTime: 30_000,
  });
  const matchingBundles = debounced ? bundleResults.data ?? [] : [];

  useEffect(() => inputRef.current?.focus(), [inputRef]);

  async function onEnter() {
    const code = text.trim();
    if (!code) return onEmptyEnter();
    // A bundle code (HD20) adds the bundle.
    const bundle = bundles?.find((b) => b.code && b.code.toUpperCase() === code.toUpperCase())
      ?? matchingBundles.find((b) => b.code && b.code.toUpperCase() === code.toUpperCase());
    if (bundle) {
      onAddBundle(bundle);
      setText('');
      return;
    }
    setLooking(true);
    try {
      const product = await productsApi.lookup(code);
      onAdd(product);
      setText('');
    } catch (e) {
      if (isApiError(e, 'NOT_FOUND') || normaliseError(e).status === 404) {
        // Not a code: if the search shows exactly one product, take it.
        const only = results.data?.items.length === 1 && debounced === code ? results.data.items[0] : null;
        if (only) {
          onAdd(only);
          setText('');
        } else if (!results.data?.items.length) toast.error(`No product matches “${code}”.`);
      } else toast.error(normaliseError(e).message);
    } finally {
      setLooking(false);
    }
  }

  return (
    <>
      <div className="relative">
        <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || (e.key === 'Tab' && scannerSuffix === 'Tab' && text.trim())) {
              e.preventDefault();
              void onEnter();
            }
            if (e.key === 'Escape') setText('');
          }}
          placeholder="Scan a barcode, or search by name, SKU or generic name…"
          className="h-12 pl-10 pr-16 text-base"
          aria-label="Product search"
          autoComplete="off"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{looking ? 'Looking…' : 'F2'}</span>
      </div>
      {results.isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : results.error ? (
        <FormAlert error={results.error} />
      ) : results.data?.items.length === 0 && matchingBundles.length === 0 ? (
        <EmptyState title="No products found" message={debounced ? `Nothing matches “${debounced}”.` : 'No finished goods to sell yet.'} />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {matchingBundles.map((b) => {
            const out = b.availableQuantity === 0;
            return (
              <button
                key={b.productBundleId}
                type="button"
                disabled={out}
                onClick={() => onAddBundle(b)}
                className={cn(
                  'flex min-h-20 flex-col justify-between gap-1 rounded-lg border bg-card p-3 text-left shadow-sm transition-colors',
                  out ? 'cursor-not-allowed border-dashed opacity-60' : 'hover:border-primary hover:bg-accent/40 active:scale-[0.99]',
                )}
              >
                <span className="line-clamp-2 text-sm font-medium leading-snug">{b.name}</span>
                <span className="flex items-center justify-between gap-1 text-xs text-muted-foreground">
                  <span className="truncate tabular">{formatMoney(bundlePrice(b, priceType), { currency: false })}{out ? ' · Out' : b.availableQuantity != null ? ` · ${b.availableQuantity}` : ''}</span>
                  <Badge variant="info"><Boxes className="size-3" />Bundle</Badge>
                </span>
              </button>
            );
          })}
          {results.data?.items.map((p) => (
            <button
              key={p.productId}
              type="button"
              onClick={() => onAdd(p)}
              className="flex min-h-20 flex-col justify-between gap-1 rounded-lg border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary hover:bg-accent/40 active:scale-[0.99]"
            >
              <span className="line-clamp-2 text-sm font-medium leading-snug">{p.name}{p.strength ? ` ${p.strength}` : ''}</span>
              <span className="flex items-center justify-between gap-1 text-xs text-muted-foreground">
                <span className="truncate">{p.sku}</span>
                <ProductFlags requiresPrescription={p.requiresPrescription} isBatchTracked={p.isBatchTracked} />
              </span>
            </button>
          ))}
        </div>
      )}
      {results.data && results.data.meta.totalCount > results.data.items.length && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground"><Search className="size-3" />Showing {results.data.items.length} of {results.data.meta.totalCount}. Type to narrow down.</p>
      )}
    </>
  );
}

function PrescriptionSection({ businessId, canDispense }: { businessId: string; canDispense: boolean }) {
  const cart = useCart(businessId);
  const rx = cart.prescription;
  const set = (patch: Partial<typeof rx>) => patchCart(businessId, { prescription: { ...rx, ...patch } });
  if (!canDispense) {
    return (
      <div className="p-3">
        <Alert variant="destructive">
          <Pill />
          <AlertTitle>Prescription-only items</AlertTitle>
          <AlertDescription>A pharmacist (Prescriptions.Dispense) must make this sale.</AlertDescription>
        </Alert>
      </div>
    );
  }
  return (
    <Card className="m-3 border-destructive/30">
      <div className="space-y-3 p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold"><Pill className="size-4 text-destructive" />Prescription</p>
        <div className="grid grid-cols-2 gap-2">
          <RxInput label="Patient name *" value={rx.patientName} onChange={(v) => set({ patientName: v })} />
          <RxInput label="Patient phone" value={rx.patientPhoneNumber} onChange={(v) => set({ patientPhoneNumber: v })} />
          <RxInput label="Patient age" type="number" value={rx.patientAgeYears?.toString()} onChange={(v) => set({ patientAgeYears: v === '' ? null : Number(v) })} />
          <RxInput label="Prescription date *" type="date" max={todayIso()} value={rx.prescriptionDate} onChange={(v) => set({ prescriptionDate: v })} />
          <RxInput label="Prescriber name *" value={rx.prescriberName} onChange={(v) => set({ prescriberName: v })} />
          <RxInput label="Prescriber reg. no." value={rx.prescriberRegistrationNumber} onChange={(v) => set({ prescriberRegistrationNumber: v })} />
          <RxInput label="Facility" value={rx.prescriberFacility} onChange={(v) => set({ prescriberFacility: v })} />
          <RxInput label="Rx number" value={rx.prescriptionNumber} onChange={(v) => set({ prescriptionNumber: v })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Notes</Label>
          <Textarea value={rx.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} className="min-h-[48px]" />
        </div>
      </div>
    </Card>
  );
}

function RxInput({ label, value, onChange, type = 'text', max }: { label: string; value: string | null | undefined; onChange(v: string): void; type?: string; max?: string }) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium">{label}</span>
      <Input type={type} max={max} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="h-8" />
    </label>
  );
}

function HeldCarts({ held, onHold, canHold, onRecall, onDiscard }: {
  held: { id: string; heldAt: string; label: string; cart: { lines: unknown[] } }[];
  onHold(): void;
  canHold: boolean;
  onRecall(id: string): void;
  onDiscard(id: string): void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Held sales" title="Hold / recall" className="relative">
          <PauseCircle />
          {held.length > 0 && <Badge className="absolute -right-1.5 -top-1.5 h-4 min-w-4 justify-center bg-primary px-1 text-[10px] text-primary-foreground">{held.length}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2">
        <Button className="w-full" size="sm" disabled={!canHold} onClick={() => { onHold(); setOpen(false); }}>
          <PauseCircle />Hold this sale
        </Button>
        {held.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">No held sales.</p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {held.map((h) => (
              <li key={h.id} className="flex items-center gap-1 rounded-md border p-2 text-sm">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { onRecall(h.id); setOpen(false); }}>
                  <span className="flex items-center gap-1 truncate font-medium"><ClipboardList className="size-3.5" />{h.label}</span>
                  <span className="text-xs text-muted-foreground">{h.cart.lines.length} item(s) · {formatDateTime(h.heldAt)}</span>
                </button>
                <Button variant="ghost" size="icon-sm" onClick={() => onDiscard(h.id)} aria-label="Discard held sale"><Trash2 /></Button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * A bundle on the cart: one row, its quantity (whole numbers) and the server's total. Red when any part is short, naming the part with
 * the figures the preview gave. The parts are not listed here; the sale detail shows them.
 */
function BundleRow({ businessId, bundle, preview, strictStock, canDiscount }: {
  businessId: string;
  bundle: CartBundle;
  preview: SalePreviewDto | undefined;
  strictStock: boolean;
  canDiscount: boolean;
}) {
  const { summary, short } = bundlePreview(preview, bundle.productBundleId);
  const blocking = short.some((l) => l.isBatchTracked || strictStock);
  return (
    <li className={cn('space-y-2 p-3', short.length > 0 && blocking && 'bg-destructive/5')}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium"><Boxes className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />{bundle.name}</p>
          {bundle.code && <p className="text-xs text-muted-foreground">{bundle.code}</p>}
        </div>
        <div className="text-right">
          {summary ? <MoneyText value={summary.total} className="text-sm font-semibold" /> : <Skeleton className="h-4 w-16" />}
          {summary && summary.discountAmount > 0 && <p className="text-xs text-success">−{formatMoney(summary.discountAmount, { currency: false })}</p>}
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => removeBundle(businessId, bundle.productBundleId)} aria-label={`Remove ${bundle.name}`}>
          <X />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-md border">
          <Button variant="ghost" size="icon-sm" onClick={() => updateBundle(businessId, bundle.productBundleId, { quantity: Math.max(1, bundle.quantity - 1) })} aria-label="Decrease">
            <Minus />
          </Button>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={bundle.quantity}
            // Whole bundles only; clearing the box keeps 1 rather than removing the row (× removes it).
            onChange={(e) => updateBundle(businessId, bundle.productBundleId, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
            className="h-8 w-16 border-0 text-center shadow-none tabular"
            aria-label={`Quantity of ${bundle.name}`}
          />
          <Button variant="ghost" size="icon-sm" onClick={() => updateBundle(businessId, bundle.productBundleId, { quantity: bundle.quantity + 1 })} aria-label="Increase">
            <Plus />
          </Button>
        </div>
        {canDiscount && (
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="Disc KES"
            value={bundle.discountAmount ?? ''}
            onChange={(e) => updateBundle(businessId, bundle.productBundleId, { discountAmount: e.target.value === '' ? null : Number(e.target.value), discountPercent: null })}
            className="ml-auto h-8 w-24"
            aria-label={`Discount on ${bundle.name}`}
          />
        )}
      </div>
      {short.map((l) => (
        <p key={`${l.productId}:${l.unitOfMeasureId}`} className={cn('flex items-center gap-1 text-xs', blocking ? 'text-destructive' : 'text-warning-foreground dark:text-warning')}>
          <AlertTriangle className="size-3.5 shrink-0" />
          {l.productName}: only {formatQty(Math.max(0, l.availableInBaseUnits))} in stock; needs {formatQty(l.requiredInBaseUnits)}.
        </p>
      ))}
    </li>
  );
}
