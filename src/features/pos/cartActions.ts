import { PaymentMethod, PriceType } from '@/api/enums';
import { emptyToNull } from '@/lib/utils';
import { emptyCart, newLineKey, useCartStore, type Cart, type CartLine } from '@/stores/cart';
import type { ProductDetailDto } from '@/api/dto/catalog';
import type { Guid } from '@/api/dto/common';
import type { CreateSaleRequestDto } from '@/api/dto/sales';

/** Units a product can be sold in: its base unit and its active pack units. */
export function sellableUnits(product: ProductDetailDto): CartLine['units'] {
  const units = [{ unitOfMeasureId: product.baseUnitOfMeasureId, symbol: product.baseUnitSymbol ?? 'unit' }];
  for (const c of product.unitConversions) {
    if (c.isActive && !units.some((u) => u.unitOfMeasureId === c.packUnitOfMeasureId)) {
      units.push({ unitOfMeasureId: c.packUnitOfMeasureId, symbol: c.packUnitSymbol ?? 'pack' });
    }
  }
  return units;
}

/** The base unit if it is priced, else the first priced unit. The preview reports a missing price. */
function defaultUnit(product: ProductDetailDto, priceType: PriceType | null): Guid {
  const priced = product.priceTiers.filter((t) => priceType === null || t.priceType === priceType).map((t) => t.unitOfMeasureId);
  if (priced.length === 0 || priced.includes(product.baseUnitOfMeasureId)) return product.baseUnitOfMeasureId;
  return priced[0];
}

/** Adds a product, or bumps the quantity of the line already holding it in the same unit. */
export function addProductToCart(businessId: Guid, product: ProductDetailDto, quantity = 1, priceType: PriceType | null = null) {
  const unitId = defaultUnit(product, priceType);
  useCartStore.getState().update(businessId, (cart) => {
    const existing = cart.lines.find((l) => l.productId === product.productId && l.unitOfMeasureId === unitId);
    if (existing) {
      return { ...cart, lines: cart.lines.map((l) => (l.key === existing.key ? { ...l, quantity: l.quantity + quantity } : l)) };
    }
    const line: CartLine = {
      key: newLineKey(),
      productId: product.productId,
      productName: product.strength ? `${product.name} ${product.strength}` : product.name,
      sku: product.sku,
      unitOfMeasureId: unitId,
      quantity,
      discountAmount: null,
      discountPercent: null,
      isBatchTracked: product.isBatchTracked,
      requiresPrescription: product.requiresPrescription,
      units: sellableUnits(product),
    };
    return { ...cart, lines: [...cart.lines, line] };
  });
}

export function updateLine(businessId: Guid, key: string, patch: Partial<CartLine>) {
  useCartStore.getState().update(businessId, (cart) => ({ ...cart, lines: cart.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
}

export function removeLine(businessId: Guid, key: string) {
  useCartStore.getState().update(businessId, (cart) => ({ ...cart, lines: cart.lines.filter((l) => l.key !== key) }));
}

export function patchCart(businessId: Guid, patch: Partial<Cart>) {
  useCartStore.getState().update(businessId, (cart) => ({ ...cart, ...patch }));
}

export function useCart(businessId: Guid | null): Cart {
  return useCartStore((s) => (businessId ? s.carts[businessId] : undefined)) ?? EMPTY;
}
const EMPTY = emptyCart();

export interface PaymentDetails {
  amountTendered?: number | null;
  mpesaPhoneNumber?: string | null;
  mpesaTransactionId?: Guid | null;
}

/** Builds the request body. Never carries prices: the API prices every line. */
export function toSaleRequest(cart: Cart, payment: PaymentDetails = {}, includePrescription = false): CreateSaleRequestDto {
  const p = cart.prescription;
  return {
    customerId: cart.customerId,
    paymentMethod: cart.paymentMethod,
    notes: emptyToNull(cart.notes),
    lines: cart.lines.map((l) => ({
      productId: l.productId,
      unitOfMeasureId: l.unitOfMeasureId,
      quantity: l.quantity,
      discountAmount: l.discountAmount || null,
      discountPercent: l.discountAmount ? null : l.discountPercent || null,
    })),
    amountTendered: cart.paymentMethod === PaymentMethod.Cash ? payment.amountTendered ?? null : null,
    mpesaPhoneNumber: cart.paymentMethod === PaymentMethod.MpesaStkPush ? emptyToNull(payment.mpesaPhoneNumber) : null,
    mpesaTransactionId: cart.paymentMethod === PaymentMethod.MpesaTill ? payment.mpesaTransactionId ?? null : null,
    discountAmount: cart.saleDiscountAmount || null,
    overrideCreditLimit: cart.paymentMethod === PaymentMethod.Credit ? cart.overrideCreditLimit : false,
    prescription: includePrescription
      ? {
          prescriptionNumber: emptyToNull(p.prescriptionNumber),
          prescriberName: p.prescriberName?.trim() ?? '',
          prescriberRegistrationNumber: emptyToNull(p.prescriberRegistrationNumber),
          prescriberFacility: emptyToNull(p.prescriberFacility),
          patientName: p.patientName?.trim() ?? '',
          patientPhoneNumber: emptyToNull(p.patientPhoneNumber),
          patientAgeYears: p.patientAgeYears ?? null,
          prescriptionDate: p.prescriptionDate ?? '',
          notes: emptyToNull(p.notes),
        }
      : null,
  };
}
