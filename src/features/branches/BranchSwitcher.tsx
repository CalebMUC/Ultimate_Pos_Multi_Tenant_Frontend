'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, Loader2, Store } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/overlays';
import { switchBranch } from '@/features/auth/sessionActions';
import { toastError } from '@/lib/forms';
import { cn } from '@/lib/utils';
import { useSession } from '@/stores/session';
import type { Guid } from '@/api/dto/common';
import type { LoginResponseDto } from '@/api/dto/identity';
import { branchLabel, useActiveBranch } from './branches';

/** Switches branch: new tokens, then every cache and the POS cart reset. FORBIDDEN (not a branch of yours) shows as a toast. */
export function useSwitchBranch() {
  const [pending, setPending] = useState<Guid | null>(null);
  async function run(branchId: Guid): Promise<LoginResponseDto | null> {
    setPending(branchId);
    try {
      const data = await switchBranch(branchId);
      const branch = data.branches?.find((b) => b.branchId === data.activeBranchId);
      toast.success(`You’re now working at ${branchLabel(branch)}`);
      return data;
    } catch (e) {
      toastError(e);
      return null;
    } finally {
      setPending(null);
    }
  }
  return { switchTo: run, pending };
}

/** Beside the business name: "· 01 Westlands ▾". A list when the user may work at several branches, a plain label otherwise. */
export function BranchSwitcher() {
  const branches = useSession((s) => s.branches);
  const active = useActiveBranch();
  const { switchTo, pending } = useSwitchBranch();
  if (!active) return null;

  const label = (
    <span className="flex min-w-0 items-center gap-1.5 text-sm">
      <Store className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate"><span className="tabular text-muted-foreground">{active.kraBranchId}</span> {active.name}</span>
    </span>
  );
  if (branches.length <= 1) return <div className="hidden min-w-0 max-w-[12rem] border-l pl-3 sm:block" data-testid="branch-label">{label}</div>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex min-w-0 max-w-[14rem] items-center gap-1.5 rounded-md border-l px-2 py-1 hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Branch: ${branchLabel(active)}. Switch branch`}
      >
        {label}
        {pending ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch branch</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {branches.map((b) => (
          <DropdownMenuItem key={b.branchId} disabled={!!pending} onSelect={() => b.branchId !== active.branchId && void switchTo(b.branchId)}>
            <Check className={cn(b.branchId === active.branchId ? 'opacity-100' : 'opacity-0')} />
            <span className="w-6 tabular text-muted-foreground">{b.kraBranchId}</span>
            <span className="min-w-0 flex-1 truncate">{b.name}</span>
            {b.isDefault && <span className="text-[10px] uppercase text-muted-foreground">Default</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
