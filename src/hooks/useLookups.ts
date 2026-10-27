'use client';

import { useQuery } from '@tanstack/react-query';
import { brandsApi, categoriesApi, productsApi, unitsApi } from '@/api/endpoints/catalog';
import { suppliersApi, purchaseOrdersApi } from '@/api/endpoints/inventory';
import { expenseCategoriesApi } from '@/api/endpoints/other';
import type { CategoryDto, UnitOfMeasureDto } from '@/api/dto/catalog';
import type { Guid } from '@/api/dto/common';
import { usePermission, useQueryKey } from './useSessionInfo';

// Small reference lists every form needs. Cached per business for a few minutes.
const LOOKUP_STALE = 5 * 60_000;

export function useUnits() {
  const key = useQueryKey();
  const allowed = usePermission(['Units.View', 'Products.View']);
  return useQuery({ queryKey: key('units'), queryFn: unitsApi.list, staleTime: LOOKUP_STALE, enabled: allowed });
}

export function unitSymbol(units: UnitOfMeasureDto[] | undefined, id: Guid | null | undefined): string {
  return units?.find((u) => u.unitOfMeasureId === id)?.symbol ?? '';
}

export function useCategories() {
  const key = useQueryKey();
  const allowed = usePermission(['Categories.View', 'Products.View']);
  return useQuery({ queryKey: key('categories'), queryFn: categoriesApi.list, staleTime: LOOKUP_STALE, enabled: allowed });
}

/** Every brand, active or not, by name. Pickers filter to active ones but still need inactive names for products that keep one. */
export function useBrands() {
  const key = useQueryKey();
  const allowed = usePermission('Products.View');
  return useQuery({ queryKey: key('brands'), queryFn: () => brandsApi.list(), staleTime: LOOKUP_STALE, enabled: allowed });
}

export interface FlatCategory extends Omit<CategoryDto, 'subcategories'> { depth: number; path: string }

/** The category tree flattened depth-first, for selects and tables. */
export function flattenCategories(tree: CategoryDto[] | undefined): FlatCategory[] {
  const out: FlatCategory[] = [];
  const walk = (nodes: CategoryDto[], depth: number, prefix: string) => {
    for (const node of [...nodes].sort((a, b) => a.name.localeCompare(b.name))) {
      const path = prefix ? `${prefix} › ${node.name}` : node.name;
      const { subcategories, ...rest } = node;
      out.push({ ...rest, depth, path });
      walk(subcategories ?? [], depth + 1, path);
    }
  };
  walk(tree ?? [], 0, '');
  return out;
}

export function useSuppliers() {
  const key = useQueryKey();
  const allowed = usePermission('Suppliers.View');
  return useQuery({ queryKey: key('suppliers'), queryFn: suppliersApi.list, staleTime: LOOKUP_STALE, enabled: allowed });
}

export function useExpenseCategories(activeOnly = false) {
  const key = useQueryKey();
  const allowed = usePermission('ExpenseCategories.View');
  return useQuery({
    queryKey: key('expense-categories', { activeOnly }),
    queryFn: () => expenseCategoriesApi.list(activeOnly),
    staleTime: LOOKUP_STALE,
    enabled: allowed,
  });
}

export function usePurchasableItemTypes() {
  const key = useQueryKey();
  const allowed = usePermission(['PurchaseOrders.View', 'PurchaseOrders.Create']);
  return useQuery({ queryKey: key('purchasable-item-types'), queryFn: purchaseOrdersApi.purchasableItemTypes, staleTime: LOOKUP_STALE, enabled: allowed });
}

/** Full product detail (unit conversions and price tiers), for line editors. */
export function useProductDetail(productId: Guid | null | undefined) {
  const key = useQueryKey();
  return useQuery({
    queryKey: key('products', { detail: productId }),
    queryFn: () => productsApi.get(productId!),
    enabled: !!productId,
    staleTime: 60_000,
  });
}
