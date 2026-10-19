'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Building2, CalendarX2, Loader2, LogOut, ShieldAlert, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/primitives';
import { BrandMark } from '@/components/layout/BrandMark';
import { normaliseError } from '@/api/errors';
import { labels } from '@/api/enums';
import { logout, switchBusiness } from '@/features/auth/sessionActions';
import { homePathFor } from '@/features/auth/AuthGuard';
import { useAccess } from '@/stores/access';
import { useSession } from '@/stores/session';
import { accessScreen, accessStatusStyle, isBlockedStatus } from './access';
import { AccessStatusBadge, SupportContact } from './AccessComponents';

const icons: Record<string, typeof Ban> = { BUSINESS_SUSPENDED: ShieldAlert, BUSINESS_CLOSED: Ban, LICENSE_EXPIRED: CalendarX2, UNLICENSED: CalendarX2, NO_BRANCH: Store };

/** Full page, for a business that is suspended, closed or out of licence. Offers the user's other businesses, and sign-out. */
export function BlockedScreen({ code }: { code: string | null }) {
  const router = useRouter();
  const blocked = useAccess((s) => s.blocked);
  const status = useSession((s) => s.status);
  const businesses = useSession((s) => s.businesses);
  const activeBusinessId = useSession((s) => s.activeBusinessId);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const effective = code ?? blocked?.code ?? null;
  const screen = accessScreen(effective);
  const message = blocked && blocked.code === effective ? blocked.message : null;
  const Icon = icons[effective ?? ''] ?? ShieldAlert;
  const others = status === 'authenticated' ? businesses.filter((b) => b.businessId !== activeBusinessId) : [];

  async function switchTo(businessId: string) {
    setPending(businessId);
    setError(null);
    try {
      const data = await switchBusiness(businessId);
      useAccess.getState().setBlocked(null);
      router.replace(homePathFor(data.user.permissions, data.activeBusinessId, data.mustChangePassword ?? false));
    } catch (e) {
      const apiError = normaliseError(e);
      // Once the session can't be renewed, the way out is to sign in again: the API then picks a business that can be used.
      setError(apiError.status === 401 || apiError.code === 'INVALID_TOKEN' ? 'Your session has ended. Sign in again to choose another business.' : apiError.message);
    } finally {
      setPending(null);
    }
  }

  async function signOut() {
    await logout();
    useAccess.getState().setBlocked(null);
    window.location.assign('/login');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6">
      <BrandMark dark={false} />
      <Card className="w-full max-w-lg p-6 text-center" role="alert">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive"><Icon className="size-7" /></div>
        <h1 className="text-xl font-semibold">{screen.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{screen.description}</p>
        {screen.showReason && message && <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm">{message}</p>}
        {effective !== 'NO_BRANCH' && <SupportContact className="mt-4" />}

        {others.length > 0 && (
          <div className="mt-6 space-y-2 text-left">
            <p className="text-sm font-medium">Switch business</p>
            <ul className="space-y-1.5">
              {others.map((b) => {
                const blockedHere = isBlockedStatus(b.accessStatus);
                return (
                  <li key={b.businessId}>
                    <button
                      type="button"
                      disabled={blockedHere || !!pending}
                      title={blockedHere ? `${accessStatusStyle(b.accessStatus).label}: can’t be used` : undefined}
                      onClick={() => switchTo(b.businessId)}
                      className="flex w-full items-center gap-3 rounded-md border p-3 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                    >
                      <Building2 className="size-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{b.tradingName || b.businessName}</span>
                        <span className="text-xs text-muted-foreground">{labels.businessKind[b.kind]} · {labels.businessType[b.businessType]}</span>
                      </span>
                      {b.accessStatus && <AccessStatusBadge status={b.accessStatus} />}
                      {pending === b.businessId && <Loader2 className="size-4 animate-spin" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-6 flex justify-center">
          {status === 'authenticated' ? (
            <Button variant="outline" onClick={signOut}><LogOut />Sign out</Button>
          ) : (
            <Button variant="outline" onClick={signOut}><LogOut />Back to sign in</Button>
          )}
        </div>
      </Card>
    </div>
  );
}
