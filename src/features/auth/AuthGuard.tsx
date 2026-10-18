'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LoadingState } from '@/components/shared/States';
import { sessionSelectors, useSession } from '@/stores/session';
import { hasPermission } from '@/hooks/useSessionInfo';
import { PLATFORM_PERMISSIONS } from '@/api/permissions';
import type { Guid } from '@/api/dto/common';

export function isPlatformAccount(permissions: readonly string[], activeBusinessId: Guid | null) {
  return !activeBusinessId && hasPermission(permissions, PLATFORM_PERMISSIONS);
}

/**
 * Where to land after sign-in: the password change if one is owed; the platform area for Super Users; otherwise the dashboard,
 * the POS, or the first business screen the user may see.
 */
export function homePathFor(permissions: readonly string[], activeBusinessId: Guid | null, mustChangePassword = false): string {
  if (mustChangePassword) return '/change-password';
  if (isPlatformAccount(permissions, activeBusinessId)) return '/platform';
  if (!activeBusinessId) return '/select-business';
  if (hasPermission(permissions, 'Dashboard.View')) return '/dashboard';
  if (hasPermission(permissions, 'Sales.Create')) return '/pos';
  if (hasPermission(permissions, 'Sales.View')) return '/sales';
  if (hasPermission(permissions, 'Products.View')) return '/products';
  return '/settings';
}

/** Same-origin paths only, never a full URL, so returnTo can't send the user off-site. */
export function safeReturnTo(value: string | null | undefined): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/login') && !value.startsWith('/change-password') ? value : null;
}

type Area = 'business' | 'platform' | 'any';

/** Where a signed-in user on `pathname` must be sent instead, or null to stay. */
export function guardRedirect(
  state: { mustChangePassword: boolean; isPlatformUser: boolean; activeBusinessId: Guid | null; permissions: readonly string[] },
  area: Area,
  pathname: string,
): string | null {
  if (state.mustChangePassword) return pathname === '/change-password' ? null : `/change-password?returnTo=${encodeURIComponent(pathname)}`;
  if (area === 'business') {
    // Super Users have no business: the business app is closed to them.
    if (state.isPlatformUser) return '/platform';
    if (!state.activeBusinessId && pathname !== '/select-business') return '/select-business';
  }
  if (area === 'platform' && !state.isPlatformUser) return homePathFor(state.permissions, state.activeBusinessId);
  return null;
}

/**
 * Keeps signed-out users on /login, sends anyone who owes a password change to /change-password, Super Users to /platform and
 * business users out of it. Waits for the session restore on first load.
 */
export function AuthGuard({ children, area = 'business' }: { children: ReactNode; area?: Area }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useSession((s) => s.status);
  const mustChangePassword = useSession((s) => s.mustChangePassword);
  const activeBusinessId = useSession((s) => s.activeBusinessId);
  const isPlatformUser = useSession(sessionSelectors.isPlatformUser);
  const permissions = useSession((s) => s.user?.permissions);
  const redirect = status === 'authenticated'
    ? guardRedirect({ mustChangePassword, isPlatformUser, activeBusinessId, permissions: permissions ?? [] }, area, pathname)
    : null;

  useEffect(() => {
    if (status === 'anonymous') router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
    else if (redirect) router.replace(redirect);
  }, [status, redirect, pathname, router]);

  if (status !== 'authenticated' || redirect) return <LoadingState className="min-h-screen" />;
  return <>{children}</>;
}

/**
 * Where to go after signing in. A password change comes first (then on to the destination); a returnTo is honoured only inside
 * the user's own area; a user of several businesses who hasn't picked one before chooses first.
 */
export function landingPath(
  state: { permissions: readonly string[]; activeBusinessId: Guid | null; mustChangePassword: boolean },
  returnTo: string | null,
  chooseBusiness = false,
): string {
  const platform = isPlatformAccount(state.permissions, state.activeBusinessId);
  const fitsArea = returnTo && (platform ? returnTo.startsWith('/platform') : !returnTo.startsWith('/platform'));
  const destination = chooseBusiness && !platform
    ? `/select-business${fitsArea ? `?returnTo=${encodeURIComponent(returnTo!)}` : ''}`
    : (fitsArea ? returnTo! : homePathFor(state.permissions, state.activeBusinessId));
  return state.mustChangePassword ? `/change-password?returnTo=${encodeURIComponent(destination)}` : destination;
}
