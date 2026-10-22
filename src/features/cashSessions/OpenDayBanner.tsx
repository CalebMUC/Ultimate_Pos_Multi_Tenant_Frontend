'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/primitives';
import { cashSessionsApi } from '@/api/endpoints/cashSessions';
import { useActiveBusiness, usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { todayIso } from '@/lib/format';
import { useSession } from '@/stores/session';

/** The open session at the branch signed in to (null: the day has not been opened). Keyed by branch: each branch has its own drawer. */
export function useCurrentCashSession(enabled = true) {
  const key = useQueryKey();
  const branchId = useSession((s) => s.activeBranchId);
  const canView = usePermission('CashSessions.View');
  const { hasModule } = useActiveBusiness();
  return useQuery({
    queryKey: key('cash-sessions', { current: true, branchId }),
    queryFn: () => cashSessionsApi.current(),
    enabled: enabled && canView && hasModule('cashUp'),
    staleTime: 60_000,
  });
}

const dismissKey = (branchId: string | null) => `upos.openDayDismissed.${branchId ?? ''}.${todayIso()}`;

function readDismissed(branchId: string | null): boolean {
  try {
    return sessionStorage.getItem(dismissKey(branchId)) === '1';
  } catch {
    return false;
  }
}

/**
 * Reminds a manager at the till that the day has no float yet. Sales are not blocked without a session: the API allows them. Dismissed
 * for the rest of the day in this tab.
 */
export function OpenDayBanner() {
  const canOpen = usePermission('CashSessions.Open');
  const branchId = useSession((s) => s.activeBranchId);
  const current = useCurrentCashSession(canOpen);
  const [dismissed, setDismissed] = useState(() => readDismissed(branchId));
  if (!canOpen || dismissed || current.isLoading || current.error || current.data !== null) return null;
  return (
    <Alert variant="info" className="pr-10">
      {/* Before the icon, so the alert's text indent leaves it alone. */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute right-2 top-2"
        aria-label="Dismiss"
        onClick={() => {
          setDismissed(true);
          try {
            sessionStorage.setItem(dismissKey(branchId), '1');
          } catch {
            // Private mode or blocked storage: dismissed until the page reloads.
          }
        }}
      >
        <X />
      </Button>
      <Wallet />
      <AlertTitle>The day has not been opened</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-2">
        Give the float for change so the end-of-day cash-up can account for it.
        <Button size="sm" variant="outline" asChild><Link href="/cash-sessions">Open the day</Link></Button>
      </AlertDescription>
    </Alert>
  );
}
