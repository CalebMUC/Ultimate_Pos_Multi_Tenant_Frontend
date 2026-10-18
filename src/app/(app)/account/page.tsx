'use client';

import { useState } from 'react';
import { KeyRound, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { DetailList, PageHeader } from '@/components/shared/Display';
import { ChangePasswordDialog } from '@/features/auth/ChangePasswordDialog';
import { refreshMe } from '@/features/auth/sessionActions';
import { BusinessBadges } from '@/features/auth/BusinessSwitcher';
import { toastError } from '@/lib/forms';
import { formatDateTime } from '@/lib/format';
import { useSession } from '@/stores/session';

export default function AccountPage() {
  const user = useSession((s) => s.user);
  const businesses = useSession((s) => s.businesses);
  const activeBusinessId = useSession((s) => s.activeBusinessId);
  const expiresAt = useSession((s) => s.expiresAt);
  const [changing, setChanging] = useState(false);
  const [reloading, setReloading] = useState(false);
  if (!user) return null;
  return (
    <>
      <PageHeader
        title="Profile & session"
        actions={
          <>
            <Button
              variant="outline"
              loading={reloading}
              onClick={async () => {
                setReloading(true);
                try { await refreshMe(); toast.success('Permissions reloaded'); } catch (e) { toastError(e); } finally { setReloading(false); }
              }}
            >
              <RefreshCw />Reload permissions
            </Button>
            <Button onClick={() => setChanging(true)}><KeyRound />Change password</Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>You</CardTitle></CardHeader>
          <CardContent>
            <DetailList
              columns={1}
              items={[
                { label: 'Name', value: user.fullName },
                { label: 'Email', value: user.email },
                { label: 'Phone', value: user.phoneNumber },
                { label: 'Roles here', value: <span className="flex flex-wrap gap-1">{user.roles.map((r) => <Badge key={r} variant="outline">{r}</Badge>)}</span> },
                { label: 'Session renews before', value: formatDateTime(expiresAt) },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Your businesses</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {businesses.map((b) => (
                <li key={b.businessId} className="flex items-center justify-between gap-2 py-2">
                  <span className="space-y-1">
                    <span className="block font-medium">{b.tradingName || b.businessName}</span>
                    <BusinessBadges membership={b} />
                  </span>
                  {b.businessId === activeBusinessId ? <Badge>Current</Badge> : b.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Your permissions ({user.permissions.length})</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1">
            {[...user.permissions].sort().map((p) => <Badge key={p} variant="secondary" className="font-mono text-[11px]">{p}</Badge>)}
          </CardContent>
        </Card>
      </div>
      <ChangePasswordDialog open={changing} onOpenChange={setChanging} />
    </>
  );
}
