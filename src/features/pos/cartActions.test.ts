import { beforeEach, describe, expect, it } from 'vitest';
import { ItemType, PaymentMethod, PriceType, TaxClassification } from '@/api/enums';
import { emptyCart, useCartStore, type Cart } from '@/stores/cart';
import type { ProductDetailDto } from '@/api/dto/catalog';
import { addProductToCart, sellableUnits, toSaleRequest } from './cartActions';

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
