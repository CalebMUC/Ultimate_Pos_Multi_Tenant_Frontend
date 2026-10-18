'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, Skeleton } from '@/components/ui/primitives';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { PageHeader } from '@/components/shared/Display';
import { EmptyState, ErrorState } from '@/components/shared/States';
import { resolveNotificationLink } from '@/features/notifications/format';
import { NotificationRow } from '@/features/notifications/NotificationRow';
import { useNotificationActions, useNotificationList, useUnreadCount } from '@/features/notifications/useNotifications';
import type { NotificationDto } from '@/api/dto/notifications';

const PAGE_SIZE = 20;

/** Every signed-in user's own notifications. No permission needed. Used by the business app and the platform area. */
export function NotificationsView({ area = 'business' }: { area?: 'business' | 'platform' }) {
  const router = useRouter();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const list = useNotificationList({ unreadOnly: tab === 'unread', page, pageSize: PAGE_SIZE });
  const unread = useUnreadCount();
  const { markRead, markAllRead } = useNotificationActions();
  const unreadCount = unread.data?.unreadCount ?? 0;
  const meta = list.data?.meta;
  const items = list.data?.items ?? [];

  function open(n: NotificationDto) {
    if (!n.isRead) markRead.mutate(n);
    const link = resolveNotificationLink(n.link, area);
    if (link) router.push(link);
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description={area === 'platform' ? 'Alerts sent to you as a Super User: new businesses, suspensions and licences.' : 'Alerts and changes sent to you in this business. Low-stock and expiry alerts come once, until the condition clears.'}
        actions={
          <Button variant="outline" disabled={unreadCount === 0 || markAllRead.isPending} onClick={() => markAllRead.mutate()}>
            <CheckCheck />Mark all as read
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setPage(1); }} className="mb-3">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread{unreadCount ? ` (${unreadCount > 99 ? '99+' : unreadCount})` : ''}</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card className="overflow-hidden">
        {list.isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="space-y-1.5 px-3 py-3"><Skeleton className="h-3.5 w-1/3" /><Skeleton className="h-3 w-2/3" /></div>)}
          </div>
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="You’re all caught up." message={tab === 'unread' ? 'No unread notifications.' : 'Nothing has been sent to you here yet.'} />
        ) : (
          <div className={`divide-y transition-opacity ${list.isPlaceholderData ? 'opacity-60' : ''}`}>
            {items.map((n) => (
              <NotificationRow
                key={n.notificationId}
                notification={n}
                full
                onOpen={open}
                actions={!n.isRead && (
                  <Button variant="ghost" size="icon-sm" title="Mark as read" aria-label={`Mark “${n.title}” as read`} onClick={() => markRead.mutate(n)}>
                    <Check />
                  </Button>
                )}
              />
            ))}
          </div>
        )}
      </Card>
      {meta && meta.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span>{meta.totalCount} notification(s)</span>
          <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft /></Button>
          <span className="tabular">{page} / {meta.totalPages}</span>
          <Button variant="outline" size="icon-sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight /></Button>
        </div>
      )}
    </>
  );
}
