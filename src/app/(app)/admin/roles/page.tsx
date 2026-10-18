'use client';

import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardHeader, CardTitle, Input, Textarea } from '@/components/ui/primitives';
import { Checkbox } from '@/components/ui/overlays';
import { ActivationButton } from '@/components/shared/ActivationButton';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { PageHeader } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/States';
import { permissionsApi, rolesApi } from '@/api/endpoints/identity';
import { usePermission, usePermissions, useQueryKey } from '@/hooks/useSessionInfo';
import { toastError } from '@/lib/forms';
import { requiredText, text } from '@/lib/schemas';
import { cn, emptyToNull } from '@/lib/utils';
import { refreshMe } from '@/features/auth/sessionActions';
import type { RoleDto } from '@/api/dto/identity';

const schema = z.object({ roleName: requiredText('Name', 100), description: text(300) });
type Values = z.infer<typeof schema>;

/** "Sales.OverrideCreditLimit" -> "Override credit limit". */
const actionLabel = (name: string) => {
  const action = name.split('.')[1] ?? name;
  const spaced = action.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0) + spaced.slice(1).toLowerCase();
};

function Roles() {
  const key = useQueryKey();
  const qc = useQueryClient();
  const can = usePermissions();
  const canAssign = usePermission('Roles.AssignPermissions');
  const roles = useQuery({ queryKey: key('roles'), queryFn: rolesApi.list });
  const permissions = useQuery({ queryKey: key('permissions'), queryFn: permissionsApi.list, enabled: can(['Permissions.View', 'Roles.AssignPermissions']) });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RoleDto | 'new' | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const selected = roles.data?.find((r) => r.roleId === selectedId) ?? roles.data?.[0] ?? null;

  useEffect(() => setChecked(new Set(selected?.permissions ?? [])), [selected]);

  const modules = useMemo(() => {
    const map = new Map<string, { name: string; permissionId: string }[]>();
    for (const p of permissions.data ?? []) {
      if (!p.isActive) continue;
      map.set(p.module, [...(map.get(p.module) ?? []), { name: p.name, permissionId: p.permissionId }]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [permissions.data]);

  const dirty = selected && (checked.size !== selected.permissions.length || selected.permissions.some((p) => !checked.has(p)));

  async function savePermissions() {
    if (!selected) return;
    setSaving(true);
    try {
      const ids = (permissions.data ?? []).filter((p) => checked.has(p.name)).map((p) => p.permissionId);
      await rolesApi.assignPermissions(selected.roleId, { permissionIds: ids });
      await qc.invalidateQueries({ queryKey: ['roles'] });
      await refreshMe().catch(() => undefined);
      toast.success(`${selected.roleName} permissions saved`);
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  }

  if (roles.isLoading) return <LoadingState />;
  if (roles.error) return <ErrorState error={roles.error} onRetry={() => roles.refetch()} />;

  return (
    <>
      <PageHeader title="Roles & permissions" description="A role is a set of permissions. Users get everything their roles allow." actions={<Can permission="Roles.Create"><Button onClick={() => setEditing('new')}><Plus />New role</Button></Can>} />
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <Card className="h-fit overflow-hidden">
          <ul className="divide-y">
            {roles.data?.map((r) => (
              <li key={r.roleId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(r.roleId)}
                  className={cn('flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-accent/50', selected?.roleId === r.roleId && 'bg-accent')}
                >
                  <ShieldCheck className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.roleName}</span>
                    <span className="text-xs text-muted-foreground">{r.permissions.length} permission(s)</span>
                  </span>
                  {!r.isActive && <Badge variant="secondary">Inactive</Badge>}
                </button>
              </li>
            ))}
          </ul>
        </Card>
        {!selected ? (
          <EmptyState title="No roles yet" />
        ) : (
          <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle>{selected.roleName}</CardTitle>
                {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
              </div>
              <div className="flex gap-2">
                <Can permission="Roles.Update"><Button variant="outline" size="sm" onClick={() => setEditing(selected)}><Pencil />Rename</Button></Can>
                <Can permission="Roles.Deactivate">
                  <ActivationButton isActive={selected.isActive} name={selected.roleName} activate={() => rolesApi.activate(selected.roleId)} deactivate={() => rolesApi.deactivate(selected.roleId)} invalidate={['roles']} deactivateWarning="Users holding only this role lose its permissions until it is activated again." />
                </Can>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {permissions.isLoading ? <LoadingState /> : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {modules.map(([module, perms]) => {
                    const all = perms.every((p) => checked.has(p.name));
                    return (
                      <fieldset key={module} className="rounded-md border p-3">
                        <legend className="px-1 text-sm font-semibold">
                          <label className="flex items-center gap-2">
                            <Checkbox
                              disabled={!canAssign}
                              checked={all ? true : perms.some((p) => checked.has(p.name)) ? 'indeterminate' : false}
                              onCheckedChange={(v) => setChecked((s) => { const n = new Set(s); perms.forEach((p) => (v === true ? n.add(p.name) : n.delete(p.name))); return n; })}
                            />
                            {module}
                          </label>
                        </legend>
                        <ul className="mt-1 space-y-1.5">
                          {perms.map((p) => (
                            <li key={p.permissionId}>
                              <label className="flex items-center gap-2 text-sm" title={p.name}>
                                <Checkbox
                                  disabled={!canAssign}
                                  checked={checked.has(p.name)}
                                  onCheckedChange={(v) => setChecked((s) => { const n = new Set(s); if (v === true) n.add(p.name); else n.delete(p.name); return n; })}
                                />
                                {actionLabel(p.name)}
                              </label>
                            </li>
                          ))}
                        </ul>
                      </fieldset>
                    );
                  })}
                </div>
              )}
              {canAssign && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" disabled={!dirty || saving} onClick={() => setChecked(new Set(selected.permissions))}>Discard</Button>
                  <Button disabled={!dirty} loading={saving} onClick={savePermissions}>Save permissions</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      <FormDialog<Values>
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing && editing !== 'new' ? `Edit ${editing.roleName}` : 'New role'}
        schema={schema}
        defaultValues={{ roleName: editing && editing !== 'new' ? editing.roleName : '', description: editing && editing !== 'new' ? editing.description ?? '' : '' }}
        onSubmit={async (v) => {
          const body = { roleName: v.roleName, description: emptyToNull(v.description) };
          const r = editing && editing !== 'new' ? await rolesApi.update(editing.roleId, body) : await rolesApi.create(body);
          await qc.invalidateQueries({ queryKey: ['roles'] });
          setSelectedId(r.roleId);
          toast.success(editing === 'new' ? 'Role created: now choose its permissions' : 'Role updated');
        }}
      >
        {(form) => (
          <>
            <Field label="Name" required error={form.formState.errors.roleName}><Input autoFocus placeholder="Cashier" {...form.register('roleName')} /></Field>
            <Field label="Description" error={form.formState.errors.description}><Textarea {...form.register('description')} /></Field>
          </>
        )}
      </FormDialog>
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Roles.View"><Roles /></PermissionRoute>;
}
