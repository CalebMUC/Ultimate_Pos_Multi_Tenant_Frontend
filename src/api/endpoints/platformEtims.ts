import { cleanParams } from '@/lib/utils';
import { api } from '../client';
import type { Guid } from '../dto/common';
import type {
  EtimsDeviceDto, EtimsItemClassDto, EtimsReferenceSyncDto, EtimsRunResultDto, EtimsSubmissionDetailDto, EtimsSubmissionDto,
  PlatformEtimsBusinessDto, PlatformEtimsOverviewDto, PlatformEtimsSubmissionDto, PlatformEtimsSubmissionQuery, RegisterEtimsDeviceRequestDto,
  UpdateEtimsDeviceRequestDto,
} from '../dto/etims';
import { KRA_TIMEOUT } from './etims';

/**
 * KRA eTIMS for super users: the platform reports every business through its own KRA credentials. Reads need Platform.Etims.View,
 * changes Platform.Etims.Manage. The same rules as the business's own routes apply inside the business named (and are audited there);
 * while its eTIMS is off, changes are refused with 400 INVALID_ASSIGNMENT. eTIMS itself is switched with platformApi.changeEtims.
 */
export const platformEtimsApi = {
  overview: () => api.get<PlatformEtimsOverviewDto>('/platform/etims'),
  /** Most recently attempted first. No status: Failed and Rejected. */
  submissions: (query: PlatformEtimsSubmissionQuery) => api.getPaged<PlatformEtimsSubmissionDto>('/platform/etims/submissions', cleanParams(query)),
  submission: (id: Guid) => api.get<EtimsSubmissionDetailDto>(`/platform/etims/submissions/${id}`),
  retry: (id: Guid) => api.post<EtimsSubmissionDto>(`/platform/etims/submissions/${id}/retry`),

  /** Every branch, each with its device (null = not registered yet). */
  business: (businessId: Guid) => api.get<PlatformEtimsBusinessDto>(`/platform/etims/businesses/${businessId}`),
  registerDevice: (businessId: Guid, body: RegisterEtimsDeviceRequestDto) =>
    api.post<EtimsDeviceDto>(`/platform/etims/businesses/${businessId}/devices`, body, KRA_TIMEOUT),
  updateDevice: (businessId: Guid, deviceId: Guid, body: UpdateEtimsDeviceRequestDto) =>
    api.put<EtimsDeviceDto>(`/platform/etims/businesses/${businessId}/devices/${deviceId}`, body),
  syncCodes: (businessId: Guid, deviceId: Guid) =>
    api.post<EtimsReferenceSyncDto[]>(`/platform/etims/businesses/${businessId}/devices/${deviceId}/sync-codes`, undefined, KRA_TIMEOUT),
  itemClasses: (businessId: Guid, deviceId: Guid, search?: string, take = 50, signal?: AbortSignal) =>
    api.get<EtimsItemClassDto[]>(`/platform/etims/businesses/${businessId}/devices/${deviceId}/item-classes`, cleanParams({ search: search || undefined, take }), { signal }),
  run: (businessId: Guid, deviceId: Guid) =>
    api.post<EtimsRunResultDto>(`/platform/etims/businesses/${businessId}/devices/${deviceId}/run`, undefined, KRA_TIMEOUT),
};
