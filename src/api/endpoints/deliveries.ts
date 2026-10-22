import { utcOffsetMinutes } from '@/lib/format';
import { cleanParams } from '@/lib/utils';
import { api } from '../client';
import type { DateOnly, Guid } from '../dto/common';
import type {
  CreateDeliveryOrderRequestDto, DeliverDeliveryOrderRequestDto, DeliveryFuelReportDto, DeliveryOrderDto, DeliveryOrderQuery, DeliverySummaryDto,
  DeliveryTripDto, DispatchTripRequestDto,
} from '../dto/deliveries';

/** Orders at the branches the caller can see; the API decides which (no branchId parameter). */
export const deliveryOrdersApi = {
  list: (query: DeliveryOrderQuery = {}) =>
    api.getPaged<DeliveryOrderDto>('/delivery-orders', cleanParams({ ...query, utcOffsetMinutes: utcOffsetMinutes() })),
  get: (id: Guid) => api.get<DeliveryOrderDto>(`/delivery-orders/${id}`),
  /**
   * 409 INSUFFICIENT_STOCK when stock not already held for other orders is short. With riderName it goes straight out (needs
   * DeliveryOrders.Dispatch, else 403). Not a sale until the rider is back.
   */
  create: (body: CreateDeliveryOrderRequestDto) => api.post<DeliveryOrderDto>('/delivery-orders', body),
  dispatch: (id: Guid, riderName: string, deliveryTripId?: Guid | null) =>
    api.post<DeliveryOrderDto>(`/delivery-orders/${id}/dispatch`, { riderName, deliveryTripId: deliveryTripId ?? null }),
  /** Several pending orders out with one rider, as one trip. */
  dispatchTrip: (body: DispatchTripRequestDto) => api.post<DeliveryTripDto>('/delivery-orders/trips', body),
  /** Completes the sale. Never retried automatically; recording the same delivery twice gives one sale (400 the second time). */
  deliver: (id: Guid, body: DeliverDeliveryOrderRequestDto) => api.post<DeliveryOrderDto>(`/delivery-orders/${id}/deliver`, body),
  /** The rider brought it back undelivered: the reserved stock is free again. */
  return: (id: Guid, reason: string) => api.post<DeliveryOrderDto>(`/delivery-orders/${id}/return`, { reason }),
  cancel: (id: Guid, reason: string) => api.post<DeliveryOrderDto>(`/delivery-orders/${id}/cancel`, { reason }),
  summary: (from: DateOnly, to: DateOnly) => api.get<DeliverySummaryDto>('/delivery-orders/summary', { from, to, utcOffsetMinutes: utcOffsetMinutes() }),
  /** Trips dispatched in the period (local days), newest first. */
  trips: (query: { from: DateOnly; to: DateOnly; riderName?: string }) =>
    api.get<DeliveryTripDto[]>('/delivery-orders/trips', cleanParams({ ...query, utcOffsetMinutes: utcOffsetMinutes() })),
  trip: (id: Guid) => api.get<DeliveryTripDto>(`/delivery-orders/trips/${id}`),
  /** Needs DeliveryOrders.View and Expenses.View. */
  fuelReport: (query: { from: DateOnly; to: DateOnly; expenseCategoryId?: Guid; expectedFuelPerTrip?: number }) =>
    api.get<DeliveryFuelReportDto>('/delivery-orders/fuel-report', cleanParams({ ...query, utcOffsetMinutes: utcOffsetMinutes() })),
};
