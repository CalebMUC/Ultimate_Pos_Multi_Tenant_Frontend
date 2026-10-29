'use client';

import { useQuery } from '@tanstack/react-query';
import { etimsApi } from '@/api/endpoints/etims';
import { ApiError } from '@/api/errors';
import { EtimsSubmissionStatus, labels } from '@/api/enums';
import { useHasModule, usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import type { BadgeVariant } from '@/components/ui/primitives';
import type { EtimsCodeDto, EtimsDeviceDto } from '@/api/dto/etims';
import { useEtimsScope } from './scope';

// eTIMS queries share the "etims" resource, so one invalidation refreshes the area after any change. Every query here is off unless the
// business has the "etims" module: a business without it never calls /etims.

export const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404;

/** The business's devices (Etims.View), one per branch. */
export function useEtimsDevices() {
  const key = useQueryKey();
  const used = useHasModule('etims');
  const allowed = usePermission('Etims.View');
  const enabled = used && allowed;
  return useQuery({ queryKey: key('etims', { devices: true }), queryFn: etimsApi.devices, enabled });
}

/**
 * The device KRA's lists are read through: the first active one. Null when there is none (or the user can't see devices). On the
 * platform, the devices of the business it is looking after.
 */
export function useListsDevice(): EtimsDeviceDto | null {
  const scoped = useEtimsScope().devices;
  // Off on the platform: a super user has no business, so no "etims" module.
  const own = useEtimsDevices();
  return (scoped ?? own.data)?.find((d) => d.isActive) ?? null;
}

/**
 * One of KRA's code lists (10: quantity units, 17: packaging units), two-letter codes only: KRA builds item codes only from those.
 * Empty when no device has downloaded the lists yet (404).
 */
export function useTwoLetterCodes(codeClass: '10' | '17') {
  const key = useQueryKey();
  const device = useListsDevice();
  const query = useQuery({
    queryKey: key('etims', { codes: codeClass, device: device?.etimsDeviceId }),
    queryFn: async (): Promise<EtimsCodeDto[]> => {
      try {
        return await etimsApi.codes(device!.etimsDeviceId, codeClass);
      } catch (e) {
        if (isNotFound(e)) return [];
        throw e;
      }
    },
    enabled: !!device?.lastCodeSyncAt,
    staleTime: 10 * 60_000,
  });
  const codes = (query.data ?? []).filter((c) => c.code.length === 2 && c.useYn !== 'N');
  return { ...query, codes, available: codes.length > 0 };
}

export const submissionStatusVariant: Record<EtimsSubmissionStatus, BadgeVariant> = {
  [EtimsSubmissionStatus.Sent]: 'success',
  [EtimsSubmissionStatus.Pending]: 'secondary',
  [EtimsSubmissionStatus.Failed]: 'warning',
  [EtimsSubmissionStatus.Rejected]: 'destructive',
};

/** What a submission reports, as a link where the app has a page for it. */
export function sourceHref(sourceType: string, sourceId: string): string | null {
  switch (sourceType) {
    case 'Product': return `/products/${sourceId}`;
    case 'Sale':
    case 'SaleVoid': return `/sales/${sourceId}`;
    case 'SaleReturn': return '/sales/returns';
    default: return null;
  }
}

/** ?status= takes the number or the name ("Rejected"). */
export function parseStatus(raw: string | null): EtimsSubmissionStatus | null {
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  if (Number.isInteger(n) && n in labels.etimsSubmissionStatus) return n as EtimsSubmissionStatus;
  const byName = EtimsSubmissionStatus[raw as keyof typeof EtimsSubmissionStatus];
  return typeof byName === 'number' ? byName : null;
}

/** KRA prints at most this many characters of each receipt message. */
export const RECEIPT_MESSAGE_MAX = 20;
