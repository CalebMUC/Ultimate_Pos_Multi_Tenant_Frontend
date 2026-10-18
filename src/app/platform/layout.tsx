'use client';

import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { AuthGuard } from '@/features/auth/AuthGuard';

/** The Super User area: its own shell and menu. Business users are sent back to their app. */
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard area="platform">
      <AppShell area="platform">{children}</AppShell>
    </AuthGuard>
  );
}
