'use client';

import { useState } from 'react';
import { ChevronRight, Loader2, Star, Store } from 'lucide-react';
import { tokenStorage } from '@/api/tokenStorage';
import { cn } from '@/lib/utils';
import { useSession } from '@/stores/session';
import { useSwitchBranch } from './BranchSwitcher';

/**
 * The branches the signed-in user may work at, for choosing where they work today. The branch the session is already at (the last
 * one used, or the default) is marked: choosing it costs nothing; another one switches tokens. onChosen runs once it's done.
 */
export function BranchChoiceList({ onChosen }: { onChosen(): void }) {
  const businessId = useSession((s) => s.activeBusinessId);
  const branches = useSession((s) => s.branches);
  const activeBranchId = useSession((s) => s.activeBranchId);
  const { switchTo, pending } = useSwitchBranch();
  const [choosing, setChoosing] = useState<string | null>(null);

  async function choose(branchId: string) {
    setChoosing(branchId);
    if (branchId === activeBranchId) {
      tokenStorage.setLastBranchId(businessId, branchId);
      onChosen();
      return;
    }
    const data = await switchTo(branchId);
    if (data) onChosen();
    else setChoosing(null);
  }

  return (
    <ul className="space-y-2" aria-label="Branches">
      {branches.map((b) => {
        const current = b.branchId === activeBranchId;
        return (
          <li key={b.branchId}>
            <button
              type="button"
              disabled={!!pending || !!choosing}
              onClick={() => choose(b.branchId)}
              aria-current={current ? 'true' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border bg-card p-3.5 text-left shadow-sm transition-colors hover:border-primary hover:bg-accent/40 disabled:opacity-60',
                current && 'border-primary/60 ring-1 ring-primary/30',
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 font-semibold tabular text-primary">{b.kraBranchId}</span>
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="truncate">{b.name}</span>
                  {b.isDefault && <Star className="size-3.5 fill-warning text-warning" aria-label="Default branch" />}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {[b.branchNumber === 0 ? 'Head office' : null, b.code, current ? 'Last used' : null].filter(Boolean).join(' · ') || 'Branch'}
                </span>
              </span>
              {choosing === b.branchId ? <Loader2 className="size-4 animate-spin" /> : current ? <Store className="size-4 text-primary" /> : <ChevronRight className="size-4 text-muted-foreground" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
