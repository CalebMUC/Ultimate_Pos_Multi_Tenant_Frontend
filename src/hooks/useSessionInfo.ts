import { useCallback, useEffect, useState } from 'react';
import { useSession } from '@/stores/session';
import { moduleEnabled, type ModuleKey } from '@/config/businessCapabilities';
import { tokenStorage, type StoredBranding } from '@/api/tokenStorage';
import type { Permission, PermissionRequirement } from '@/api/permissions';

/** The client remembered on this device. Undefined until read: there is no browser storage in the server render. */
export function useStoredBranding() {
  const [branding, setBranding] = useState<StoredBranding | null>();
  useEffect(() => setBranding(tokenStorage.getBranding()), []);
  return branding;
}

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

/**
 * The signed-in business's membership (always available) and profile (once loaded), with the modules it uses. The membership is
 * replaced on every refresh, switch and /auth/me, the profile on every GET /businesses/current: the newer of the two wins, so a
 * super user's reclassification shows as soon as either is re-read.
 */
export function useActiveBusiness() {
  const activeBusinessId = useSession((s) => s.activeBusinessId);
  const businesses = useSession((s) => s.businesses);
  const business = useSession((s) => s.business);
  const businessLoadedAt = useSession((s) => s.businessLoadedAt);
  const membershipsAt = useSession((s) => s.membershipsAt);
  const membership = businesses.find((b) => b.businessId === activeBusinessId) ?? null;
  const kind = business?.kind ?? membership?.kind ?? null;
  const profileNewer = !!business?.modules && businessLoadedAt >= membershipsAt;
  const modules = (profileNewer ? business?.modules : membership?.modules ?? business?.modules) ?? null;
  const sector = (profileNewer ? business?.sector : membership?.sector ?? business?.sector) ?? null;
  const hasModule = useCallback((key: ModuleKey) => moduleEnabled(modules, kind, key), [modules, kind]);
  return { activeBusinessId, membership, business, kind, sector, modules, hasModule };
}

/** Whether the active business uses a module (presentation only: permissions are still checked separately). */
export function useHasModule(key: ModuleKey): boolean {
  return useActiveBusiness().hasModule(key);
}
