import { api } from '../client';
import type { Guid } from '../dto/common';
import type { RegisterBusinessResultDto } from '../dto/platform';
import type {
  BusinessDto, BusinessLicenseStatusDto, CustomerBalanceDto, CustomerDto, CustomerLedgerEntryDto, RecordCustomerPaymentRequestDto, RegisterBusinessRequestDto,
  RegisterCustomerRequestDto, UpdateBusinessRequestDto, UpdateCustomerRequestDto, UpdateMonthlyDiscountRequestDto,
} from '../dto/business';

export const businessesApi = {
  /** My businesses, or all of them with Businesses.ViewAll. */
  list: () => api.get<BusinessDto[]>('/businesses'),
  current: () => api.get<BusinessDto>('/businesses/current'),
  get: (id: Guid) => api.get<BusinessDto>(`/businesses/${id}`),
  /** Super users: registers a business and its owner. The owner's temporary password is returned once. */
  register: (body: RegisterBusinessRequestDto) => api.post<RegisterBusinessResultDto>('/businesses', body),
  /** The signed-in business's own licence status and history (Businesses.View). */
  currentLicense: () => api.get<BusinessLicenseStatusDto>('/businesses/current/license'),
  update: (id: Guid, body: UpdateBusinessRequestDto) => api.put<BusinessDto>(`/businesses/${id}`, body),
  /** The monthly-spend reward. 400 `threshold` / `percent` when only one is given or out of range. */
  updateMonthlyDiscount: (body: UpdateMonthlyDiscountRequestDto) => api.put<BusinessDto>('/businesses/current/monthly-discount', body),
};

export const customersApi = {
  /** Search matches name, phone and KRA PIN. Never send businessId: the token decides. */
  list: (search?: string) => api.get<CustomerDto[]>('/customers', search ? { search } : undefined),
  get: (id: Guid) => api.get<CustomerDto>(`/customers/${id}`),
  create: (body: RegisterCustomerRequestDto) => api.post<CustomerDto>('/customers', body),
  update: (id: Guid, body: UpdateCustomerRequestDto) => api.put<CustomerDto>(`/customers/${id}`, body),
  activate: (id: Guid) => api.post<CustomerDto>(`/customers/${id}/activate`),
  deactivate: (id: Guid) => api.post<CustomerDto>(`/customers/${id}/deactivate`),
  balance: (id: Guid) => api.get<CustomerBalanceDto>(`/customers/${id}/balance`),
  ledger: (id: Guid) => api.get<CustomerLedgerEntryDto[]>(`/customers/${id}/ledger`),
  recordPayment: (id: Guid, body: RecordCustomerPaymentRequestDto) => api.post<CustomerBalanceDto>(`/customers/${id}/payments`, body),
};
