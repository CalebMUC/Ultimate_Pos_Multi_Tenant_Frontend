'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { salesApi } from '@/api/endpoints/sales';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { useQueryKey } from '@/hooks/useSessionInfo';
import type { Cart } from '@/stores/cart';
import { toSaleRequest } from './cartActions';

/** Prices the cart through POST /sales/preview, debounced. Keeps the last good result while the next one loads. */
export function useSalePreview(cart: Cart) {
  const key = useQueryKey();
  // The prescription doesn't change pricing, so it is left out of the key and the body.
  const body = toSaleRequest(cart);
  const debounced = useDebouncedValue(body, 300);
  return useQuery({
    queryKey: key('sale-preview', debounced),
    queryFn: ({ signal }) => salesApi.preview(debounced, signal),
    enabled: debounced.lines.length > 0 && debounced.lines.every((l) => l.quantity > 0),
    placeholderData: keepPreviousData,
    staleTime: 0,
    retry: false,
  });
}
