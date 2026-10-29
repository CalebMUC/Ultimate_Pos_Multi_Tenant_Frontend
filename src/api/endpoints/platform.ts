import type { BusinessSector } from '../enums';
import { utcOffsetMinutes } from '@/lib/format';
import { cleanParams } from '@/lib/utils';
import { api } from '../client';
import type { DateOnly, Guid, PageParams } from '../dto/common';
import type { UserDto } from '../dto/identity';
import type { AuditLogEntryDto } from '../dto/notifications';
import type {
  BusinessDetailDto, BusinessLicenseDto, BusinessOwnerRequestDto, BusinessOwnerResultDto, BusinessSummaryDto, CreatedAccountDto,
  CreateSuperUserRequestDto, IssueLicenseRequestDto, PlatformDashboardDto,
} from '../dto/platform';

export interface PlatformAuditQuery extends PageParams {
  /** A business's log; without it, the platform's own events (registrations, super users). */
  businessId?: Guid;
  from?: DateOnly;
  to?: DateOnly;
  eventType?: string;
  actorUserId?: Guid;
  search?: string;
}

/** The Super User area. Every call needs a platform permission. Registering a business is businessesApi.register. */
export const platformApi = {
  dashboard: (from?: DateOnly, to?: DateOnly) =>
    api.get<PlatformDashboardDto>('/platform/dashboard', cleanParams({ from, to, utcOffsetMinutes: utcOffsetMinutes() })),

  /** sector narrows to one line of business. */
  businesses: (sector?: BusinessSector | null) => api.get<BusinessSummaryDto[]>('/platform/businesses', cleanParams({ sector })),
  /** Reclassifies a business (Businesses.Register). Only the classification and its menus change. 400 if it is already that sector. */
  changeSector: (id: Guid, sector: BusinessSector) => api.put<BusinessSummaryDto>(`/platform/businesses/${id}/sector`, { sector }),
  /** Switches KRA eTIMS reporting on or off (Businesses.Register). 400 INVALID_ASSIGNMENT if it is already in that state. */
  changeEtims: (id: Guid, enabled: boolean) => api.put<BusinessSummaryDto>(`/platform/businesses/${id}/etims`, { enabled }),
  business: (id: Guid) => api.get<BusinessDetailDto>(`/platform/businesses/${id}`),
  suspend: (id: Guid, reason: string) => api.post<BusinessSummaryDto>(`/platform/businesses/${id}/suspend`, { reason }),
  reactivate: (id: Guid) => api.post<BusinessSummaryDto>(`/platform/businesses/${id}/reactivate`),
  close: (id: Guid, reason: string) => api.post<BusinessSummaryDto>(`/platform/businesses/${id}/close`, { reason }),
  reopen: (id: Guid) => api.post<BusinessSummaryDto>(`/platform/businesses/${id}/reopen`),

  licenses: (businessId: Guid) => api.get<BusinessLicenseDto[]>(`/platform/businesses/${businessId}/licenses`),
  issueLicense: (businessId: Guid, body: IssueLicenseRequestDto) => api.post<BusinessLicenseDto>(`/platform/businesses/${businessId}/licenses`, body),
  cancelLicense: (licenseId: Guid, reason: string) => api.post<BusinessLicenseDto>(`/platform/licenses/${licenseId}/cancel`, { reason }),
  /** Ending within the window, plus those already ended but still in grace. */
  expiringLicenses: (withinDays = 30) => api.get<BusinessLicenseDto[]>('/platform/licenses/expiring', { withinDays }),

  businessUsers: (businessId: Guid) => api.get<UserDto[]>(`/platform/businesses/${businessId}/users`),
  addAdmin: (businessId: Guid, body: BusinessOwnerRequestDto) => api.post<BusinessOwnerResultDto>(`/platform/businesses/${businessId}/admins`, body),
  resetUserPassword: (businessId: Guid, userId: Guid) => api.post<CreatedAccountDto>(`/platform/businesses/${businessId}/users/${userId}/reset-password`),
  unlockUser: (businessId: Guid, userId: Guid) => api.post<UserDto>(`/platform/businesses/${businessId}/users/${userId}/unlock`),
  auditLog: (query: PlatformAuditQuery, signal?: AbortSignal) => {
    const params = cleanParams({ ...query, search: query.search?.trim() || undefined });
    return api.getPaged<AuditLogEntryDto>('/platform/audit-log', query.from || query.to ? { ...params, utcOffsetMinutes: utcOffsetMinutes() } : params, { signal });
  },

  superUsers: () => api.get<UserDto[]>('/platform/super-users'),
  createSuperUser: (body: CreateSuperUserRequestDto) => api.post<CreatedAccountDto>('/platform/super-users', body),
  activateSuperUser: (id: Guid) => api.post<UserDto>(`/platform/super-users/${id}/activate`),
  deactivateSuperUser: (id: Guid) => api.post<UserDto>(`/platform/super-users/${id}/deactivate`),
};
