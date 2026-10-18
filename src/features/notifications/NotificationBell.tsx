'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/primitives';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays';
import type { NotificationDto } from '@/api/dto/notifications';
import { badgeText, resolveNotificationLink } from './format';
import { NotificationRow } from './NotificationRow';
import { useNotifications } from './useNotifications';

export function NotificationBell({ area = 'business' }: { area?: 'business' | 'platform' }) {
  const router = useRouter();
  const { unreadCount, latest, markRead, markAllRead } = useNotifications(area);
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const badge = badgeText(unreadCount);

  // Announce changes to the count, not the first value, so screen readers aren't told on every page load.
  const [previous, setPrevious] = useState<number | null>(null);
  useEffect(() => {
    if (previous !== null && unreadCount !== previous) setAnnouncement(unreadCount ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'No unread notifications');
    setPrevious(unreadCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount]);

  function openNotification(n: NotificationDto) {
    if (!n.isRead) markRead.mutate(n);
    setOpen(false);
    const link = resolveNotificationLink(n.link, area);
    if (link) router.push(link);
  }

  const items = latest.data?.items ?? [];
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications, ${unreadCount} unread`}>
            <Bell />
            {badge && (
              <span data-testid="notification-badge" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
                {badge}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[22rem] p-0" aria-label="Notifications">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && <span className="text-xs text-muted-foreground">{unreadCount} unread</span>}
          </div>
          <div className="max-h-[26rem] divide-y overflow-y-auto">
            {latest.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3 px-3 py-3"><Skeleton className="size-4" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-2/3" /><Skeleton className="h-3 w-full" /></div></div>
              ))
            ) : latest.error && items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Couldn’t load notifications ·{' '}
                <button type="button" className="font-medium text-primary hover:underline" onClick={() => latest.refetch()}>Retry</button>
              </p>
            ) : items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">You’re all caught up.</p>
            ) : (
              items.map((n) => <NotificationRow key={n.notificationId} notification={n} onOpen={openNotification} />)
            )}
          </div>
          <div className="flex items-center justify-between border-t px-2 py-1.5">
            <Button variant="ghost" size="sm" disabled={unreadCount === 0 || markAllRead.isPending} onClick={() => markAllRead.mutate()}>
              <CheckCheck />Mark all as read
            </Button>
            <Button variant="link" size="sm" asChild><Link href={area === 'platform' ? '/platform/notifications' : '/notifications'} onClick={() => setOpen(false)}>View all</Link></Button>
          </div>
        </PopoverContent>
      </Popover>
      <span className="sr-only" aria-live="polite" role="status">{announcement}</span>
    </>
  );
}
