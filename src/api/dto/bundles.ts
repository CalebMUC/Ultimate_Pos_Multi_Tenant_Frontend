// Application/Catalog/ProductBundles.cs
import type { DateTimeString, Guid } from './common';

/** One part: 20 litres of water is (water, l, 20) or (water, 20L, 1); one heavy-duty bottle is (bottle, pcs, 1). */
export interface ProductBundleComponentRequestDto { productId: Guid; unitOfMeasureId: Guid; quantity: number }

/** Create, and update (a full replace of name, code, prices and every part). wholesalePrice null = wholesale customers pay retail. */
export interface ProductBundleRequestDto {
  name: string;
  code: string | null;
  description: string | null;
  retailPrice: number;
  wholesalePrice: number | null;
  components: ProductBundleComponentRequestDto[];
}

export interface ProductBundleComponentDto {
  productBundleComponentId: Guid;
  productId: Guid;
  productName: string;
  sku: string;
  productIsActive: boolean;
  unitOfMeasureId: Guid;
  unitSymbol: string | null;
  quantity: number;
  /** Per bundle, in the product's base unit. */
  quantityInBaseUnits: number;
  baseUnitSymbol: string | null;
  /** What the signed-in branch can sell of this product now. Null without Stock.View. */
  availableInBaseUnits: number | null;
}

export interface ProductBundleDto {
  productBundleId: Guid;
  name: string;
  code: string | null;
  description: string | null;
  retailPrice: number;
  wholesalePrice: number | null;
  isActive: boolean;
  /** Whole bundles the signed-in branch can sell now (the scarcest part decides). Null without Stock.View. */
  availableQuantity: number | null;
  components: ProductBundleComponentDto[];
  createdAt: DateTimeString;
  lastUpdatedAt: DateTimeString | null;
}
