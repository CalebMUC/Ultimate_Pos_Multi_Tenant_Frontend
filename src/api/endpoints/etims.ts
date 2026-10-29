import { cleanParams } from '@/lib/utils';
import { api } from '../client';
import type { Guid } from '../dto/common';
import type {
  EtimsCodeDto, EtimsDeviceDto, EtimsItemClassDto, EtimsLookupDto, EtimsLookupKind, EtimsProductProfileDto, EtimsReceiptDto, EtimsReferenceSyncDto,
  EtimsRunResultDto, EtimsSubmissionDetailDto, EtimsSubmissionDto, EtimsSubmissionQuery, RegisterEtimsDeviceRequestDto, UpdateEtimsDeviceRequestDto,
  UpdateEtimsProductProfileRequestDto,
} from '../dto/etims';

/** Calls that wait on KRA, which can be slow. */
export const KRA_TIMEOUT = { timeout: 60_000 };

/**
 * KRA eTIMS. Reads need Etims.View, changes Etims.Manage; a sale's receipt block needs only Sales.View. While the business has eTIMS
 * switched off every change is refused with 400 INVALID_ASSIGNMENT, so only call these when the "etims" module is on.
 */
export const etimsApi = {
  devices: () => api.get<EtimsDeviceDto[]>('/etims/devices'),
  device: (id: Guid) => api.get<EtimsDeviceDto>(`/etims/devices/${id}`),
  /** Initialises the device with KRA. KRA's refusal (e.g. "This device is installed") comes back as the error message. */
  registerDevice: (body: RegisterEtimsDeviceRequestDto) => api.post<EtimsDeviceDto>('/etims/devices', body, KRA_TIMEOUT),
  /** Full replace. */
  updateDevice: (id: Guid, body: UpdateEtimsDeviceRequestDto) => api.put<EtimsDeviceDto>(`/etims/devices/${id}`, body),
  /** Queues what is new at the branch and sends what is due, now. */
  run: (id: Guid) => api.post<EtimsRunResultDto>(`/etims/devices/${id}/run`, undefined, KRA_TIMEOUT),
  /** Downloads KRA's code lists, item classifications and notices. */
  syncCodes: (id: Guid) => api.post<EtimsReferenceSyncDto[]>(`/etims/devices/${id}/sync-codes`, undefined, KRA_TIMEOUT),
  /** 404 NOT_FOUND until the lists are downloaded. */
  codes: (id: Guid, codeClass?: string) => api.get<EtimsCodeDto[]>(`/etims/devices/${id}/codes`, cleanParams({ codeClass })),
  itemClasses: (id: Guid, search?: string, take = 50, signal?: AbortSignal) =>
    api.get<EtimsItemClassDto[]>(`/etims/devices/${id}/item-classes`, cleanParams({ search: search || undefined, take }), { signal }),
  /** A read from KRA, passed through. argument: the PIN (customer-pin) or the invoice number (invoice). */
  lookup: (id: Guid, what: EtimsLookupKind, argument?: string) =>
    api.get<EtimsLookupDto>(`/etims/devices/${id}/kra/${what}`, cleanParams({ argument: argument || undefined }), KRA_TIMEOUT),

  /** Works before the product was ever reported. */
  product: (productId: Guid) => api.get<EtimsProductProfileDto>(`/etims/products/${productId}`),
  updateProduct: (productId: Guid, body: UpdateEtimsProductProfileRequestDto) => api.put<EtimsProductProfileDto>(`/etims/products/${productId}`, body),
  /** There is no GET: the API keeps it, the list of categories doesn't show it. */
  setCategoryClass: (categoryId: Guid, itemClassCode: string) => api.put<void>(`/etims/categories/${categoryId}`, { itemClassCode }),

  /** Newest first. */
  submissions: (query: EtimsSubmissionQuery) => api.getPaged<EtimsSubmissionDto>('/etims/submissions', cleanParams(query)),
  submission: (id: Guid) => api.get<EtimsSubmissionDetailDto>(`/etims/submissions/${id}`),
  /** Rejected or Failed → Pending, sent on the next pass. */
  retry: (id: Guid) => api.post<EtimsSubmissionDto>(`/etims/submissions/${id}/retry`),

  /** 404 NOT_FOUND when the sale will never be reported (no active device at its branch, or it predates the device). */
  saleReceipt: (saleId: Guid) => api.get<EtimsReceiptDto>(`/etims/sales/${saleId}/receipt`),
};
