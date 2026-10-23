import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DeliveryMode, PaymentMethod } from '@/api/enums';
import type { Guid } from '@/api/dto/common';
import type { SalePrescriptionRequestDto } from '@/api/dto/sales';

/** A product sold in its base unit alongside a refill (an empty 20L container), when the customer has none of their own. */
export interface ContainerProduct { productId: Guid; unitOfMeasureId: Guid; productName: string; sku: string; unitSymbol: string }
export interface SellableUnit { unitOfMeasureId: Guid; symbol: string; container?: ContainerProduct | null }

// The POS cart. Never stores prices: the API prices every line through /sales/preview.
export interface CartLine {
  key: string;
  productId: Guid;
  productName: string;
  sku: string;
  unitOfMeasureId: Guid;
  quantity: number;
  discountAmount: number | null;
  discountPercent: number | null;
  isBatchTracked: boolean;
  requiresPrescription: boolean;
  /** Base unit plus active pack units: the units this line may be sold in, each with the container sold with it (if any). */
  units: SellableUnit[];
  /** A container sold with the refill line of this key. Added and kept in step by cartActions; not edited on its own. */
  containerFor?: string;
}

/** A bundle rung up as one item. Never priced here: the preview gives its total. Each bundle once; the quantity is whole. */
export interface CartBundle {
  productBundleId: Guid;
  name: string;
  code: string | null;
  quantity: number;
  discountAmount: number | null;
  discountPercent: number | null;
}

/** Delivery by rider, chosen at the till. expectedPaymentMethod guides the rider; it is not a payment. */
export interface DeliveryDraft {
  address: string;
  contactPhone: string;
  riderName: string;
  notes: string;
  expectedPaymentMethod: PaymentMethod;
  /** A trip still out with the same rider to add this order to; null = a new trip. */
  deliveryTripId: Guid | null;
}

export const emptyDelivery = (): DeliveryDraft => ({
  address: '', contactPhone: '', riderName: '', notes: '', expectedPaymentMethod: PaymentMethod.Cash, deliveryTripId: null,
});

export type PrescriptionDraft = Partial<Omit<SalePrescriptionRequestDto, 'patientAgeYears'>> & { patientAgeYears?: number | null };

export interface Cart {
  customerId: Guid | null;
  customerName: string | null;
  /** The customer's standing discount, for the chip only: the API applies it and the preview prices it. */
  customerDiscountPercent?: number | null;
  lines: CartLine[];
  paymentMethod: PaymentMethod;
  saleDiscountAmount: number | null;
  overrideCreditLimit: boolean;
  notes: string;
  prescription: PrescriptionDraft;
  /** The customer has no container: refills whose size names a container (on the product's unit conversion) are sold with one. */
  needsContainer?: boolean;
  /** Missing on carts saved before bundles. */
  bundles?: CartBundle[];
  /** Counter (default): a sale now. Rider: a delivery order, a sale only once the rider is back. */
  deliveryMode?: DeliveryMode;
  delivery?: DeliveryDraft;
}

/** Nothing to sell yet: no line and no bundle. */
export const isCartEmpty = (cart: Pick<Cart, 'lines' | 'bundles'>) => cart.lines.length === 0 && !cart.bundles?.length;

export interface HeldCart { id: string; heldAt: string; label: string; cart: Cart }

export const emptyCart = (): Cart => ({
  customerId: null,
  customerName: null,
  lines: [],
  bundles: [],
  paymentMethod: PaymentMethod.Cash,
  saleDiscountAmount: null,
  overrideCreditLimit: false,
  notes: '',
  prescription: {},
});

interface CartStore {
  /** Keyed by business id: a cart never crosses businesses. */
  carts: Record<Guid, Cart>;
  held: Record<Guid, HeldCart[]>;
  update(businessId: Guid, fn: (cart: Cart) => Cart): void;
  reset(businessId: Guid): void;
  hold(businessId: Guid, label: string): void;
  recall(businessId: Guid, heldId: string): void;
  discardHeld(businessId: Guid, heldId: string): void;
  clearAll(): void;
}

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      carts: {},
      held: {},
      update: (businessId, fn) => set((s) => ({ carts: { ...s.carts, [businessId]: fn(s.carts[businessId] ?? emptyCart()) } })),
      reset: (businessId) => set((s) => ({ carts: { ...s.carts, [businessId]: emptyCart() } })),
      hold: (businessId, label) =>
        set((s) => {
          const cart = s.carts[businessId];
          if (!cart || cart.lines.length === 0) return s;
          const entry: HeldCart = { id: newId(), heldAt: new Date().toISOString(), label, cart };
          return { held: { ...s.held, [businessId]: [entry, ...(s.held[businessId] ?? [])] }, carts: { ...s.carts, [businessId]: emptyCart() } };
        }),
      recall: (businessId, heldId) =>
        set((s) => {
          const list = s.held[businessId] ?? [];
          const entry = list.find((h) => h.id === heldId);
          if (!entry) return s;
          const remaining = list.filter((h) => h.id !== heldId);
          const current = s.carts[businessId];
          // The cart being replaced is held, so nothing is lost.
          if (current && current.lines.length > 0) {
            remaining.unshift({ id: newId(), heldAt: new Date().toISOString(), label: current.customerName ?? 'Walk-in', cart: current });
          }
          return { held: { ...s.held, [businessId]: remaining }, carts: { ...s.carts, [businessId]: entry.cart } };
        }),
      discardHeld: (businessId, heldId) =>
        set((s) => ({ held: { ...s.held, [businessId]: (s.held[businessId] ?? []).filter((h) => h.id !== heldId) } })),
      clearAll: () => set({ carts: {}, held: {} }),
    }),
    { name: 'upos.cart', storage: createJSONStorage(() => sessionStorage), version: 2, migrate: () => ({ carts: {}, held: {} }) as unknown as CartStore },
  ),
);

export function newLineKey() {
  return newId();
}
