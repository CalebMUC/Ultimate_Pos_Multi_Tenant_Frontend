'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LoadingState } from '@/components/shared/States';
import { useSession } from '@/stores/session';
import { hasPermission } from '@/hooks/useSessionInfo';
import type { Guid } from '@/api/dto/common';

/** Where to land after sign-in: the dashboard if allowed, else the POS, else the first thing the user may see. */
export function homePathFor(permissions: readonly string[], activeBusinessId: Guid | null): string {
  if (!activeBusinessId) return hasPermission(permissions, ['Businesses.ViewAll', 'Businesses.Register']) ? '/admin/businesses' : '/select-business';
  if (hasPermission(permissions, 'Dashboard.View')) return '/dashboard';
  if (hasPermission(permissions, 'Sales.Create')) return '/pos';
  if (hasPermission(permissions, 'Sales.View')) return '/sales';
  if (hasPermission(permissions, 'Products.View')) return '/products';
  return '/settings';
}

const PLATFORM_PATHS = ['/admin/businesses', '/settings', '/select-business', '/account'];

/**
 * Keeps signed-out users on /login, and users without a business (platform-only) inside the platform area.
 * Waits for the session restore on first load.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useSession((s) => s.status);
  const activeBusinessId = useSession((s) => s.activeBusinessId);
  const needsBusiness = status === 'authenticated' && !activeBusinessId && !PLATFORM_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (status === 'anonymous') router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
    else if (needsBusiness) router.replace('/admin/businesses');
  }, [status, needsBusiness, pathname, router]);

  if (status !== 'authenticated' || needsBusiness) return <LoadingState className="min-h-screen" />;
  return <>{children}</>;
}
