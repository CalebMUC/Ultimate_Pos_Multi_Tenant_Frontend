'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { salesApi } from '@/api/endpoints/sales';
import { PaymentMethod } from '@/api/enums';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { emptyCart, type CartBundle, type CartLine } from '@/stores/cart';
import { toSaleRequest } from '@/features/pos/cartActions';
import type { Guid } from '@/api/dto/common';

/**
 * Prices delivery lines (and bundles) at the customer's prices through POST /sales/preview (needs Sales.View), like the POS cart. The API stays the
 * only place prices are worked out; this shows the total before the order is taken or the delivery recorded.
 */
export function useLinesPreview(customerId: Guid | null, lines: CartLine[], paymentMethod: PaymentMethod = PaymentMethod.Cash, enabled = true,
  bundles: CartBundle[] = []) {
  const key = useQueryKey();
  const body = toSaleRequest({ ...emptyCart(), customerId, paymentMethod, lines, bundles });
  const debounced = useDebouncedValue(body, 300);
  return useQuery({
    queryKey: key('sale-preview', { delivery: true, ...debounced }),
    queryFn: ({ signal }) => salesApi.preview(debounced, signal),
    enabled: enabled && (debounced.lines.length > 0 || !!debounced.bundles?.length) && debounced.lines.every((l) => l.quantity > 0),
    placeholderData: keepPreviousData,
    staleTime: 0,
    retry: false,
  });
}
