'use client';

import type { ReactNode } from 'react';
import { useActiveBusiness, usePermission } from '@/hooks/useSessionInfo';
import type { PermissionRequirement } from '@/api/permissions';
import type { Capability } from '@/config/businessCapabilities';
import { ForbiddenState } from './States';

/** Renders children only when the user holds the permission (any of a list). The API still enforces it. */
export function Can({ permission, children, fallback = null }: { permission: PermissionRequirement; children: ReactNode; fallback?: ReactNode }) {
  return usePermission(permission) ? <>{children}</> : <>{fallback}</>;
}

/** Renders children only when the business kind has the capability (production for manufacturers). */
export function IfCapable({ capability, children }: { capability: Capability; children: ReactNode }) {
  const { capabilities } = useActiveBusiness();
  return capabilities[capability] ? <>{children}</> : null;
}

/** Page guard: shows a 403 page instead of the page when the permission (or capability) is missing. */
export function PermissionRoute({ permission, requires, children }: { permission?: PermissionRequirement; requires?: Capability; children: ReactNode }) {
  const allowed = usePermission(permission);
  const { capabilities } = useActiveBusiness();
  if (requires && !capabilities[requires]) {
    return <ForbiddenState title="Not available for this business" message="This module is only available to manufacturing businesses." />;
  }
  if (!allowed) return <ForbiddenState />;
  return <>{children}</>;
}
