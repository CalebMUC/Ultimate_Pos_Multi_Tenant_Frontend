'use client';

import { useQuery } from '@tanstack/react-query';
import { BadgeCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { DetailList, PageHeader } from '@/components/shared/Display';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { businessesApi } from '@/api/endpoints/business';
import { usersApi } from '@/api/endpoints/identity';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateOnly } from '@/lib/format';
import { AccessStatusBadge, SupportContact } from '@/features/access/AccessComponents';
import { LicenseTable } from '@/features/licensing/LicenseTable';

function daysText(days: number | null) {
  if (days === null) return '—';
  if (days < 0) return `Ended ${-days} day${days === -1 ? '' : 's'} ago`;
  if (days === 0) return 'Ends today';
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** The business's own licence: where it stands, and its history. Read-only: Super Users issue and renew. */
function LicensePage() {
  const key = useQueryKey();
  const canUsers = usePermission('Users.View');
  const license = useQuery({ queryKey: key('license'), queryFn: businessesApi.currentLicense });
  const users = useQuery({ queryKey: key('users'), queryFn: usersApi.list, enabled: canUsers });

  if (license.isLoading) return <LoadingState />;
  if (license.error || !license.data) return <ErrorState error={license.error} onRetry={() => license.refetch()} />;
  const { access, maxUsers, licenses, maxBranches = null, openBranches } = license.data;
  const activeUsers = users.data?.filter((u) => u.isActive).length;

  return (
    <>
      <PageHeader title="Licence" description="Your Ultimate POS licence and its history." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BadgeCheck className="size-5 text-primary" />Status</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <DetailList
              columns={1}
              items={[
                { label: 'Status', value: <AccessStatusBadge status={access.status} /> },
                { label: 'Ends on', value: formatDateOnly(access.licenseEndsOn) },
                { label: 'Days left', value: daysText(access.daysRemaining) },
                { label: 'User limit', value: maxUsers === null ? 'Unlimited' : activeUsers !== undefined ? `${activeUsers} of ${maxUsers} active` : `${maxUsers} users` },
                { label: 'Branches', value: maxBranches === null ? `${openBranches ?? '—'} open · unlimited` : `${openBranches ?? '—'} of ${maxBranches} open` },
              ]}
            />
            {access.message && <p className="rounded-md bg-muted px-3 py-2 text-sm">{access.message}</p>}
            <div className="border-t pt-3 text-center">
              <SupportContact lead="To renew, contact the Ultimate POS team" className="font-medium text-foreground" />
            </div>
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <h2 className="mb-2 font-semibold">History</h2>
          <LicenseTable licenses={licenses} />
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Businesses.View"><LicensePage /></PermissionRoute>;
}
