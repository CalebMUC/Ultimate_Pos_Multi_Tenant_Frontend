'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { refreshSession } from '@/api/client';
import { notificationsApi } from '@/api/endpoints/notifications';
import { EventSeverity } from '@/api/enums';
import { toastError } from '@/lib/forms';
import { useBusinessId } from '@/hooks/useSessionInfo';
import type { Paged } from '@/api/dto/common';
import type { NotificationDto, UnreadCountDto } from '@/api/dto/notifications';
import { parseUtc, resolveNotificationLink, toSeverity } from './format';

// The bell polls. When a push channel (SignalR) arrives it replaces POLL_MS and the latest-list refresh below, and nothing
// outside this file changes.
export const POLL_MS = 30_000;
export const BELL_PAGE_SIZE = 10;
const MAX_CRITICAL_TOASTS = 3;
/** "Your access changed" and "Your branches changed": the token is out of date, so it is renewed. */
const SESSION_CHANGES = new Set(['User.RolesChanged', 'User.BranchesChanged']);

/** Every notifications key starts with [notifications, businessId] so a business switch never shows another business's. */
export const notificationKeys = {
  all: (businessId: string | null) => ['notifications', businessId] as const,
  unreadCount: (businessId: string | null) => ['notifications', businessId, 'unread-count'] as const,
  list: (businessId: string | null, params: { unreadOnly: boolean; page: number; pageSize: number }) => ['notifications', businessId, 'list', params] as const,
};

type ListCache = Paged<NotificationDto>;

function patchLists(qc: QueryClient, businessId: string | null, fn: (n: NotificationDto) => NotificationDto) {
  qc.setQueriesData<ListCache>({ queryKey: [...notificationKeys.all(businessId), 'list'] }, (old) => (old ? { ...old, items: old.items.map(fn) } : old));
}

/** Snapshots everything an optimistic update touches, to roll back on failure. */
function snapshot(qc: QueryClient, businessId: string | null): [QueryKey, unknown][] {
  return qc.getQueriesData({ queryKey: notificationKeys.all(businessId) });
}

function restore(qc: QueryClient, saved: [QueryKey, unknown][] | undefined) {
  saved?.forEach(([key, data]) => qc.setQueryData(key, data));
}

/** The unread count: polled every 30 s while the tab is visible, refetched on focus. React Query pauses intervals in hidden tabs. */
export function useUnreadCount() {
  const businessId = useBusinessId();
  return useQuery({
    queryKey: notificationKeys.unreadCount(businessId),
    queryFn: notificationsApi.unreadCount,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
}

export function useNotificationList(params: { unreadOnly: boolean; page: number; pageSize?: number }, opts: { enabled?: boolean } = {}) {
  const businessId = useBusinessId();
  const full = { unreadOnly: params.unreadOnly, page: params.page, pageSize: params.pageSize ?? 20 };
  return useQuery({
    queryKey: notificationKeys.list(businessId, full),
    queryFn: () => notificationsApi.list(full),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    enabled: opts.enabled ?? true,
  });
}

export function useNotificationActions() {
  const qc = useQueryClient();
  const businessId = useBusinessId();

  const markRead = useMutation({
    mutationFn: (n: Pick<NotificationDto, 'notificationId' | 'isRead'>) => notificationsApi.markRead(n.notificationId),
    onMutate: async (n) => {
      await qc.cancelQueries({ queryKey: notificationKeys.all(businessId) });
      const saved = snapshot(qc, businessId);
      if (!n.isRead) {
        qc.setQueryData<UnreadCountDto>(notificationKeys.unreadCount(businessId), (old) => (old ? { unreadCount: Math.max(0, old.unreadCount - 1) } : old));
      }
      const readAt = new Date().toISOString();
      patchLists(qc, businessId, (x) => (x.notificationId === n.notificationId ? { ...x, isRead: true, readAt: x.readAt ?? readAt } : x));
      return { saved };
    },
    onError: (error, _n, ctx) => {
      restore(qc, ctx?.saved);
      toastError(error);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all(businessId) }),
  });

  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: notificationKeys.all(businessId) });
      const saved = snapshot(qc, businessId);
      qc.setQueryData<UnreadCountDto>(notificationKeys.unreadCount(businessId), { unreadCount: 0 });
      const readAt = new Date().toISOString();
      patchLists(qc, businessId, (x) => (x.isRead ? x : { ...x, isRead: true, readAt }));
      return { saved };
    },
    onError: (error, _v, ctx) => {
      restore(qc, ctx?.saved);
      toastError(error, 'Couldn’t mark notifications as read.');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all(businessId) }),
  });

  return { markRead, markAllRead };
}

