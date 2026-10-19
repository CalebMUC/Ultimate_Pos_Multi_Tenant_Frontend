'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BRANCH_FORBIDDEN_EVENT } from '@/api/client';
import { branchesApi } from '@/api/endpoints/branches';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { useSession } from '@/stores/session';
import type { BranchScope } from '@/api/branchScope';
import type { BranchMembershipDto } from '@/api/dto/branches';

type Labelled = { kraBranchId?: string | null; name?: string | null; branchName?: string | null };

/** "01 · Westlands": the KRA eTIMS number, then the name. */
export function branchLabel(b: Labelled | null | undefined): string {
  if (!b) return '—';
  const name = b.name ?? b.branchName ?? '';
  return b.kraBranchId ? `${b.kraBranchId} · ${name}`.trim() : name || '—';
}

/** The branches the user may work at and see (every open branch with Branches.AccessAll), default first. */
export function useMyBranches(): BranchMembershipDto[] {
  return useSession((s) => s.branches);
}

export function useActiveBranch(): BranchMembershipDto | null {
  const branches = useSession((s) => s.branches);
  const activeBranchId = useSession((s) => s.activeBranchId);
  return branches.find((b) => b.branchId === activeBranchId) ?? null;
}

/** Can this user see the branch (and so act there: dispatch from it, receive at it)? */
export function useCanSeeBranch() {
  const branches = useSession((s) => s.branches);
  return useCallback((branchId: string | null | undefined) => !!branchId && branches.some((b) => b.branchId === branchId), [branches]);
}

/** Every branch the user can see, closed ones included: for labels on records made at a branch since closed. */
export function useBranchList(includeInactive = true) {
  const key = useQueryKey();
  const hasBusiness = useSession((s) => !!s.activeBusinessId);
  return useQuery({ queryKey: key('branches', { includeInactive }), queryFn: () => branchesApi.list(includeInactive), enabled: hasBusiness, staleTime: 5 * 60_000 });
}

/**
 * Every open branch of the business, names only, for any member. Use it to choose a branch that may not be the user's own (a
 * transfer's destination) and to name another branch's documents. GET /branches gives restricted staff only their own.
 */
export function useBranchDirectory() {
  const key = useQueryKey();
  const hasBusiness = useSession((s) => !!s.activeBusinessId);
  return useQuery({ queryKey: key('branches', { directory: true }), queryFn: branchesApi.directory, enabled: hasBusiness, staleTime: 5 * 60_000 });
}

/** Branch id → "01 · Westlands", from the directory (every open branch), the user's own list (closed ones too) and the session. */
export function useBranchLabels() {
  const mine = useSession((s) => s.branches);
  const list = useBranchList();
  const directory = useBranchDirectory();
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const b of directory.data ?? []) map.set(b.branchId, branchLabel(b));
    for (const b of list.data ?? []) map.set(b.branchId, branchLabel(b));
    for (const b of mine) map.set(b.branchId, branchLabel(b));
    return (id: string | null | undefined) => (id ? map.get(id) ?? '—' : '—');
  }, [mine, list.data, directory.data]);
}

export interface BranchFilter {
  /** The branch the reads are narrowed to, or null for every branch the user can see. */
  branchId: string | null;
  setBranchId(branchId: string | null): void;
  /** Pass to the API: { branchId } or nothing. */
  scope: BranchScope;
  /** Only users who see more than one branch get the filter. */
  visible: boolean;
  branches: BranchMembershipDto[];
}

/**
 * The branch filter for lists, reports and the dashboard. The choice lives in the URL (?branchId=) so links and refreshes keep it.
 * A branch the user can't see (403 BRANCH_FORBIDDEN) resets it to "All branches".
 */
export function useBranchFilter(): BranchFilter {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const branches = useSession((s) => s.branches);
  const visible = branches.length > 1;
  const requested = params.get('branchId');
  // Ignore a stale id (from an old link) the user can't see, and any filter for single-branch users.
  const branchId = visible && requested && branches.some((b) => b.branchId === requested) ? requested : null;

  const setBranchId = useCallback(
    (next: string | null) => {
      const query = new URLSearchParams(params.toString());
      if (next) query.set('branchId', next);
      else query.delete('branchId');
      const qs = query.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    if (!requested) return;
    const reset = () => {
      toast.error('You don’t have access to that branch. Showing all your branches.');
      setBranchId(null);
    };
    window.addEventListener(BRANCH_FORBIDDEN_EVENT, reset);
    return () => window.removeEventListener(BRANCH_FORBIDDEN_EVENT, reset);
  }, [requested, setBranchId]);

  return { branchId, setBranchId, scope: branchId ? { branchId } : {}, visible, branches };
}

