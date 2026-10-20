// Application/Catalog/Dtos/CatalogDtos.cs
import type { ItemType, PriceType, TaxClassification } from '../enums';
import type { DateTimeString, Guid } from './common';

export interface CategoryDto {
  categoryId: Guid;
  name: string;
  code: string;
  parentCategoryId: Guid | null;
  isActive: boolean;
  subcategories: CategoryDto[];
}
export interface CreateCategoryRequestDto { name: string; code: string; parentCategoryId: Guid | null }
/** The code is fixed once created. */
export interface UpdateCategoryRequestDto { name: string; parentCategoryId: Guid | null }

export interface UnitOfMeasureDto { unitOfMeasureId: Guid; name: string; symbol: string; isActive: boolean }
export interface UnitOfMeasureRequestDto { name: string; symbol: string }

export interface ProductRequestDto {
  name: string;
  description: string | null;
  categoryId: Guid;
  itemType: ItemType;
  taxClassification: TaxClassification;
  baseUnitOfMeasureId: Guid;
  reorderLevel: number;
  barcode: string | null;
  isBatchTracked: boolean;
  requiresPrescription: boolean;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
  manufacturer: string | null;
}

export interface ProductDto extends ProductRequestDto {
  productId: Guid;
  sku: string;
  isActive: boolean;
  categoryName: string | null;
  baseUnitSymbol: string | null;
}

export interface ProductUnitConversionDto {
  productUnitConversionId: Guid;
  packUnitOfMeasureId: Guid;
  conversionFactor: number;
  isActive: boolean;
  packUnitSymbol: string | null;
  /** Sold with one of this pack when the customer has no container (an empty 20L container with a 20L refill), in its base unit. */
  containerProductId?: Guid | null;
  containerProductName?: string | null;
  containerSku?: string | null;
  containerUnitOfMeasureId?: Guid | null;
  containerUnitSymbol?: string | null;
  containerIsActive?: boolean | null;
}

export interface ProductPriceTierDto {
  productPriceTierId: Guid;
  unitOfMeasureId: Guid;
  priceType: PriceType;
  price: number;
  effectiveFrom: DateTimeString;
}

export interface AddPriceTierRequestDto { unitOfMeasureId: Guid; priceType: PriceType; price: number; effectiveFrom: DateTimeString }

export interface ProductDetailDto extends ProductDto {
  unitConversions: ProductUnitConversionDto[];
  priceTiers: ProductPriceTierDto[];
}

export interface CreateProductUnitConversionRequestDto { packUnitOfMeasureId: Guid; conversionFactor: number; containerProductId?: Guid | null }
export interface UpdateProductUnitConversionRequestDto { conversionFactor: number }

export type ProductSortBy = 'name' | 'sku' | 'createdAt' | 'category';

export interface ProductQuery {
  page?: number;
  pageSize?: number;
  categoryId?: Guid;
  itemType?: ItemType;
  search?: string;
  isActive?: boolean;
  isBatchTracked?: boolean;
  requiresPrescription?: boolean;
  sortBy?: ProductSortBy;
  sortDirection?: 'asc' | 'desc';
}

export interface CategoryImportRowResult { rowNumber: number; name: string; code: string; parentCode: string | null; isValid: boolean; error: string | null }
export interface ProductImportRowResult { rowNumber: number; name: string; isValid: boolean; error: string | null; sku: string | null }
export interface BulkImportResultDto<Row> { committed: boolean; totalRows: number; validRows: number; invalidRows: number; rows: Row[] }
