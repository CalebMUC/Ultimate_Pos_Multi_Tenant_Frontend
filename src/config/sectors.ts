import { BusinessKind, BusinessSector } from '@/api/enums';

/**
 * What the registration form suggests for a sector, mirroring BusinessDefaults.Sectors in the API (Application/Business). Suggestions
 * only: the super user can change kind and the overselling switch, and the API applies the same defaults when they are left out.
 * This is NOT where menus come from: a business's modules are always read from the API.
 */
export interface SectorProfile {
  /** Pre-filled Kind. Null: the super user must choose (General, Agrovet: some make their own products). */
  kind: BusinessKind | null;
  allowNegativeStock: boolean;
  /** What it starts with on top of the standard units and expense categories, for the note after registering. */
  startsWith: string | null;
}

export const sectorProfiles: Record<BusinessSector, SectorProfile> = {
  [BusinessSector.General]: { kind: null, allowNegativeStock: true, startsWith: null },
  [BusinessSector.Pharmacy]: {
    kind: BusinessKind.Trader, allowNegativeStock: true,
    startsWith: 'Tablet, capsule, bottle, strip and tube units, and a Waste Disposal expense category.',
  },
  [BusinessSector.Agrovet]: { kind: null, allowNegativeStock: true, startsWith: 'Bag, sachet and bottle units.' },
  [BusinessSector.WaterRefill]: {
    kind: BusinessKind.Trader, allowNegativeStock: false,
    startsWith: '10L and 20L refill units, and Filter Replacements, Cleaning & Sanitation and Water Testing & Inspection expense categories. Selling below zero stock starts off.',
  },
  [BusinessSector.Minimart]: { kind: BusinessKind.Trader, allowNegativeStock: true, startsWith: 'Dozen and crate units.' },
  [BusinessSector.Supermarket]: {
    kind: BusinessKind.Trader, allowNegativeStock: true,
    startsWith: 'Dozen, crate and carton units, and a Packaging & Carrier Bags expense category.',
  },
  [BusinessSector.Hardware]: { kind: BusinessKind.Trader, allowNegativeStock: true, startsWith: 'Metre, bag, sheet and roll units.' },
};

/** A sector's profile; an unknown sector gets General's, as in the API. */
export function sectorProfile(sector: number | null | undefined): SectorProfile {
  return sectorProfiles[sector as BusinessSector] ?? sectorProfiles[BusinessSector.General];
}
