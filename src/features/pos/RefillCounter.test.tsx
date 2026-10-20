import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemType, PriceType, TaxClassification } from '@/api/enums';
import { API, ok, paged, renderWithProviders, signIn } from '@/test/render';
import type { ProductDetailDto } from '@/api/dto/catalog';
import type { ProductBundleDto } from '@/api/dto/bundles';
import { groupBundles } from './bundles';
import { RefillCounter } from './RefillCounter';

// AQUA HUB's list, as data: nothing here is known to the component.
const water: ProductDetailDto = {
  productId: 'water', sku: 'WTR-1', name: 'Purified Water', description: null, categoryId: 'cat-water', categoryName: 'Water Refill',
  itemType: ItemType.FinishedGood, taxClassification: TaxClassification.Exempt, baseUnitOfMeasureId: 'l', baseUnitSymbol: 'l', reorderLevel: 500,
  barcode: null, isBatchTracked: false, requiresPrescription: false, genericName: null, strength: null, dosageForm: null, manufacturer: null, isActive: true,
  unitConversions: [
    { productUnitConversionId: 'c20', packUnitOfMeasureId: '20L', conversionFactor: 20, isActive: true, packUnitSymbol: '20L' },
    { productUnitConversionId: 'c10', packUnitOfMeasureId: '10L', conversionFactor: 10, isActive: true, packUnitSymbol: '10L' },
  ],
  priceTiers: [
    { productPriceTierId: 't1', unitOfMeasureId: 'l', priceType: PriceType.Retail, price: 10, effectiveFrom: '2026-01-01T00:00:00Z' },
    { productPriceTierId: 't10', unitOfMeasureId: '10L', priceType: PriceType.Retail, price: 100, effectiveFrom: '2026-01-01T00:00:00Z' },
    { productPriceTierId: 't20', unitOfMeasureId: '20L', priceType: PriceType.Retail, price: 200, effectiveFrom: '2026-01-01T00:00:00Z' },
  ],
};
const part = (productName: string, baseUnitSymbol: string, quantityInBaseUnits: number) => ({
  productBundleComponentId: `${productName}-${quantityInBaseUnits}`, productId: productName, productName, sku: productName, productIsActive: true,
  unitOfMeasureId: baseUnitSymbol, unitSymbol: baseUnitSymbol, quantity: quantityInBaseUnits, quantityInBaseUnits, baseUnitSymbol, availableInBaseUnits: null,
});
const bundle = (name: string, code: string, price: number, available: number | null, ...components: ReturnType<typeof part>[]): ProductBundleDto => ({
  productBundleId: code, name, code, description: null, retailPrice: price, wholesalePrice: null, isActive: true, availableQuantity: available,
  components, createdAt: '2026-10-20T00:00:00Z', lastUpdatedAt: null,
});
const bundles = [
  bundle('1L bottle + water', 'B1', 30, 88, part('Purified Water', 'l', 1), part('1L bottle', 'pcs', 1)),
  bundle('Pack of 24 × 500ml', 'P24', 480, 3, part('Purified Water', 'l', 12), part('500ml bottle', 'pcs', 24)),
  bundle('20L Heavy-duty bottle + water', 'HD20', 1500, 0, part('Purified Water', 'l', 20), part('20L Heavy-duty bottle', 'pcs', 1)),
  bundle('20L Semi-flexible bottle + water', 'SF20', 1300, 12, part('Purified Water', 'l', 20), part('20L Semi-flexible bottle', 'pcs', 1)),
];

const server = setupServer(
  http.get(`${API}/categories/get-categories`, () => HttpResponse.json(ok([{ categoryId: 'cat-water', name: 'Water Refill', code: 'WTR', parentCategoryId: null, isActive: true, subcategories: [] }]))),
  http.get(`${API}/products/get-products`, () => HttpResponse.json(paged([water]))),
  http.get(`${API}/products/water`, () => HttpResponse.json(ok(water))),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => signIn(['Products.View', 'Categories.View', 'Stock.View']));

describe('grouping bundles', () => {
  it('puts single-bottle bundles under With bottle and the rest under Packs, most litres first', () => {
    const { withBottle, packs } = groupBundles(bundles);
    expect(withBottle.map((b) => b.code)).toEqual(['HD20', 'SF20', 'B1']);
    expect(packs.map((b) => b.code)).toEqual(['P24']);
  });
});

describe('refill counter', () => {
  function render(onTile = vi.fn(), list = bundles) {
    renderWithProviders(<RefillCounter businessId="b1" priceType={PriceType.Retail} bundles={list} bundlesLoading={false} keysEnabled onTile={onTile} />);
    return onTile;
  }

  it('builds the own-bottle sizes from the water product, smallest first', async () => {
    render();
    const own = within(screen.getByRole('region', { name: 'Own bottle' }));
    const tiles = await own.findAllByRole('button', { name: /KES/ });
    expect(tiles.map((t) => t.getAttribute('aria-label'))).toEqual(['l, KES 10.00', '10L, KES 100.00', '20L, KES 200.00']);
  });

  it('shows what can be sold, and an out-of-stock bottle as Out and disabled', async () => {
    const onTile = render();
    const withBottle = within(screen.getByRole('region', { name: 'With bottle' }));
    expect(withBottle.getByRole('button', { name: /20L Semi-flexible.*12 available/ })).toBeEnabled();
    const out = withBottle.getByRole('button', { name: /20L Heavy-duty.*out of stock/ });
    expect(out).toBeDisabled();
    await userEvent.click(withBottle.getByRole('button', { name: /20L Semi-flexible/ }));
    expect(onTile).toHaveBeenCalledWith(expect.objectContaining({ kind: 'bundle', bundle: expect.objectContaining({ code: 'SF20' }) }));
  });

  it('without Stock.View shows no counts and keeps every tile enabled', async () => {
    render(vi.fn(), bundles.map((b) => ({ ...b, availableQuantity: null })));
    const withBottle = within(screen.getByRole('region', { name: 'With bottle' }));
    for (const tile of withBottle.getAllByRole('button')) {
      expect(tile).toBeEnabled();
      expect(tile.getAttribute('aria-label')).not.toMatch(/available|out of stock/);
    }
  });

  it('keys 1–9 tap the tiles in order: own bottle first, then with bottle', async () => {
    const onTile = render();
    await screen.findAllByRole('button', { name: /^l, KES/ });
    await userEvent.keyboard('3');
    expect(onTile).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'unit', unitOfMeasureId: '20L' }));
    // 4 is the heavy-duty tile, which is out: nothing happens.
    onTile.mockClear();
    await userEvent.keyboard('4');
    expect(onTile).not.toHaveBeenCalled();
    await userEvent.keyboard('5');
    expect(onTile).toHaveBeenCalledWith(expect.objectContaining({ kind: 'bundle', bundle: expect.objectContaining({ code: 'SF20' }) }));
  });
});
