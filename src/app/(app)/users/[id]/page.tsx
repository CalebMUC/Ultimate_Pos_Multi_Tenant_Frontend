'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Lock, Power, PowerOff, Unlock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DetailList, PageHeader } from '@/components/shared/Display';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { usersApi } from '@/api/endpoints/identity';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { toastError } from '@/lib/forms';
import { useSession } from '@/stores/session';
import { ActivityTimeline } from '@/features/audit/ActivityTimeline';
import { UserBranchesPanel } from '@/features/branches/UserBranchesPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import type { UserDto } from '@/api/dto/identity';

/** One user of this business. Linked from user notifications (new user, deactivated, account locked) and the audit log. */
function UserDetail({ id }: { id: string }) {
  const key = useQueryKey();
  const qc = useQueryClient();
  const me = useSession((s) => s.user);
  const canAudit = usePermission('AuditLog.View');
  const user = useQuery({ queryKey: key('users', { id }), queryFn: () => usersApi.get(id) });
  const [confirm, setConfirm] = useState<'lock' | 'deactivate' | 'activate' | null>(null);
  const [pending, setPending] = useState(false);

  async function act(fn: () => Promise<UserDto>, done: string) {
    setPending(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(done);
    } catch (e) {
      toastError(e);
    } finally {
      setPending(false);
    }
  }

  if (user.isLoading) return <LoadingState />;
  if (user.error || !user.data) return <ErrorState error={user.error} onRetry={() => user.refetch()} />;
  const u = user.data;
  const self = u.id === me?.id;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {u.fullName}
            {self && <Badge variant="secondary">You</Badge>}
            {u.isLocked ? <Badge variant="destructive"><Lock className="size-3" />Locked</Badge> : <Badge variant={u.isActive ? 'success' : 'secondary'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>}
          </span>
        }
        description={u.email}
        actions={
          <>
            <Button variant="ghost" asChild><Link href="/admin/users"><ArrowLeft /><Users />Users</Link></Button>
            {!self && (
              <>
                <Can permission="Users.Lock">
                  {u.isLocked
                    ? <Button variant="outline" loading={pending} onClick={() => act(() => usersApi.unlock(id), `${u.fullName} unlocked`)}><Unlock />Unlock</Button>
                    : <Button variant="outline" onClick={() => setConfirm('lock')}><Lock />Lock</Button>}
                </Can>
                <Can permission="Users.Deactivate">
                  {u.isActive
                    ? <Button variant="outline" onClick={() => setConfirm('deactivate')}><PowerOff />Deactivate</Button>
                    : <Button variant="outline" onClick={() => setConfirm('activate')}><Power />Activate</Button>}
                </Can>
              </>
            )}
          </>
        }
      />
      <Tabs defaultValue="details">
      <TabsList className="mb-1">
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="branches">Branches</TabsTrigger>
      </TabsList>
      <TabsContent value="branches"><UserBranchesPanel userId={id} userName={u.fullName} /></TabsContent>
      <TabsContent value="details">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent>
              <DetailList
                columns={1}
                items={[
                  { label: 'Email', value: u.email },
                  { label: 'Phone', value: u.phoneNumber },
                  { label: 'Roles', value: u.roles.length ? <span className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r} variant="outline">{r}</Badge>)}</span> : 'None' },
                  { label: 'Permissions', value: `${u.permissions.length}` },
                ]}
              />
              <p className="mt-3 text-xs text-muted-foreground">Edit details, roles and passwords from <Link href="/admin/users" className="text-primary hover:underline">Users</Link>.</p>
            </CardContent>
          </Card>
        </div>
        {canAudit && (
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
            <CardContent><ActivityTimeline entityType="User" entityId={id} /></CardContent>
          </Card>
        )}
      </div>
      </TabsContent>
      </Tabs>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === 'lock' ? `Lock ${u.fullName}?` : confirm === 'activate' ? `Activate ${u.fullName}?` : `Deactivate ${u.fullName}?`}
        description={confirm === 'lock' ? 'They are signed out and can’t sign in until unlocked.' : confirm === 'activate' ? 'They can sign in to this business again. The licence’s user limit applies.' : 'They can no longer sign in to this business. Their history is kept.'}
        confirmLabel={confirm === 'lock' ? 'Lock' : confirm === 'activate' ? 'Activate' : 'Deactivate'}
        destructive={confirm !== 'activate'}
        onConfirm={async () => {
          // A refusal (USER_LIMIT_REACHED when activating) stays in the dialog.
          await (confirm === 'lock' ? usersApi.lock(id) : confirm === 'activate' ? usersApi.activate(id) : usersApi.deactivate(id));
          await qc.invalidateQueries({ queryKey: ['users'] });
          toast.success(confirm === 'lock' ? 'User locked' : confirm === 'activate' ? 'User activated' : 'User deactivated');
        }}
      />
    </>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <PermissionRoute permission="Users.View"><UserDetail id={id} /></PermissionRoute>;
}
