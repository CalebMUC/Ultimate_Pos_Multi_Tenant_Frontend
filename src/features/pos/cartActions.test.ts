import { beforeEach, describe, expect, it } from 'vitest';
import { ItemType, PaymentMethod, PriceType, TaxClassification } from '@/api/enums';
import { emptyCart, useCartStore, type Cart } from '@/stores/cart';
import type { ProductDetailDto } from '@/api/dto/catalog';
import { addBundleToCart, addProductToCart, patchCart, removeLine, sellableUnits, toSaleRequest, updateBundle, updateLine } from './cartActions';

const product = (over: Partial<ProductDetailDto> = {}): ProductDetailDto => ({
  productId: 'p1', sku: 'MED-FG-000001', name: 'Amoxil', strength: '500mg', description: null, categoryId: 'c1', categoryName: 'Antibiotics',
  itemType: ItemType.FinishedGood, taxClassification: TaxClassification.Exempt, baseUnitOfMeasureId: 'pcs', baseUnitSymbol: 'pcs', reorderLevel: 0,
  barcode: null, isBatchTracked: true, requiresPrescription: true, genericName: null, dosageForm: null, manufacturer: null, isActive: true,
  unitConversions: [
    { productUnitConversionId: 'x1', packUnitOfMeasureId: 'box', conversionFactor: 10, isActive: true, packUnitSymbol: 'box' },
    { productUnitConversionId: 'x2', packUnitOfMeasureId: 'crate', conversionFactor: 100, isActive: false, packUnitSymbol: 'crate' },
  ],
  priceTiers: [{ productPriceTierId: 't1', unitOfMeasureId: 'pcs', priceType: PriceType.Retail, price: 20, effectiveFrom: '2026-01-01T00:00:00Z' }],
  ...over,
});

const cart = (over: Partial<Cart> = {}): Cart => ({ ...emptyCart(), ...over });

beforeEach(() => useCartStore.getState().clearAll());

describe('sellableUnits', () => {
  it('lists the base unit and active pack units only', () => {
    expect(sellableUnits(product()).map((u) => u.unitOfMeasureId)).toEqual(['pcs', 'box']);
  });
});

describe('addProductToCart', () => {
  it('bumps the quantity of an existing line instead of adding another', () => {
    addProductToCart('b1', product());
    addProductToCart('b1', product());
    const lines = useCartStore.getState().carts.b1.lines;
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(2);
    expect(lines[0].productName).toBe('Amoxil 500mg');
  });

  it('keeps carts apart per business', () => {
    addProductToCart('b1', product());
    expect(useCartStore.getState().carts.b2).toBeUndefined();
  });

  it('defaults to a priced unit when the base unit has no price', () => {
    addProductToCart('b1', product({ priceTiers: [{ productPriceTierId: 't', unitOfMeasureId: 'box', priceType: PriceType.Retail, price: 180, effectiveFrom: '2026-01-01' }] }), 1, PriceType.Retail);
    expect(useCartStore.getState().carts.b1.lines[0].unitOfMeasureId).toBe('box');
  });

  it('adds in the unit a quick key asks for, on its own line per unit', () => {
    addProductToCart('b1', product(), 2, null, 'box');
    addProductToCart('b1', product(), 3, null, 'pcs');
    addProductToCart('b1', product(), 1, null, 'box');
    const lines = useCartStore.getState().carts.b1.lines;
    expect(lines.map((l) => [l.unitOfMeasureId, l.quantity])).toEqual([['box', 3], ['pcs', 3]]);
  });

  it('falls back to the default unit when the asked unit is no longer sellable', () => {
    addProductToCart('b1', product(), 1, null, 'crate');
    expect(useCartStore.getState().carts.b1.lines[0].unitOfMeasureId).toBe('pcs');
  });
});

describe('containers sold with refills', () => {
  const water = product({
    productId: 'water', name: 'Water (refill)', strength: null, isBatchTracked: false, requiresPrescription: false, baseUnitOfMeasureId: 'l', baseUnitSymbol: 'l',
    unitConversions: [
      { productUnitConversionId: 'c20', packUnitOfMeasureId: '20L', conversionFactor: 20, isActive: true, packUnitSymbol: '20L',
        containerProductId: 'jerry', containerProductName: '20L Container', containerSku: 'CTN-20', containerUnitOfMeasureId: 'pcs', containerUnitSymbol: 'pcs', containerIsActive: true },
      { productUnitConversionId: 'c10', packUnitOfMeasureId: '10L', conversionFactor: 10, isActive: true, packUnitSymbol: '10L',
        containerProductId: 'old', containerProductName: 'Retired can', containerSku: 'CTN-10', containerUnitOfMeasureId: 'pcs', containerUnitSymbol: 'pcs', containerIsActive: false },
    ],
    priceTiers: [],
  });
  const lines = () => useCartStore.getState().carts.b1.lines;

  it('never adds a container that has been deactivated', () => {
    addProductToCart('b1', water, 1, null, '10L');
    patchCart('b1', { needsContainer: true });
    expect(lines().map((l) => l.productId)).toEqual(['water']);
  });

  it('sells the refill only while the customer has a container', () => {
    addProductToCart('b1', water, 2, null, '20L');
    expect(lines().map((l) => l.productId)).toEqual(['water']);
  });

  it('adds a container per refill when the customer has none, and keeps it in step', () => {
    addProductToCart('b1', water, 2, null, '20L');
    addProductToCart('b1', water, 3, null, 'l');
    patchCart('b1', { needsContainer: true });
    expect(lines().map((l) => [l.productId, l.unitOfMeasureId, l.quantity])).toEqual([['water', '20L', 2], ['jerry', 'pcs', 2], ['water', 'l', 3]]);

    updateLine('b1', lines()[0].key, { quantity: 4 });
    expect(lines()[1].quantity).toBe(4);
    expect(toSaleRequest(useCartStore.getState().carts.b1).lines.map((l) => [l.productId, l.quantity])).toEqual([['water', 4], ['jerry', 4], ['water', 3]]);

    removeLine('b1', lines()[0].key);
    expect(lines().map((l) => l.productId)).toEqual(['water']);
  });

  it('drops the container lines when the customer turns out to have one', () => {
    addProductToCart('b1', water, 1, null, '20L');
    patchCart('b1', { needsContainer: true });
    patchCart('b1', { needsContainer: false });
    expect(lines().map((l) => l.productId)).toEqual(['water']);
  });
});

