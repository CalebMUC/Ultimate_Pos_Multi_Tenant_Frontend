'use client';

import { useQuery } from '@tanstack/react-query';
import { platformApi } from '@/api/endpoints/platform';
import type { BusinessSector } from '@/api/enums';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';

// Platform queries share the "platform" resource, so one invalidation refreshes the area after any action.

export function usePlatformBusinesses(sector: BusinessSector | null = null) {
  const key = useQueryKey();
  const allowed = usePermission('Businesses.ViewAll');
  return useQuery({ queryKey: key('platform', { businesses: true, sector }), queryFn: () => platformApi.businesses(sector), enabled: allowed });
}

export function useExpiringLicenses(withinDays: number) {
  const key = useQueryKey();
  const allowed = usePermission('Licenses.View');
  return useQuery({ queryKey: key('platform', { expiring: withinDays }), queryFn: () => platformApi.expiringLicenses(withinDays), enabled: allowed });
}
