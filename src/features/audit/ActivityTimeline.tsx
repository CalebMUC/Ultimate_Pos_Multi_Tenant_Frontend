'use client';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/primitives';
import { EmptyState, ErrorState } from '@/components/shared/States';
import { auditLogApi } from '@/api/endpoints/auditLog';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { cn } from '@/lib/utils';
import { absoluteTime, relativeTime, severityStyle } from '@/features/notifications/format';
import { AuditEntryDetails } from './AuditEntryDetails';

const PAGE_SIZE = 20;

/** Everything recorded against one record, newest first. Renders nothing without AuditLog.View. */
export function ActivityTimeline({ entityType, entityId }: { entityType: string; entityId: string }) {
  const allowed = usePermission('AuditLog.View');
  const key = useQueryKey();
  const [open, setOpen] = useState<string | null>(null);
  const query = useInfiniteQuery({
    queryKey: key('audit-log', { entityType, entityId }),
    queryFn: ({ pageParam }) => auditLogApi.list({ entityType, entityId, page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    enabled: allowed,
  });
  if (!allowed) return null;
  if (query.isLoading) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="flex gap-3"><Skeleton className="size-3 rounded-full" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-40" /><Skeleton className="h-3.5 w-3/4" /></div></div>)}</div>;
  }
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const entries = query.data?.pages.flatMap((p) => p.items) ?? [];
  if (entries.length === 0) return <EmptyState title="No activity recorded" message="Changes made to this record will appear here." />;

  return (
    <div>
      <ol className="relative ml-1.5 border-l pl-6">
        {entries.map((e) => {
          const style = severityStyle(e.severity);
          const expanded = open === e.systemEventId;
          return (
            <li key={e.systemEventId} className="relative pb-5 last:pb-1">
              <span className={cn('absolute -left-[1.85rem] top-1 size-3 rounded-full border-2 border-card', {
                'bg-destructive': style.label === 'Critical', 'bg-warning': style.label === 'Warning', 'bg-muted-foreground/50': style.label === 'Info',
              })} aria-label={style.label} />
              <button type="button" className="w-full text-left" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : e.systemEventId)}>
                <p className="text-xs text-muted-foreground">
                  <time dateTime={e.occurredAt} title={absoluteTime(e.occurredAt)}>{relativeTime(e.occurredAt)}</time> · {e.actorName ?? (e.actorUserId ? 'Unknown user' : 'System')}
                </p>
                <p className="flex items-start gap-1 text-sm">
                  <span className="flex-1">{e.summary}</span>
                  <ChevronDown className={cn('mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
                </p>
              </button>
              {expanded && <div className="mt-1 rounded-md border bg-muted/30 px-3"><AuditEntryDetails entry={e} /></div>}
            </li>
          );
        })}
      </ol>
      {query.hasNextPage && (
        <Button variant="outline" size="sm" className="ml-6 mt-2" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Load more</Button>
      )}
    </div>
  );
}