describe('toSaleRequest', () => {
  const line = { key: 'k', productId: 'p1', productName: 'A', sku: 's', unitOfMeasureId: 'pcs', quantity: 2, discountAmount: null, discountPercent: 10, isBatchTracked: false, requiresPrescription: false, units: [] };

  it('never sends prices and sends only one kind of discount per line', () => {
    const body = toSaleRequest(cart({ lines: [{ ...line, discountAmount: 5, discountPercent: 10 }] }));
    expect(body.lines[0]).toEqual({ productId: 'p1', unitOfMeasureId: 'pcs', quantity: 2, discountAmount: 5, discountPercent: null });
    expect(JSON.stringify(body)).not.toMatch(/price/i);
  });

  it('sends only the payment detail that belongs to the method', () => {
    const payment = { amountTendered: 500, mpesaPhoneNumber: '0712345678', mpesaTransactionId: 'tx' };
    const cash = toSaleRequest(cart({ lines: [line], paymentMethod: PaymentMethod.Cash }), payment);
    expect([cash.amountTendered, cash.mpesaPhoneNumber, cash.mpesaTransactionId]).toEqual([500, null, null]);
    const stk = toSaleRequest(cart({ lines: [line], paymentMethod: PaymentMethod.MpesaStkPush }), payment);
    expect([stk.amountTendered, stk.mpesaPhoneNumber, stk.mpesaTransactionId]).toEqual([null, '0712345678', null]);
    const till = toSaleRequest(cart({ lines: [line], paymentMethod: PaymentMethod.MpesaTill }), payment);
    expect([till.amountTendered, till.mpesaPhoneNumber, till.mpesaTransactionId]).toEqual([null, null, 'tx']);
  });

  it('only overrides the credit limit on credit sales', () => {
    expect(toSaleRequest(cart({ lines: [line], paymentMethod: PaymentMethod.Cash, overrideCreditLimit: true })).overrideCreditLimit).toBe(false);
    expect(toSaleRequest(cart({ lines: [line], paymentMethod: PaymentMethod.Credit, overrideCreditLimit: true })).overrideCreditLimit).toBe(true);
  });

  it('includes a cleaned prescription only when asked', () => {
    const c = cart({ lines: [line], prescription: { patientName: ' Jane ', prescriberName: 'Dr K', prescriptionDate: '2026-10-01', prescriberFacility: '  ' } });
    expect(toSaleRequest(c).prescription).toBeNull();
    const rx = toSaleRequest(c, {}, true).prescription!;
    expect(rx.patientName).toBe('Jane');
    expect(rx.prescriberFacility).toBeNull();
    expect(rx.patientAgeYears).toBeNull();
  });
});

describe('bundles in the cart', () => {
  const hd20 = { productBundleId: 'hd20', name: '20L Heavy-duty bottle + water', code: 'HD20' };
  const bundles = () => useCartStore.getState().carts.b1.bundles ?? [];

  it('tapping the same bundle again adds to it, never a second entry', () => {
    addBundleToCart('b1', hd20);
    addBundleToCart('b1', hd20);
    expect(bundles()).toEqual([expect.objectContaining({ productBundleId: 'hd20', quantity: 2 })]);
  });

  it('sends bundles next to lines, with one kind of discount, and no bundles key content when there are none', () => {
    addBundleToCart('b1', hd20);
    updateBundle('b1', 'hd20', { discountAmount: 100, discountPercent: 5 });
    const body = toSaleRequest(useCartStore.getState().carts.b1);
    expect(body.bundles).toEqual([{ productBundleId: 'hd20', quantity: 1, discountAmount: 100, discountPercent: null }]);
    expect(toSaleRequest(cart()).bundles).toBeNull();
  });

  it('keeps quantities whole and drops a bundle set to zero', () => {
    addBundleToCart('b1', hd20);
    updateBundle('b1', 'hd20', { quantity: 2.7 });
    expect(bundles()[0].quantity).toBe(2);
    updateBundle('b1', 'hd20', { quantity: 0 });
    expect(bundles()).toEqual([]);
  });
});
