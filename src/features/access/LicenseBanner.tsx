'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarClock, X } from 'lucide-react';
import { todayIso } from '@/lib/format';
import { cn } from '@/lib/utils';
import { usePermission } from '@/hooks/useSessionInfo';
import { useAccess } from '@/stores/access';
import { useSession } from '@/stores/session';
import { warningTone } from './access';

const dismissKey = (businessId: string) => `upos.licenseBanner.dismissed.${businessId}`;

/** True when the banner was dismissed today for this business. Storage can be unavailable: then it just shows. */
export function isDismissedToday(businessId: string, today = todayIso()): boolean {
  try {
    return localStorage.getItem(dismissKey(businessId)) === today;
  } catch {
    return false;
  }
}

export function dismissForToday(businessId: string, today = todayIso()) {
  try {
    localStorage.setItem(dismissKey(businessId), today);
  } catch {
    // Not remembered; it hides until the page reloads.
  }
}

/**
 * Under the header while the licence ends within 14 days (amber) or is in its grace period (red). The text comes from the
 * login response, the X-License-Warning header or /auth/me. Dismissing hides it for the rest of the day.
 */
export function LicenseBanner() {
  const warning = useAccess((s) => s.warning);
  const businessId = useSession((s) => s.activeBusinessId);
  const canSeeLicense = usePermission('Businesses.View');
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(businessId ? isDismissedToday(businessId) : true);
  }, [businessId, warning?.message]);

  if (!warning || !businessId || dismissed) return null;
  const grace = warningTone(warning.message, warning.status) === 'grace';
  const Icon = grace ? AlertTriangle : CalendarClock;
  return (
    <div
      role="status"
      data-testid="license-banner"
      data-tone={grace ? 'grace' : 'expiring'}
      className={cn(
        'flex items-start gap-3 border-b px-4 py-2.5 text-sm no-print',
        grace ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-warning/50 bg-warning/15 text-warning-foreground dark:text-warning',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1">
        {warning.message}{' '}
        {canSeeLicense && <Link href="/settings/license" className="font-medium underline underline-offset-2">View licence</Link>}
      </p>
      <button
        type="button"
        aria-label="Dismiss for today"
        title="Dismiss for today"
        className="rounded p-0.5 opacity-70 hover:opacity-100"
        onClick={() => { dismissForToday(businessId); setDismissed(true); }}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
