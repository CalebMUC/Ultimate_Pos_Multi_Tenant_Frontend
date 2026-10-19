'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Building2, ChevronRight, Loader2, Star } from 'lucide-react';
import { BrandMark } from '@/components/layout/BrandMark';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/States';
import { AuthGuard } from '@/features/auth/AuthGuard';
import { BusinessBadges, blockedReason, useSwitchBusiness } from '@/features/auth/BusinessSwitcher';
import { logout } from '@/features/auth/sessionActions';
import { useSession } from '@/stores/session';
import { cn } from '@/lib/utils';

function Picker() {
  const params = useSearchParams();
  const returnTo = params.get('returnTo');
  const businesses = useSession((s) => s.businesses);
  const activeBusinessId = useSession((s) => s.activeBusinessId);
  const user = useSession((s) => s.user);
  const { switchTo, pending } = useSwitchBusiness({ pickBranch: true });
  const branches = useSession((s) => s.branches);

  // The token is already for the active (default) business: choosing it needs no switch.
  async function choose(businessId: string) {
    if (businessId === activeBusinessId) {
      const next = returnTo && returnTo.startsWith('/') ? returnTo : '/';
      // Signing in continues to the branch picker when there is a choice to make.
      window.location.assign(branches.length > 1 ? `/select-branch?returnTo=${encodeURIComponent(next)}` : next);
      return;
    }
    await switchTo(businessId, returnTo && returnTo.startsWith('/') ? returnTo : null);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg space-y-6">
        <BrandMark dark={false} />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Choose a business</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {user?.fullName}. You can switch business at any time from the header.
          </p>
        </div>
        {businesses.length === 0 ? (
          <EmptyState title="No businesses" message="Your account is not linked to any business yet." />
        ) : (
          <ul className="space-y-2">
            {businesses.map((b) => (
              <li key={b.businessId}>
                <button
                  type="button"
                  disabled={!!pending || !!blockedReason(b.accessStatus)}
                  title={blockedReason(b.accessStatus) ?? undefined}
                  onClick={() => choose(b.businessId)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-card',
                    b.businessId === activeBusinessId && 'border-primary/60',
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Building2 className="size-5" /></span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="truncate">{b.tradingName || b.businessName}</span>
                      {b.isDefault && <Star className="size-3.5 fill-warning text-warning" aria-label="Default business" />}
                    </span>
                    <BusinessBadges membership={b} />
                  </span>
                  {pending === b.businessId ? <Loader2 className="size-4 animate-spin" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button variant="ghost" className="w-full" onClick={async () => { await logout(); window.location.assign('/login'); }}>
          Sign out
        </Button>
      </div>
    </div>
  );
}

export default function SelectBusinessPage() {
  return (
    <AuthGuard>
      <Suspense>
        <Picker />
      </Suspense>
    </AuthGuard>
  );
}
