'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BrandMark } from '@/components/layout/BrandMark';
import { Button } from '@/components/ui/button';
import { AuthGuard, homePathFor, safeReturnTo } from '@/features/auth/AuthGuard';
import { logout } from '@/features/auth/sessionActions';
import { BranchChoiceList } from '@/features/branches/BranchChoiceList';
import { useSession } from '@/stores/session';

/**
 * The branch step of signing in, when it can't happen in the login card: after the business picker, or after a forced password
 * change. Users with one branch never see it.
 */
function BranchPicker() {
  const router = useRouter();
  const params = useSearchParams();
  const user = useSession((s) => s.user);
  const businessId = useSession((s) => s.activeBusinessId);
  const business = useSession((s) => s.businesses.find((b) => b.businessId === s.activeBusinessId));
  const next = () => safeReturnTo(params.get('returnTo')) ?? homePathFor(user?.permissions ?? [], businessId);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg space-y-6">
        <BrandMark dark={false} />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Where are you working today?</h1>
          <p className="text-sm text-muted-foreground">
            {business ? <>{business.tradingName || business.businessName} · </> : null}Choose a branch. Sales and stock changes are recorded there; you can switch from the header later.
          </p>
        </div>
        <BranchChoiceList onChosen={() => router.replace(next())} />
        <Button variant="ghost" className="w-full" onClick={async () => { await logout(); window.location.assign('/login'); }}>Sign out</Button>
      </div>
    </div>
  );
}

export default function SelectBranchPage() {
  return (
    <AuthGuard>
      <Suspense><BranchPicker /></Suspense>
    </AuthGuard>
  );
}
