import { utcOffsetMinutes } from '@/lib/format';
import { cleanParams } from '@/lib/utils';
import { api } from '../client';
import type { DateOnly, Guid } from '../dto/common';
import type {
  CreateDeliveryOrderRequestDto, DeliverDeliveryOrderRequestDto, DeliveryOrderDto, DeliveryOrderQuery, DeliverySummaryDto,
} from '../dto/deliveries';

/** Orders at the branches the caller can see; the API decides which (no branchId parameter). */
export const deliveryOrdersApi = {
  list: (query: DeliveryOrderQuery = {}) =>
    api.getPaged<DeliveryOrderDto>('/delivery-orders', cleanParams({ ...query, utcOffsetMinutes: utcOffsetMinutes() })),
  get: (id: Guid) => api.get<DeliveryOrderDto>(`/delivery-orders/${id}`),
  /** 409 INSUFFICIENT_STOCK when stock not already held for other orders is short. */
  create: (body: CreateDeliveryOrderRequestDto) => api.post<DeliveryOrderDto>('/delivery-orders', body),
  dispatch: (id: Guid, riderName: string) => api.post<DeliveryOrderDto>(`/delivery-orders/${id}/dispatch`, { riderName }),
  /** Becomes a sale. Never retried automatically; recording the same delivery twice gives one sale (400 the second time). */
  deliver: (id: Guid, body: DeliverDeliveryOrderRequestDto) => api.post<DeliveryOrderDto>(`/delivery-orders/${id}/deliver`, body),
  cancel: (id: Guid, reason: string) => api.post<DeliveryOrderDto>(`/delivery-orders/${id}/cancel`, { reason }),
  summary: (from: DateOnly, to: DateOnly) => api.get<DeliverySummaryDto>('/delivery-orders/summary', { from, to, utcOffsetMinutes: utcOffsetMinutes() }),
};
