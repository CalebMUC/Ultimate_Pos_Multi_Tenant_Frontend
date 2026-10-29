'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { etimsApi } from '@/api/endpoints/etims';
import { platformEtimsApi } from '@/api/endpoints/platformEtims';
import type { EtimsSubmissionStatus } from '@/api/enums';
import type { Guid } from '@/api/dto/common';
import type {
  EtimsDeviceDto, EtimsItemClassDto, EtimsReferenceSyncDto, EtimsRunResultDto, EtimsSubmissionDetailDto, EtimsSubmissionDto,
  RegisterEtimsDeviceRequestDto, UpdateEtimsDeviceRequestDto,
} from '@/api/dto/etims';
import type { Permission } from '@/api/permissions';

// The device cards and dialogs, the classification picker and the submission drawer are shared by the business's own eTIMS pages and
// the platform's onboarding of a business. The scope says whose routes and permissions they use.

export type EtimsScope = { kind: 'business' } | { kind: 'platform'; businessId: Guid };

export interface EtimsScopeValue {
  scope: EtimsScope;
  view: Permission;
  manage: Permission;
  /** The query-key resource its reads use: invalidated after every change. */
  resource: string;
  /** The platform's: the business's devices, for the classification picker (the business scope reads its own). */
  devices?: readonly EtimsDeviceDto[];
  calls: {
    registerDevice(body: RegisterEtimsDeviceRequestDto): Promise<EtimsDeviceDto>;
    updateDevice(deviceId: Guid, body: UpdateEtimsDeviceRequestDto): Promise<EtimsDeviceDto>;
    syncCodes(deviceId: Guid): Promise<EtimsReferenceSyncDto[]>;
    run(deviceId: Guid): Promise<EtimsRunResultDto>;
    itemClasses(deviceId: Guid, search?: string, take?: number, signal?: AbortSignal): Promise<EtimsItemClassDto[]>;
    submission(id: Guid): Promise<EtimsSubmissionDetailDto>;
    retry(id: Guid): Promise<EtimsSubmissionDto>;
  };
  /** The submissions list filtered to a device (and a status). */
  submissionsHref(deviceId: Guid, status?: EtimsSubmissionStatus): string;
  /** Whether sources link to their sale or product page: only inside the business. */
  linksSources: boolean;
}

const business: EtimsScopeValue = {
  scope: { kind: 'business' },
  view: 'Etims.View',
  manage: 'Etims.Manage',
  resource: 'etims',
  calls: etimsApi,
  submissionsHref: (deviceId, status) => `/admin/etims/submissions?${filterParams({ deviceId }, status)}`,
  linksSources: true,
};

function filterParams(base: Record<string, string>, status?: EtimsSubmissionStatus) {
  const params = new URLSearchParams(base);
  if (status !== undefined) params.set('status', String(status));
  return params;
}

export function platformScope(businessId: Guid, devices: readonly EtimsDeviceDto[]): EtimsScopeValue {
  return {
    scope: { kind: 'platform', businessId },
    view: 'Platform.Etims.View',
    manage: 'Platform.Etims.Manage',
    resource: 'platform',
    devices,
    calls: {
      registerDevice: (body) => platformEtimsApi.registerDevice(businessId, body),
      updateDevice: (deviceId, body) => platformEtimsApi.updateDevice(businessId, deviceId, body),
      syncCodes: (deviceId) => platformEtimsApi.syncCodes(businessId, deviceId),
      run: (deviceId) => platformEtimsApi.run(businessId, deviceId),
      itemClasses: (deviceId, search, take, signal) => platformEtimsApi.itemClasses(businessId, deviceId, search, take, signal),
      submission: platformEtimsApi.submission,
      retry: platformEtimsApi.retry,
    },
    submissionsHref: (deviceId, status) => `/platform/etims?${filterParams({ tab: 'submissions', businessId, deviceId }, status)}`,
    linksSources: false,
  };
}

const EtimsScopeContext = createContext<EtimsScopeValue>(business);

/** The business's own scope unless a provider says otherwise. */
export function useEtimsScope() {
  return useContext(EtimsScopeContext);
}

/** The platform's routes and permissions for one business, for everything inside. */
export function PlatformEtimsScope({ businessId, devices, children }: { businessId: Guid; devices: readonly EtimsDeviceDto[]; children: ReactNode }) {
  const value = useMemo(() => platformScope(businessId, devices), [businessId, devices]);
  return <EtimsScopeContext.Provider value={value}>{children}</EtimsScopeContext.Provider>;
}

/** The platform's submission drawer: no business to link into. */
export function PlatformSubmissionScope({ children }: { children: ReactNode }) {
  // Only the submission calls are used here: the business is named by the submission itself.
  return <PlatformEtimsScope businessId="" devices={EMPTY}>{children}</PlatformEtimsScope>;
}
const EMPTY: readonly EtimsDeviceDto[] = [];
