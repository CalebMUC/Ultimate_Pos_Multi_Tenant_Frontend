import { utcOffsetMinutes } from '@/lib/format';
import { cleanParams } from '@/lib/utils';
import { api } from '../client';
import type { DateOnly, Guid, PageParams } from '../dto/common';
import type {
  CreateSaleRequestDto, CreateSaleReturnRequestDto, MpesaTransactionDto, PrescriptionRegisterEntryDto, SaleDto, SalePreviewDto, SaleQuery,
  SaleReturnDto,
} from '../dto/sales';

export const salesApi = {
  /** Needs Sales.View, not Sales.Create. */
  preview: (body: CreateSaleRequestDto, signal?: AbortSignal) => api.post<SalePreviewDto>('/sales/preview', body, { signal }),
  /** Never retried automatically: there is no idempotency key. */
  create: (body: CreateSaleRequestDto) => api.post<SaleDto>('/sales', body),
  list: (query: SaleQuery) => api.getPaged<SaleDto>('/sales', cleanParams({ ...query, utcOffsetMinutes: utcOffsetMinutes() })),
  get: (id: Guid) => api.get<SaleDto>(`/sales/${id}`),
  void: (id: Guid) => api.post<SaleDto>(`/sales/${id}/void`),
  /** Asks M-Pesa for the STK push result and settles the sale as Completed or Failed. */
  reconcileMpesa: (id: Guid) => api.post<SaleDto>(`/sales/${id}/mpesa/reconcile`),
  createReturn: (id: Guid, body: CreateSaleReturnRequestDto) => api.post<SaleReturnDto>(`/sales/${id}/returns`, body),
  returnsForSale: (id: Guid) => api.get<SaleReturnDto[]>(`/sales/${id}/returns`),
  returns: (query: PageParams & { from?: DateOnly; to?: DateOnly }) =>
    api.getPaged<SaleReturnDto>('/sales/returns', cleanParams({ ...query, utcOffsetMinutes: utcOffsetMinutes() })),
  prescriptions: (query: { from: DateOnly; to: DateOnly; search?: string }) =>
    api.get<PrescriptionRegisterEntryDto[]>('/sales/prescriptions', cleanParams({ ...query, utcOffsetMinutes: utcOffsetMinutes() })),
};

export const mpesaApi = {
  /** This business's till payments, routed by its short code. */
  unmatched: () => api.get<MpesaTransactionDto[]>('/mpesa/transactions/unmatched'),
  registerC2bUrls: () => api.post<{ registered: boolean }>('/mpesa/c2b/register-urls'),
};
