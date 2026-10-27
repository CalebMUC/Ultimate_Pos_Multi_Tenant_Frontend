import { cleanParams } from '@/lib/utils';
import { api } from '../client';
import type { Guid } from '../dto/common';
import type {
  AddPriceTierRequestDto, BrandDto, BrandQuery, BrandRequestDto, BulkImportResultDto, CategoryDto, CreateProductRequestDto, CategoryImportRowResult, CreateCategoryRequestDto,
  CreateProductUnitConversionRequestDto, ProductDetailDto, ProductDto, ProductImportRowResult, ProductPriceTierDto, ProductQuery,
  ProductUnitConversionDto, UnitOfMeasureDto, UnitOfMeasureRequestDto, UpdateCategoryRequestDto, UpdateProductRequestDto,
} from '../dto/catalog';

export const categoriesApi = {
  /** A tree: root categories with nested subcategories. */
  list: () => api.get<CategoryDto[]>('/categories/get-categories'),
  create: (body: CreateCategoryRequestDto) => api.post<CategoryDto>('/categories/create-category', body),
  update: (id: Guid, body: UpdateCategoryRequestDto) => api.put<CategoryDto>(`/categories/${id}`, body),
  activate: (id: Guid) => api.post<CategoryDto>(`/categories/${id}/activate`),
  deactivate: (id: Guid) => api.post<CategoryDto>(`/categories/${id}/deactivate`),
  downloadTemplate: () => api.download('/categories/bulk-upload/template', 'categories-template.xlsx'),
  bulkUpload: (file: File, dryRun: boolean) =>
    api.upload<BulkImportResultDto<CategoryImportRowResult>>('/categories/bulk-upload', file, { dryRun }),
};

/** Not paged: a shop has tens of brands. Sorted by name. There is no delete. */
export const brandsApi = {
  list: (query: BrandQuery = {}) => api.get<BrandDto[]>('/brands', cleanParams(query)),
  create: (body: BrandRequestDto) => api.post<BrandDto>('/brands', body),
  /** Shows on every product with the brand at once; product names don't change. */
  update: (id: Guid, body: BrandRequestDto) => api.put<BrandDto>(`/brands/${id}`, body),
  activate: (id: Guid) => api.post<BrandDto>(`/brands/${id}/activate`),
  /** Products keep it, but it can't be given to another one. */
  deactivate: (id: Guid) => api.post<BrandDto>(`/brands/${id}/deactivate`),
};

export const unitsApi = {
  list: () => api.get<UnitOfMeasureDto[]>('/units-of-measure/get-units'),
  create: (body: UnitOfMeasureRequestDto) => api.post<UnitOfMeasureDto>('/units-of-measure/create-unit', body),
  update: (id: Guid, body: UnitOfMeasureRequestDto) => api.put<UnitOfMeasureDto>(`/units-of-measure/${id}`, body),
  activate: (id: Guid) => api.post<UnitOfMeasureDto>(`/units-of-measure/${id}/activate`),
  deactivate: (id: Guid) => api.post<UnitOfMeasureDto>(`/units-of-measure/${id}/deactivate`),
};

export const productsApi = {
  list: (query: ProductQuery, signal?: AbortSignal) => api.getPaged<ProductDto>('/products/get-products', cleanParams(query), { signal }),
  get: (id: Guid) => api.get<ProductDetailDto>(`/products/${id}`),
  /** Exact barcode first, then SKU. Includes inactive products. */
  lookup: (code: string) => api.get<ProductDetailDto>('/products/lookup', { code }),
  create: (body: CreateProductRequestDto) => api.post<ProductDto>('/products/create-product', body),
  update: (id: Guid, body: UpdateProductRequestDto) => api.put<ProductDto>(`/products/${id}`, body),
  activate: (id: Guid) => api.post<ProductDto>(`/products/${id}/activate`),
  deactivate: (id: Guid) => api.post<ProductDto>(`/products/${id}/deactivate`),
  priceTiers: (id: Guid) => api.get<ProductPriceTierDto[]>(`/products/${id}/price-tiers`),
  addPriceTier: (id: Guid, body: AddPriceTierRequestDto) => api.post<ProductPriceTierDto>(`/products/${id}/price-tiers`, body),
  unitConversions: (id: Guid) => api.get<ProductUnitConversionDto[]>(`/products/${id}/unit-conversions`),
  addUnitConversion: (id: Guid, body: CreateProductUnitConversionRequestDto) =>
    api.post<ProductUnitConversionDto>(`/products/${id}/unit-conversions`, body),
  updateUnitConversion: (id: Guid, conversionId: Guid, conversionFactor: number) =>
    api.put<ProductUnitConversionDto>(`/products/${id}/unit-conversions/${conversionId}`, { conversionFactor }),
  /** Null clears it. */
  setUnitConversionContainer: (id: Guid, conversionId: Guid, containerProductId: Guid | null) =>
    api.put<ProductUnitConversionDto>(`/products/${id}/unit-conversions/${conversionId}/container`, { containerProductId }),
  activateUnitConversion: (id: Guid, conversionId: Guid) =>
    api.post<ProductUnitConversionDto>(`/products/${id}/unit-conversions/${conversionId}/activate`),
  deactivateUnitConversion: (id: Guid, conversionId: Guid) =>
    api.post<ProductUnitConversionDto>(`/products/${id}/unit-conversions/${conversionId}/deactivate`),
  downloadTemplate: () => api.download('/products/bulk-upload/template', 'products-template.xlsx'),
  bulkUpload: (file: File, dryRun: boolean) =>
    api.upload<BulkImportResultDto<ProductImportRowResult>>('/products/bulk-upload', file, { dryRun }),
};
