'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useActiveBusiness, usePermission } from '@/hooks/useSessionInfo';
import { moduleLabels, type ModuleKey } from '@/config/businessCapabilities';
import type { PermissionRequirement } from '@/api/permissions';
import { ForbiddenState, NotUsedState } from './States';

/** Renders children only when the user holds the permission (any of a list). The API still enforces it. */
export function Can({ permission, children, fallback = null }: { permission: PermissionRequirement; children: ReactNode; fallback?: ReactNode }) {
  return usePermission(permission) ? <>{children}</> : <>{fallback}</>;
}

/** Renders children only when the business uses the module (presentation only: keep the permission check too). */
export function IfModule({ module, children, fallback = null }: { module: ModuleKey; children: ReactNode; fallback?: ReactNode }) {
  return useActiveBusiness().hasModule(module) ? <>{children}</> : <>{fallback}</>;
}

/**
 * Page guard. A module the business doesn't use shows "not used by this business" (not a 403: the user did nothing wrong); a missing
 * permission shows the 403 page. Both are needed to see the page.
 */
export function PermissionRoute({ permission, module, children }: { permission?: PermissionRequirement; module?: ModuleKey; children: ReactNode }) {
  const allowed = usePermission(permission);
  const { hasModule } = useActiveBusiness();
  if (module && !hasModule(module)) return <ModuleNotUsed module={module} />;
  if (!allowed) return <ForbiddenState />;
  return <>{children}</>;
}

export function ModuleNotUsed({ module }: { module: ModuleKey }) {
  const name = moduleLabels[module] ?? 'This area';
  return (
    <NotUsedState
      title="Not used by this business"
      message={`${name} isn't part of this business's setup. If you need it, contact support.`}
      action={<Button asChild><Link href="/dashboard">Back to dashboard</Link></Button>}
    />
  );
}
