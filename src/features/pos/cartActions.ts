import { PaymentMethod, PriceType } from '@/api/enums';
import { emptyToNull } from '@/lib/utils';
import { emptyCart, newLineKey, useCartStore, type Cart, type CartLine } from '@/stores/cart';
import type { ProductDetailDto } from '@/api/dto/catalog';
import type { Guid } from '@/api/dto/common';
import type { CreateSaleRequestDto } from '@/api/dto/sales';

/** The container sold with the line's unit, as set on the product's unit conversion. */
export function containerOf(line: Pick<CartLine, 'unitOfMeasureId' | 'units'>) {
  return line.units.find((u) => u.unitOfMeasureId === line.unitOfMeasureId)?.container ?? null;
}

/**
 * The lines with a container line after every refill whose size names one, when the customer needs containers; without any container
 * lines otherwise. A container line follows its refill's quantity and keeps its own discount.
 */
export function withContainers(lines: CartLine[], needsContainer: boolean): CartLine[] {
  const refills = lines.filter((l) => !l.containerFor);
  if (!needsContainer) return refills;
  const out: CartLine[] = [];
  for (const line of refills) {
    out.push(line);
    const c = containerOf(line);
    if (!c) continue;
    const previous = lines.find((l) => l.containerFor === line.key);
    out.push({
      key: previous?.key ?? `${line.key}:container`,
      containerFor: line.key,
      productId: c.productId,
      productName: c.productName,
      sku: c.sku,
      unitOfMeasureId: c.unitOfMeasureId,
      quantity: line.quantity,
      discountAmount: previous?.discountAmount ?? null,
      discountPercent: previous?.discountPercent ?? null,
      isBatchTracked: false,
      requiresPrescription: false,
      units: [{ unitOfMeasureId: c.unitOfMeasureId, symbol: c.unitSymbol }],
    });
  }
  return out;
}

/** Every cart change goes through here, so container lines stay in step with their refills. */
function updateCart(businessId: Guid, fn: (cart: Cart) => Cart) {
  useCartStore.getState().update(businessId, (cart) => {
    const next = fn(cart);
    return { ...next, lines: withContainers(next.lines, !!next.needsContainer) };
  });
}

/** Units a product can be sold in: its base unit and its active pack units, with the (active) container each pack is sold with. */
export function sellableUnits(product: ProductDetailDto): CartLine['units'] {
  const units: CartLine['units'] = [{ unitOfMeasureId: product.baseUnitOfMeasureId, symbol: product.baseUnitSymbol ?? 'unit' }];
  for (const c of product.unitConversions) {
    if (c.isActive && !units.some((u) => u.unitOfMeasureId === c.packUnitOfMeasureId)) {
      const container = c.containerProductId && c.containerUnitOfMeasureId && c.containerIsActive !== false
        ? { productId: c.containerProductId, unitOfMeasureId: c.containerUnitOfMeasureId, productName: c.containerProductName ?? 'Container', sku: c.containerSku ?? '', unitSymbol: c.containerUnitSymbol ?? 'pcs' }
        : null;
      units.push({ unitOfMeasureId: c.packUnitOfMeasureId, symbol: c.packUnitSymbol ?? 'pack', container });
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

/**
 * Adds a product to the lines, or bumps the quantity of the line already holding it in the same unit. `unitId` picks the unit (a quick
 * key); a unit the product can no longer be sold in falls back to the default one.
 */
export function addLine(lines: CartLine[], product: ProductDetailDto, quantity = 1, priceType: PriceType | null = null, unitId?: Guid): CartLine[] {
  const units = sellableUnits(product);
  if (!unitId || !units.some((u) => u.unitOfMeasureId === unitId)) unitId = defaultUnit(product, priceType);
  const existing = lines.find((l) => !l.containerFor && l.productId === product.productId && l.unitOfMeasureId === unitId);
  if (existing) return lines.map((l) => (l.key === existing.key ? { ...l, quantity: l.quantity + quantity } : l));
  return [...lines, {
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
    units,
  }];
}

export function addProductToCart(businessId: Guid, product: ProductDetailDto, quantity = 1, priceType: PriceType | null = null, unitId?: Guid) {
  updateCart(businessId, (cart) => ({ ...cart, lines: addLine(cart.lines, product, quantity, priceType, unitId) }));
}

export function updateLine(businessId: Guid, key: string, patch: Partial<CartLine>) {
  updateCart(businessId, (cart) => ({ ...cart, lines: cart.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
}

export function removeLine(businessId: Guid, key: string) {
  updateCart(businessId, (cart) => ({ ...cart, lines: cart.lines.filter((l) => l.key !== key) }));
}

export function patchCart(businessId: Guid, patch: Partial<Cart>) {
  updateCart(businessId, (cart) => ({ ...cart, ...patch }));
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
