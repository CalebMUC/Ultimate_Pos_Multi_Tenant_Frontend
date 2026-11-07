'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '@/api/endpoints/catalog';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import type { Guid } from '@/api/dto/common';
import type { DeliveryOrderDto } from '@/api/dto/deliveries';

const PAGE = 200;

/** Every age-restricted product's id, a page of 200 at a time (the API's largest page). */
async function loadIds(signal?: AbortSignal): Promise<Set<Guid>> {
  const ids = new Set<Guid>();
  for (let page = 1; ; page++) {
    const result = await productsApi.list({ isAgeRestricted: true, page, pageSize: PAGE }, signal);
    result.items.forEach((p) => {
      // An API from before the flag ignores the filter: keep only what it says is restricted.
      if (p.isAgeRestricted) ids.add(p.productId);
    });
    if (page >= result.meta.totalPages || result.items.length < PAGE) return ids;
  }
}

/**
 * Which delivery orders carry alcohol or tobacco. A delivery order's lines do not say (only a sale preview does), so the ids of the
 * business's age-restricted products are loaded once and matched against the lines, bundle parts included. Without Products.View it
 * answers false for every order: the API still asks for the age check when the delivery is recorded.
 */
export function useAgeRestrictedOrders(enabled = true) {
  const key = useQueryKey();
  const canView = usePermission('Products.View');
  const query = useQuery({
    queryKey: key('products', { ageRestrictedIds: true }),
    queryFn: ({ signal }) => loadIds(signal),
    enabled: enabled && canView,
    staleTime: 5 * 60_000,
  });
  const ids = query.data;
  return useCallback(
    (order: Pick<DeliveryOrderDto, 'lines'> | null | undefined) => !!ids && !!order && order.lines.some((l) => ids.has(l.productId)),
    [ids],
  );
}
