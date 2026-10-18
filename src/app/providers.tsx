'use client';

import { useEffect, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/overlays';
import { onSessionExpired } from '@/api/client';
import { bootstrapSession } from '@/features/auth/sessionActions';
import { queryClient } from '@/lib/queryClient';
import { applyTheme, usePreferences } from '@/stores/preferences';

let bootstrapped = false;

export function Providers({ children }: { children: ReactNode }) {
  const theme = usePreferences((s) => s.theme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => applyTheme('system');
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [theme]);

  useEffect(() => {
    onSessionExpired(() => {
      const here = window.location.pathname + window.location.search;
      if (!here.startsWith('/login')) window.location.assign(`/login?returnTo=${encodeURIComponent(here)}`);
    });
    // Strict mode runs effects twice in development; refresh tokens rotate, so restore the session only once.
    if (!bootstrapped) {
      bootstrapped = true;
      void bootstrapSession();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <Toaster richColors closeButton position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
