'use client';

import { useQuery } from '@tanstack/react-query';
import { productsApi } from '@/api/endpoints/catalog';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { usePreferences } from '@/stores/preferences';

/**
 * The Pharmacy menu shows when the business has at least one batch-tracked or prescription-only product, or when the user
 * turns it on in Settings. It is not tied to business kind (§6).
 */
export function usePharmacyMenu(enabled = true): boolean {
  const preference = usePreferences((s) => s.showPharmacyMenu);
  const canViewProducts = usePermission('Products.View');
  const key = useQueryKey();
  const auto = enabled && preference === null && canViewProducts;

  const batch = useQuery({
    queryKey: key('products', { probe: 'batch' }),
    queryFn: () => productsApi.list({ isBatchTracked: true, pageSize: 1 }),
    enabled: auto,
    staleTime: 5 * 60_000,
  });
  const rx = useQuery({
    queryKey: key('products', { probe: 'rx' }),
    queryFn: () => productsApi.list({ requiresPrescription: true, pageSize: 1 }),
    enabled: auto && batch.isSuccess && batch.data.meta.totalCount === 0,
    staleTime: 5 * 60_000,
  });

  if (!enabled) return false;
  if (preference !== null) return preference;
  return (batch.data?.meta.totalCount ?? 0) > 0 || (rx.data?.meta.totalCount ?? 0) > 0;
}
