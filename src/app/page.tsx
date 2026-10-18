'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingState } from '@/components/shared/States';
import { useSession } from '@/stores/session';
import { homePathFor } from '@/features/auth/AuthGuard';

export default function IndexPage() {
  const router = useRouter();
  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);
  const activeBusinessId = useSession((s) => s.activeBusinessId);
  const mustChangePassword = useSession((s) => s.mustChangePassword);

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
    if (status === 'authenticated') router.replace(homePathFor(user?.permissions ?? [], activeBusinessId, mustChangePassword));
  }, [status, user, activeBusinessId, mustChangePassword, router]);

  return <LoadingState label="Starting Ultimate POS…" className="min-h-screen" />;
}
