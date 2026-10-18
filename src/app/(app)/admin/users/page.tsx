'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KeyRound, Lock, MoreHorizontal, Pencil, Plus, Power, PowerOff, ShieldCheck, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, Input, NativeSelect } from '@/components/ui/primitives';
import { Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/overlays';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { rolesApi, usersApi } from '@/api/endpoints/identity';
import { businessesApi } from '@/api/endpoints/business';
import { usePermissions, useQueryKey } from '@/hooks/useSessionInfo';
import { email, phone, requiredText } from '@/lib/schemas';
import { emptyToNull } from '@/lib/utils';
import { passwordRule } from '@/features/auth/ChangePasswordDialog';
import { refreshMe } from '@/features/auth/sessionActions';
import { useSession } from '@/stores/session';
import type { UserDto } from '@/api/dto/identity';

const createSchema = z.object({
  fullName: requiredText('Full name', 150),
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
  phoneNumber: z.string().trim().min(1, 'Phone is required.').regex(/^\+?[\d\s-]{9,15}$/, 'Enter a valid phone number.'),
  password: passwordRule,
  roleName: z.string().min(1, 'Choose a role.'),
});
const editSchema = z.object({ fullName: requiredText('Full name', 150), email: email.refine((v) => v !== '', 'Email is required.'), phoneNumber: phone });
const resetSchema = z.object({ newPassword: passwordRule });

type Action = { kind: 'edit' | 'roles' | 'reset' | 'deactivate' | 'lock' | 'activate'; user: UserDto } | { kind: 'create' } | null;

function Users() {
  const key = useQueryKey();
  const qc = useQueryClient();
  const router = useRouter();
  const can = usePermissions();
  const me = useSession((s) => s.user);
  const users = useQuery({ queryKey: key('users'), queryFn: usersApi.list });
  // The licence's user limit, for "N of M users". Users.View alone may not include Businesses.View.
  const license = useQuery({ queryKey: key('license'), queryFn: businessesApi.currentLicense, enabled: can('Businesses.View'), retry: false });
  const maxUsers = license.data?.maxUsers ?? null;
  const activeCount = users.data?.filter((u) => u.isActive).length ?? 0;
  const atLimit = maxUsers !== null && activeCount >= maxUsers;
  const roles = useQuery({ queryKey: key('roles'), queryFn: rolesApi.list, enabled: can(['Roles.View', 'Users.AssignRoles', 'Users.Create']) });
  const [action, setAction] = useState<Action>(null);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const refresh = async (u?: UserDto) => {
    await qc.invalidateQueries({ queryKey: ['users'] });
    // Changing my own roles changes what I may do.
    if (u?.id === me?.id) await refreshMe().catch(() => undefined);
  };
  const act = async (fn: () => Promise<UserDto>, done: string) => {
    const u = await fn();
    await refresh(u);
    toast.success(done);
  };

  const columns: ColumnDef<UserDto, unknown>[] = [
    { header: 'Name', accessorKey: 'fullName', cell: ({ row }) => <span><span className="font-medium">{row.original.fullName}</span>{row.original.id === me?.id && <Badge variant="secondary" className="ml-2">You</Badge>}<span className="block text-xs text-muted-foreground">{row.original.email}</span></span> },
    { header: 'Phone', accessorKey: 'phoneNumber', cell: ({ row }) => row.original.phoneNumber ?? '—' },
    { header: 'Roles', id: 'roles', accessorFn: (u) => u.roles.join(', '), cell: ({ row }) => <span className="flex flex-wrap gap-1">{row.original.roles.map((r) => <Badge key={r} variant="outline">{r}</Badge>)}</span> },
    {
      header: 'Status',
      id: 'status',
      accessorFn: (u) => (u.isLocked ? 'Locked' : u.isActive ? 'Active' : 'Inactive'),
      cell: ({ row }) => (row.original.isLocked ? <Badge variant="destructive"><Lock className="size-3" />Locked</Badge> : <Badge variant={row.original.isActive ? 'success' : 'secondary'}>{row.original.isActive ? 'Active' : 'Inactive'}</Badge>),
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right' },
      cell: ({ row }) => {
        const u = row.original;
        const self = u.id === me?.id;
        return (
          // Menu clicks bubble through the portal; keep them from opening the row.
          <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.fullName}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {can('Users.Update') && <DropdownMenuItem onSelect={() => setAction({ kind: 'edit', user: u })}><Pencil />Edit details</DropdownMenuItem>}
              {can('Users.AssignRoles') && (
                <DropdownMenuItem onSelect={() => { setRoleIds((roles.data ?? []).filter((r) => u.roles.includes(r.roleName)).map((r) => r.roleId)); setAction({ kind: 'roles', user: u }); }}>
                  <ShieldCheck />Roles
                </DropdownMenuItem>
              )}
              {can('Users.ResetPassword') && !self && <DropdownMenuItem onSelect={() => setAction({ kind: 'reset', user: u })}><KeyRound />Reset password</DropdownMenuItem>}
              {!self && (can('Users.Lock') || can('Users.Deactivate')) && <DropdownMenuSeparator />}
              {can('Users.Lock') && !self && (u.isLocked
                ? <DropdownMenuItem onSelect={() => act(() => usersApi.unlock(u.id), `${u.fullName} unlocked`).catch((e) => toast.error(e.message))}><Unlock />Unlock</DropdownMenuItem>
                : <DropdownMenuItem destructive onSelect={() => setAction({ kind: 'lock', user: u })}><Lock />Lock</DropdownMenuItem>)}
              {can('Users.Deactivate') && !self && (u.isActive
                ? <DropdownMenuItem destructive onSelect={() => setAction({ kind: 'deactivate', user: u })}><PowerOff />Deactivate</DropdownMenuItem>
                : <DropdownMenuItem onSelect={() => setAction({ kind: 'activate', user: u })}><Power />Activate</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const target = action && 'user' in action ? action.user : null;
  return (
    <>
      <PageHeader
        title="Users"
        description={<>People who can sign in to this business, and their roles.{maxUsers !== null && <span className={atLimit ? 'ml-1 font-medium text-warning-foreground dark:text-warning' : 'ml-1'}> {activeCount} of {maxUsers} users{atLimit ? ': the licence limit is reached' : ''}.</span>}</>}
        actions={<Can permission="Users.Create"><Button onClick={() => setAction({ kind: 'create' })}><Plus />New user</Button></Can>} />
      <DataTable columns={columns} data={users.data} isLoading={users.isLoading} error={users.error} onRetry={() => users.refetch()} getRowId={(u) => u.id} onRowClick={(u) => router.push(`/users/${u.id}`)} searchable emptyTitle="No users" />

      <FormDialog
        open={action?.kind === 'create'}
        onOpenChange={(o) => !o && setAction(null)}
        title="New user"
        description="They sign in with this email and password, and should change the password afterwards."
        schema={createSchema}
        defaultValues={{ fullName: '', email: '', phoneNumber: '', password: '', roleName: '' }}
        onSubmit={async (v) => { const u = await usersApi.create(v); await refresh(); toast.success(`${u.fullName} added`); }}
      >
        {(form) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" required error={form.formState.errors.fullName}><Input autoFocus {...form.register('fullName')} /></Field>
            <Field label="Phone" required error={form.formState.errors.phoneNumber}><Input type="tel" {...form.register('phoneNumber')} /></Field>
            <Field label="Email" required error={form.formState.errors.email}><Input type="email" autoComplete="off" {...form.register('email')} /></Field>
            <Field label="Role" required error={form.formState.errors.roleName}>
              <NativeSelect {...form.register('roleName')}>
                <option value="">Choose a role</option>
                {roles.data?.filter((r) => r.isActive).map((r) => <option key={r.roleId} value={r.roleName}>{r.roleName}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Temporary password" required error={form.formState.errors.password} hint="At least 8 characters, with a letter and a digit." className="sm:col-span-2">
              <Input type="password" autoComplete="new-password" {...form.register('password')} />
            </Field>
          </div>
        )}
      </FormDialog>

      <FormDialog
        open={action?.kind === 'edit'}
        onOpenChange={(o) => !o && setAction(null)}
        title={`Edit ${target?.fullName ?? ''}`}
        schema={editSchema}
        defaultValues={{ fullName: target?.fullName ?? '', email: target?.email ?? '', phoneNumber: target?.phoneNumber ?? '' }}
        onSubmit={async (v) => { const u = await usersApi.update(target!.id, { ...v, phoneNumber: emptyToNull(v.phoneNumber) }); await refresh(u); toast.success('User updated'); }}
      >
        {(form) => (
          <>
            <Field label="Full name" required error={form.formState.errors.fullName}><Input {...form.register('fullName')} /></Field>
            <Field label="Email" required error={form.formState.errors.email}><Input type="email" {...form.register('email')} /></Field>
            <Field label="Phone" error={form.formState.errors.phoneNumber}><Input type="tel" {...form.register('phoneNumber')} /></Field>
          </>
        )}
      </FormDialog>

      <FormDialog
        open={action?.kind === 'reset'}
        onOpenChange={(o) => !o && setAction(null)}
        title={`Reset ${target?.fullName ?? ''}’s password`}
        description="Give them the new password in person. They are signed out everywhere."
        size="sm"
        schema={resetSchema}
        defaultValues={{ newPassword: '' }}
        submitLabel="Reset password"
        onSubmit={async (v) => { await usersApi.resetPassword(target!.id, v.newPassword); toast.success('Password reset'); }}
      >
        {(form) => <Field label="New password" required error={form.formState.errors.newPassword} hint="At least 8 characters, with a letter and a digit."><Input type="password" autoComplete="new-password" {...form.register('newPassword')} /></Field>}
      </FormDialog>

      <ConfirmDialog
        open={action?.kind === 'roles'}
        onOpenChange={(o) => !o && setAction(null)}
        title={`Roles for ${target?.fullName ?? ''}`}
        description="What they may do comes from all the roles they hold."
        confirmLabel="Save roles"
        onConfirm={() => {
          if (roleIds.length === 0) throw new Error('Choose at least one role.');
          return act(() => usersApi.assignRoles(target!.id, roleIds), 'Roles updated');
        }}
      >
        <ul className="max-h-72 space-y-2 overflow-y-auto">
          {roles.data?.filter((r) => r.isActive || roleIds.includes(r.roleId)).map((r) => (
            <li key={r.roleId}>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox className="mt-0.5" checked={roleIds.includes(r.roleId)} onCheckedChange={(v) => setRoleIds((ids) => (v ? [...ids, r.roleId] : ids.filter((x) => x !== r.roleId)))} />
                <span><span className="font-medium">{r.roleName}</span>{r.description && <span className="block text-xs text-muted-foreground">{r.description}</span>}</span>
              </label>
            </li>
          ))}
        </ul>
      </ConfirmDialog>

      <ConfirmDialog
        open={action?.kind === 'activate'}
        onOpenChange={(o) => !o && setAction(null)}
        title={`Activate ${target?.fullName ?? ''}?`}
        description={maxUsers !== null ? `They can sign in again. The licence allows ${maxUsers} active users; ${activeCount} are active now.` : 'They can sign in again.'}
        confirmLabel="Activate"
        onConfirm={() => act(() => usersApi.activate(target!.id), `${target?.fullName} activated`)}
      />

      <ConfirmDialog
        open={action?.kind === 'deactivate' || action?.kind === 'lock'}
        onOpenChange={(o) => !o && setAction(null)}
        title={action?.kind === 'lock' ? `Lock ${target?.fullName}?` : `Deactivate ${target?.fullName}?`}
        description={action?.kind === 'lock' ? 'They are signed out and can’t sign in until unlocked.' : 'They can no longer sign in to this business. Their history is kept.'}
        confirmLabel={action?.kind === 'lock' ? 'Lock' : 'Deactivate'}
        destructive
        onConfirm={() => (action?.kind === 'lock' ? act(() => usersApi.lock(target!.id), 'User locked') : act(() => usersApi.deactivate(target!.id), 'User deactivated'))}
      />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Users.View"><Users /></PermissionRoute>;
}
