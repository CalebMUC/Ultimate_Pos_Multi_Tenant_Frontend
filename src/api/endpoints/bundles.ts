import { cleanParams } from '@/lib/utils';
import { api } from '../client';
import type { Guid } from '../dto/common';
import type { ProductBundleDto, ProductBundleRequestDto } from '../dto/bundles';

/** Bundles: reading needs Products.View; changing them needs Products.ManageBundles. */
export const productBundlesApi = {
  /** Sorted by name. search matches name or code. */
  list: (query: { isActive?: boolean; search?: string } = {}, signal?: AbortSignal) =>
    api.get<ProductBundleDto[]>('/product-bundles', cleanParams(query), { signal }),
  get: (id: Guid) => api.get<ProductBundleDto>(`/product-bundles/${id}`),
  create: (body: ProductBundleRequestDto) => api.post<ProductBundleDto>('/product-bundles', body),
  /** Replaces name, code, prices and all parts. */
  update: (id: Guid, body: ProductBundleRequestDto) => api.put<ProductBundleDto>(`/product-bundles/${id}`, body),
  activate: (id: Guid) => api.post<ProductBundleDto>(`/product-bundles/${id}/activate`),
  deactivate: (id: Guid) => api.post<ProductBundleDto>(`/product-bundles/${id}/deactivate`),
};
