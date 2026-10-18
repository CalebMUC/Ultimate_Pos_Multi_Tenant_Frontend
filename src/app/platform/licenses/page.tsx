'use client';

import { useState } from 'react';
import { NativeSelect } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { PageHeader } from '@/components/shared/Display';
import { ExpiringLicensesTable } from '@/features/platform/ExpiringLicensesTable';
import { useExpiringLicenses, usePlatformBusinesses } from '@/features/platform/usePlatform';

const WINDOWS = [7, 30, 60, 90] as const;

/** Licences ending soon, and those already ended but still in their grace period. */
function Licenses() {
  const [withinDays, setWithinDays] = useState<number>(30);
  const expiring = useExpiringLicenses(withinDays);
  const businesses = usePlatformBusinesses();
  return (
    <>
      <PageHeader
        title="Licences"
        description="Licences ending soon, and those in their grace period. Open a row for the business’s licence history."
        actions={
          <NativeSelect value={withinDays} onChange={(e) => setWithinDays(Number(e.target.value))} className="w-48" aria-label="Ending within">
            {WINDOWS.map((d) => <option key={d} value={d}>Ending within {d} days</option>)}
          </NativeSelect>
        }
      />
      <ExpiringLicensesTable licenses={expiring.data} businesses={businesses.data} isLoading={expiring.isLoading} error={expiring.error} onRetry={() => expiring.refetch()} />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Licenses.View"><Licenses /></PermissionRoute>;
}