/**
 * Mounted once (in the header bell). Keeps the latest 10 fresh, and toasts Critical notifications that arrive after the first load:
 * one toast each, at most 3 per poll, never repeated.
 */
export function useNotifications(area: 'business' | 'platform' = 'business') {
  const qc = useQueryClient();
  const router = useRouter();
  const businessId = useBusinessId();
  const unread = useUnreadCount();
  const latest = useNotificationList({ unreadOnly: false, page: 1, pageSize: BELL_PAGE_SIZE });
  const { markRead, markAllRead } = useNotificationActions();
  const seen = useRef<{ businessId: string | null; newest: number | null; ids: Set<string> }>({ businessId, newest: null, ids: new Set() });
  const lastCount = useRef<number | null>(null);

  // A new business starts a new baseline.
  if (seen.current.businessId !== businessId) {
    seen.current = { businessId, newest: null, ids: new Set() };
    lastCount.current = null;
  }

  // The count is what's polled; when it rises, fetch the newest notifications so the popover and toasts are current.
  const count = unread.data?.unreadCount;
  useEffect(() => {
    if (count === undefined) return;
    if (lastCount.current !== null && count > lastCount.current) {
      void qc.invalidateQueries({ queryKey: notificationKeys.list(businessId, { unreadOnly: false, page: 1, pageSize: BELL_PAGE_SIZE }) });
    }
    lastCount.current = count;
  }, [count, businessId, qc]);

  const items = latest.data?.items;
  useEffect(() => {
    if (!items || latest.isPlaceholderData) return;
    const state = seen.current;
    const newestNow = items.reduce<number | null>((max, n) => Math.max(max ?? 0, parseUtc(n.createdAt).getTime()), null);
    if (state.newest === null) {
      // First load: the baseline. Old notifications never toast.
      state.newest = newestNow ?? 0;
      return;
    }
    const fresh = items
      .filter((n) => toSeverity(n.severity) === EventSeverity.Critical && !n.isRead && !state.ids.has(n.notificationId) && parseUtc(n.createdAt).getTime() > state.newest!)
      .slice(0, MAX_CRITICAL_TOASTS);
    for (const n of fresh) {
      state.ids.add(n.notificationId);
      const link = resolveNotificationLink(n.link, area);
      toast.error(n.title, {
        id: `notification-${n.notificationId}`,
        description: n.message,
        duration: 15_000,
        action: link ? { label: 'Open', onClick: () => { markRead.mutate(n); router.push(link); } } : undefined,
      });
    }
    // "Your access changed": the access token still carries the old permissions, so renew it and the menus follow.
    const baseline = state.newest;
    if (items.some((n) => SESSION_CHANGES.has(n.eventType) && parseUtc(n.createdAt).getTime() > baseline)) {
      void refreshSession().catch(() => undefined);
    }
    if (newestNow !== null && newestNow > state.newest) state.newest = newestNow;
    // markRead is stable enough for a click handler; leaving it out avoids re-running on every mutation state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, latest.isPlaceholderData, router, area]);

  return { unreadCount: count ?? 0, unread, latest, markRead, markAllRead };
}
