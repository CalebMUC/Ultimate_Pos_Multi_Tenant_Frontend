'use client';

import { useParams } from 'next/navigation';
import { BranchesScreen } from '@/features/branches/BranchesScreen';

/** Linked from "New branch" notifications: the branches list with that branch open. */
export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <BranchesScreen key={id} openBranchId={id} />;
}
