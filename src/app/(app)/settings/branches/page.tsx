'use client';

import { BranchesScreen } from '@/features/branches/BranchesScreen';

/** Any member may list (their own branches); changing them needs Branches.Manage. */
export default function Page() {
  return <BranchesScreen />;
}
