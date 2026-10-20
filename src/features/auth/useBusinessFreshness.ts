'use client';

import { useEffect, useRef } from 'react';
import { useSession } from '@/stores/session';
import { loadCurrentBusiness } from './sessionActions';

const MIN_GAP_MS = 30_000;

/**
 * Keeps the business profile, and with it the modules the menus are built from, current: re-reads GET /businesses/current when the
 * app regains focus and after every token refresh (a new access token). A super user's reclassification then shows without signing
 * out. At most once every 30 seconds, so switching windows back and forth costs nothing.
 */
export function useBusinessFreshness(enabled: boolean) {
  const accessToken = useSession((s) => s.accessToken);
  const last = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const reload = () => {
      if (!useSession.getState().activeBusinessId || Date.now() - last.current < MIN_GAP_MS) return;
      last.current = Date.now();
      void loadCurrentBusiness();
    };
    const onVisible = () => document.visibilityState === 'visible' && reload();
    window.addEventListener('focus', reload);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', reload);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);

  // A refreshed token: the memberships (with their modules) came with it; the profile is re-read too.
  const first = useRef(true);
  useEffect(() => {
    if (!enabled || !accessToken) return;
    if (first.current) {
      first.current = false; // sign-in and start-up already load it
      return;
    }
    last.current = Date.now();
    void loadCurrentBusiness();
  }, [enabled, accessToken]);
}
