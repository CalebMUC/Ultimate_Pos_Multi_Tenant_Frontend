import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { PaymentMethod } from '@/api/enums';
import type { Guid } from '@/api/dto/common';
import type { SalePrescriptionRequestDto } from '@/api/dto/sales';

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
  /** Base unit plus active pack units: the units this line may be sold in. */
  units: { unitOfMeasureId: Guid; symbol: string }[];
}

export type PrescriptionDraft = Partial<Omit<SalePrescriptionRequestDto, 'patientAgeYears'>> & { patientAgeYears?: number | null };

export interface Cart {
  customerId: Guid | null;
  customerName: string | null;
  lines: CartLine[];
  paymentMethod: PaymentMethod;
  saleDiscountAmount: number | null;
  overrideCreditLimit: boolean;
  notes: string;
  prescription: PrescriptionDraft;
}

export interface HeldCart { id: string; heldAt: string; label: string; cart: Cart }

export const emptyCart = (): Cart => ({
  customerId: null,
  customerName: null,
  lines: [],
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
