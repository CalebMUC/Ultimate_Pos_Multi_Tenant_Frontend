'use client';

import { cn } from '@/lib/utils';
import type { NotificationDto } from '@/api/dto/notifications';
import { absoluteTime, relativeTime, severityStyle } from './format';

/** One notification: severity icon, title, message and time. Unread rows are bold with a dot. */
export function NotificationRow({ notification: n, onOpen, full = false, actions }: {
  notification: NotificationDto;
  onOpen(n: NotificationDto): void;
  /** Full message (notifications page) instead of one line (bell). */
  full?: boolean;
  actions?: React.ReactNode;
}) {
  const style = severityStyle(n.severity);
  const Icon = style.icon;
  return (
    <div className={cn('group flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50', !n.isRead && 'bg-primary/[0.03]')}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', style.tone)} aria-label={style.label} />
      <button type="button" onClick={() => onOpen(n)} className="min-w-0 flex-1 text-left focus:outline-none focus-visible:underline">
        <span className="flex items-baseline gap-2">
          <span className={cn('min-w-0 flex-1 truncate text-sm', !n.isRead ? 'font-semibold' : 'text-muted-foreground')}>{n.title}</span>
          <time dateTime={n.createdAt} title={absoluteTime(n.createdAt)} className="shrink-0 text-xs text-muted-foreground">{relativeTime(n.createdAt)}</time>
        </span>
        <span className={cn('block text-xs text-muted-foreground', !full && 'truncate')}>{n.message}</span>
        {!n.isRead && <span className="sr-only">Unread.</span>}
      </button>
      <span className="flex items-center gap-1">
        {actions}
        <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.isRead ? 'bg-transparent' : 'bg-primary')} aria-hidden />
      </span>
    </div>
  );
}
