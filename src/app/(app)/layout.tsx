'use client';

import { Suspense, type ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { AuthGuard } from '@/features/auth/AuthGuard';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      {/* Pages read ?branchId= (the branch filter) through useSearchParams, which needs a Suspense boundary above them. */}
      <AppShell><Suspense>{children}</Suspense></AppShell>
    </AuthGuard>
  );
}
