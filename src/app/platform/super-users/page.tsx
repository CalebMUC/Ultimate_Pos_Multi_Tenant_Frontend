'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, Input } from '@/components/ui/primitives';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { PermissionRoute } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { platformApi } from '@/api/endpoints/platform';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { emptyToNull } from '@/lib/utils';
import { useSession } from '@/stores/session';
import { OneTimePasswordPanel } from '@/features/platform/OneTimePassword';
import { ownerSchema, type OwnerValues } from '@/features/platform/OwnerFields';
import type { UserDto } from '@/api/dto/identity';
import type { CreatedAccountDto } from '@/api/dto/platform';

type Values = OwnerValues;
const schema: z.ZodType<Values> = ownerSchema;

function SuperUsers() {
  const key = useQueryKey();
  const qc = useQueryClient();
  const me = useSession((s) => s.user);
  const users = useQuery({ queryKey: key('platform', { superUsers: true }), queryFn: platformApi.superUsers });
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedAccountDto | null>(null);
  const [toggling, setToggling] = useState<UserDto | null>(null);
  const activeCount = users.data?.filter((u) => u.isActive).length ?? 0;

  const columns: ColumnDef<UserDto, unknown>[] = [
    {
      header: 'Name',
      accessorKey: 'fullName',
      cell: ({ row }) => (
        <span>
          <span className="font-medium">{row.original.fullName}</span>
          {row.original.id === me?.id && <Badge variant="secondary" className="ml-2">You</Badge>}
          <span className="block text-xs text-muted-foreground">{row.original.email}</span>
        </span>
      ),
    },
    { header: 'Phone', accessorKey: 'phoneNumber', cell: ({ row }) => row.original.phoneNumber ?? '—' },
    { header: 'Status', accessorKey: 'isActive', cell: ({ row }) => <Badge variant={row.original.isActive ? 'success' : 'secondary'}>{row.original.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right' },
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => setToggling(row.original)}>
          {row.original.isActive ? <><PowerOff />Deactivate</> : <><Power />Activate</>}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Super Users"
        description="The people who run the platform. A Super User belongs to no business and needs an account of their own."
        actions={<Button onClick={() => setCreating(true)}><Plus />New Super User</Button>}
      />
      <DataTable columns={columns} data={users.data} isLoading={users.isLoading} error={users.error} onRetry={() => users.refetch()} getRowId={(u) => u.id} searchable emptyTitle="No Super Users" />

      <FormDialog<Values>
        open={creating}
        onOpenChange={setCreating}
        title="New Super User"
        description="Use an email that isn’t used by any business account."
        schema={schema}
        defaultValues={{ fullName: '', email: '', phoneNumber: '', password: '' }}
        submitLabel="Create"
        onSubmit={async (v) => {
          const result = await platformApi.createSuperUser({ fullName: v.fullName, email: v.email, phoneNumber: emptyToNull(v.phoneNumber), password: v.password || null });
          await qc.invalidateQueries({ queryKey: ['platform'] });
          toast.success(`${result.user.fullName} is a Super User`);
          setCreated(result);
        }}
      >
        {(form) => {
          const e = form.formState.errors;
          return (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name" required error={e.fullName}><Input autoFocus {...form.register('fullName')} /></Field>
              <Field label="Email" required error={e.email}><Input type="email" autoComplete="off" {...form.register('email')} /></Field>
              <Field label="Phone" error={e.phoneNumber}><Input type="tel" {...form.register('phoneNumber')} /></Field>
              <Field label="Password (optional)" error={e.password} hint="Leave empty to generate a temporary one.">
                <Input type="password" autoComplete="new-password" {...form.register('password')} />
              </Field>
            </div>
          );
        }}
      </FormDialog>

      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent size="md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>{created?.user.fullName} can sign in</DialogTitle></DialogHeader>
          {created?.temporaryPassword
            ? <OneTimePasswordPanel email={created.user.email} password={created.temporaryPassword} />
            : <p className="text-sm text-muted-foreground">They sign in with the password you set, and must change it at first sign-in.</p>}
          <DialogFooter><Button onClick={() => setCreated(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        title={toggling?.isActive ? `Deactivate ${toggling.fullName}?` : `Activate ${toggling?.fullName ?? ''}?`}
        description={toggling?.isActive
          ? `They can no longer sign in to the platform. ${activeCount <= 1 ? 'This is the last active Super User: the platform will refuse.' : ''}`
          : 'They can sign in to the platform again.'}
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Activate'}
        destructive={!!toggling?.isActive}
        // The API refuses deactivating yourself or the last active Super User; its message shows in the dialog.
        onConfirm={async () => {
          await (toggling!.isActive ? platformApi.deactivateSuperUser(toggling!.id) : platformApi.activateSuperUser(toggling!.id));
          await qc.invalidateQueries({ queryKey: ['platform'] });
          toast.success(toggling!.isActive ? 'Super User deactivated' : 'Super User activated');
        }}
      />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Platform.Users.Manage"><SuperUsers /></PermissionRoute>;
}
