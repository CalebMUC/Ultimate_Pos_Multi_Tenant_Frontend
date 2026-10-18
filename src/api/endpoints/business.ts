import { api } from '../client';
import type { Guid } from '../dto/common';
import type {
  BusinessDto, CustomerBalanceDto, CustomerDto, CustomerLedgerEntryDto, RecordCustomerPaymentRequestDto, RegisterBusinessRequestDto,
  RegisterCustomerRequestDto, UpdateBusinessRequestDto, UpdateCustomerRequestDto,
} from '../dto/business';

export const businessesApi = {
  /** My businesses, or all of them with Businesses.ViewAll. */
  list: () => api.get<BusinessDto[]>('/businesses'),
  current: () => api.get<BusinessDto>('/businesses/current'),
  get: (id: Guid) => api.get<BusinessDto>(`/businesses/${id}`),
  register: (body: RegisterBusinessRequestDto) => api.post<BusinessDto>('/businesses', body),
  update: (id: Guid, body: UpdateBusinessRequestDto) => api.put<BusinessDto>(`/businesses/${id}`, body),
  activate: (id: Guid) => api.post<BusinessDto>(`/businesses/${id}/activate`),
  deactivate: (id: Guid) => api.post<BusinessDto>(`/businesses/${id}/deactivate`),
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
