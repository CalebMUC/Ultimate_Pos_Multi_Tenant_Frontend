'use client';

import { useCallback } from 'react';
import { usePermissions } from '@/hooks/useSessionInfo';
import type { PermissionRequirement } from '@/api/permissions';
import type { BranchFilter } from '@/features/branches/branches';

type Query = Record<string, string | number | null | undefined>;

/**
 * The page behind a dashboard card, with the dashboard's branch and any filters the page reads from its URL. Undefined when the user
 * may not open that page, so the card stays plain instead of leading to a "no access" screen.
 */
export function useCardLink(branch: BranchFilter) {
  const can = usePermissions();
  return useCallback(
    (permission: PermissionRequirement, path: string, query: Query = {}) => {
      if (!can(permission)) return undefined;
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries({ ...query, branchId: branch.branchId })) if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
      const qs = params.toString();
      return qs ? `${path}?${qs}` : path;
    },
    [can, branch.branchId],
  );
}
