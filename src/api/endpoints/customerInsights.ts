import { utcOffsetMinutes } from '@/lib/format';
import { cleanParams } from '@/lib/utils';
import { api } from '../client';
import type { DateOnly, Guid } from '../dto/common';
import type { CustomerDto, SetCustomerDiscountRequestDto } from '../dto/business';
import type { CustomerInsightsDto, CustomerInsightsQuery, CustomerBuyingSummaryDto, DashboardCustomersDto } from '../dto/customerInsights';

/** How customers have been buying (Customers.ViewInsights) and their standing discount (Customers.ManageDiscount). */
export const customerInsightsApi = {
  /** Only customers who bought in the period, ranked and segmented by the API. Default period: the last 90 days. */
  list: (query: CustomerInsightsQuery = {}) =>
    api.getPaged<CustomerBuyingSummaryDto>('/customers/insights', cleanParams({ ...query, utcOffsetMinutes: utcOffsetMinutes() })),
  /** One customer. Default period: the last 365 days. */
  get: (id: Guid, from?: DateOnly, to?: DateOnly) =>
    api.get<CustomerInsightsDto>(`/customers/${id}/insights`, cleanParams({ from, to, utcOffsetMinutes: utcOffsetMinutes() })),
  /** 400 `note` without a note; 400 `discountPercent` above the business's cap. Later sales only. */
  setDiscount: (id: Guid, body: SetCustomerDiscountRequestDto) => api.put<CustomerDto>(`/customers/${id}/discount`, body),
  /** Always the 90 days up to `to` (default today). */
  dashboard: (to?: DateOnly) => api.get<DashboardCustomersDto>('/dashboard/customers', cleanParams({ to, utcOffsetMinutes: utcOffsetMinutes() })),
};
