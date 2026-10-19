'use client';

import { Store } from 'lucide-react';
import { NativeSelect } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { branchLabel, type BranchFilter } from './branches';

/** "All branches" plus each branch the user can see. Renders nothing for users who see one branch only. */
export function BranchFilterSelect({ filter, className }: { filter: BranchFilter; className?: string }) {
  if (!filter.visible) return null;
  return (
    <span className={cn('relative inline-flex', className)}>
      <Store className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <NativeSelect
        value={filter.branchId ?? ''}
        onChange={(e) => filter.setBranchId(e.target.value || null)}
        className="w-48 pl-8"
        aria-label="Branch"
      >
        <option value="">All branches</option>
        {filter.branches.map((b) => <option key={b.branchId} value={b.branchId}>{branchLabel(b)}</option>)}
      </NativeSelect>
    </span>
  );
}
