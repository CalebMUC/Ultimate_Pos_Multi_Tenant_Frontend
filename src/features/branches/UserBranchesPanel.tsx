'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Checkbox } from '@/components/ui/overlays';
import { ErrorState, FormAlert, LoadingState } from '@/components/shared/States';
import { userBranchesApi } from '@/api/endpoints/branches';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { branchLabel, useBranchList } from './branches';

/**
 * Where a user works: a checkbox per open branch, and the default among the checked ones. A full replace on save. It takes effect
 * at the user's next sign-in or token refresh.
 */
export function UserBranchesPanel({ userId, userName }: { userId: string; userName: string }) {
  const key = useQueryKey();
  const qc = useQueryClient();
  const canManage = usePermission('Branches.Manage');
  const current = useQuery({ queryKey: key('users', { id: userId, branches: true }), queryFn: () => userBranchesApi.get(userId), retry: false });
  const open = useBranchList(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!current.data) return;
    setChecked(current.data.branches.map((b) => b.branchId));
    setDefaultId(current.data.defaultBranchId);
  }, [current.data]);

  if (current.isLoading || open.isLoading) return <LoadingState />;
  if (current.error) return <ErrorState error={current.error} onRetry={() => current.refetch()} />;
  const branches = [...(open.data ?? [])].sort((a, b) => a.branchNumber - b.branchNumber);
  const dirty = current.data && (checked.length !== current.data.branches.length
    || checked.some((id) => !current.data!.branches.some((b) => b.branchId === id))
    || defaultId !== current.data.defaultBranchId);

  function toggle(id: string, on: boolean) {
    setChecked((c) => {
      const next = on ? [...c, id] : c.filter((x) => x !== id);
      // The default must stay among the checked: move it to the first one left.
      if (!on && defaultId === id) setDefaultId(next[0] ?? null);
      if (on && !defaultId) setDefaultId(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await userBranchesApi.set(userId, { branchIds: checked, defaultBranchId: checked.length ? defaultId ?? checked[0] : null });
      await qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(`${userName}’s branches saved. They apply at their next sign-in or token refresh.`);
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Branches</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {current.data?.accessAll && (
          <Alert variant="info"><Info /><AlertDescription>Has access to every branch through their role. These assignments still decide their default branch.</AlertDescription></Alert>
        )}
        <ul className="divide-y rounded-md border">
          {branches.map((b) => {
            const on = checked.includes(b.branchId);
            return (
              <li key={b.branchId} className="flex items-center gap-3 px-3 py-2">
                <Checkbox id={`ub-${b.branchId}`} checked={on} disabled={!canManage} onCheckedChange={(v) => toggle(b.branchId, v === true)} />
                <label htmlFor={`ub-${b.branchId}`} className="flex-1 text-sm">{branchLabel(b)}{b.isHeadOffice && <span className="ml-1 text-xs text-muted-foreground">(head office)</span>}</label>
                <label className={`flex items-center gap-1.5 text-xs ${on ? '' : 'invisible'}`}>
                  <input type="radio" name="default-branch" checked={defaultId === b.branchId} disabled={!canManage || !on} onChange={() => setDefaultId(b.branchId)} />
                  Default
                </label>
              </li>
            );
          })}
        </ul>
        {!checked.length && <p className="text-xs text-warning-foreground dark:text-warning">With no branch, {userName} can’t sign in to this business{current.data?.accessAll ? '' : ' (unless their role gives access to every branch)'}.</p>}
        <FormAlert error={error} />
        {canManage && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={!dirty || saving} onClick={() => { setChecked(current.data!.branches.map((b) => b.branchId)); setDefaultId(current.data!.defaultBranchId); }}>Discard</Button>
            <Button disabled={!dirty} loading={saving} onClick={save}>Save branches</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
