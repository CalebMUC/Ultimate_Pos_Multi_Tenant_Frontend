import { useCallback } from 'react';
import { useSession } from '@/stores/session';
import { capabilitiesFor } from '@/config/businessCapabilities';
import type { Permission, PermissionRequirement } from '@/api/permissions';

export function useBusinessId() {
  return useSession((s) => s.activeBusinessId);
}

/**
 * Query keys are always [resource, businessId, params], so one business's data can never be served from cache inside another.
 * Invalidate by the resource prefix: queryClient.invalidateQueries({ queryKey: ['sales'] }).
 */
export function useQueryKey() {
  const businessId = useBusinessId();
  return useCallback((resource: string, params?: unknown) => [resource, businessId, params ?? null] as const, [businessId]);
}

export function hasPermission(granted: readonly string[], required: PermissionRequirement | undefined): boolean {
  if (!required) return true;
  const list = (typeof required === 'string' ? [required] : required) as readonly Permission[];
  return list.length === 0 || list.some((p) => granted.includes(p));
}

export function usePermission(required?: PermissionRequirement): boolean {
  const permissions = useSession((s) => s.user?.permissions);
  return hasPermission(permissions ?? [], required);
}

/** A checker for many permissions at once. */
export function usePermissions() {
  const permissions = useSession((s) => s.user?.permissions);
  return useCallback((required?: PermissionRequirement) => hasPermission(permissions ?? [], required), [permissions]);
}

/** The signed-in business's membership (always available) and profile (once loaded). */
export function useActiveBusiness() {
  const activeBusinessId = useSession((s) => s.activeBusinessId);
  const businesses = useSession((s) => s.businesses);
  const business = useSession((s) => s.business);
  const membership = businesses.find((b) => b.businessId === activeBusinessId) ?? null;
  const kind = business?.kind ?? membership?.kind ?? null;
  return { activeBusinessId, membership, business, kind, capabilities: capabilitiesFor(kind) };
}
