import { BusinessKind } from '@/api/enums';

// What a business can do, by kind. Purchasable item types come from the API (GET /purchase-orders/purchasable-item-types).
// Pharmacy features are driven by product flags (isBatchTracked, requiresPrescription) and permissions, not by business kind.
export const capabilitiesByKind = {
  [BusinessKind.Manufacturer]: { production: true },
  [BusinessKind.Trader]: { production: false },
} as const;

export type Capabilities = { production: boolean };
export type Capability = keyof Capabilities;

const none: Capabilities = { production: false };

export function capabilitiesFor(kind: BusinessKind | null | undefined): Capabilities {
  return kind === null || kind === undefined ? none : capabilitiesByKind[kind];
}
