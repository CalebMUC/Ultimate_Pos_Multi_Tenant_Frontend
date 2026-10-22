'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PermissionRoute } from '@/components/shared/Can';
import { PageHeader } from '@/components/shared/Display';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { cashSessionsApi } from '@/api/endpoints/cashSessions';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateTime } from '@/lib/format';
import { CashSessionView } from '@/features/cashSessions/CashSessionViews';

function CashSessionDetail({ id }: { id: string }) {
  const key = useQueryKey();
  const q = useQuery({ queryKey: key('cash-sessions', { id }), queryFn: () => cashSessionsApi.get(id) });
  if (q.isLoading) return <LoadingState />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data;
  return (
    <>
      <PageHeader
        title={`Cash-up ${s.sessionNumber}`}
        description={`${s.kraBranchId ? `${s.kraBranchId} ${s.branchName ?? ''} · ` : ''}opened ${formatDateTime(s.openedAt)}`}
        actions={<Button variant="ghost" asChild><Link href="/cash-sessions"><ArrowLeft />Cash-up</Link></Button>}
      />
      <CashSessionView session={s} />
    </>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <PermissionRoute permission="CashSessions.View" module="cashUp"><CashSessionDetail id={id} /></PermissionRoute>;
}
