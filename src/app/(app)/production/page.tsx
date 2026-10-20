'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PermissionRoute } from '@/components/shared/Can';
import { LoadingState } from '@/components/shared/States';
import { usePermission } from '@/hooks/useSessionInfo';

/** /production: production runs, or formulas for someone who may only see those. "Not used" for a business without production. */
function ProductionHome() {
  const router = useRouter();
  const canRuns = usePermission('Production.View');
  useEffect(() => router.replace(canRuns ? '/production/runs' : '/production/formulas'), [router, canRuns]);
  return <LoadingState />;
}

export default function Page() {
  return <PermissionRoute permission={['Production.View', 'Formulas.View']} module="production"><ProductionHome /></PermissionRoute>;
}
