import { api } from '../client';
import type { Guid } from '../dto/common';
import type { NotificationDto, UnreadCountDto } from '../dto/notifications';

/** The signed-in user's notifications in the current business (plus platform ones). Every signed-in user may call these. */
export const notificationsApi = {
  unreadCount: () => api.get<UnreadCountDto>('/notifications/unread-count'),
  list: (query: { unreadOnly?: boolean; page?: number; pageSize?: number }) =>
    api.getPaged<NotificationDto>('/notifications', { unreadOnly: query.unreadOnly ?? false, page: query.page ?? 1, pageSize: query.pageSize ?? 20 }),
  markRead: (id: Guid) => api.post<Record<string, never>>(`/notifications/${id}/read`),
  markAllRead: () => api.post<{ marked: number }>('/notifications/read-all'),
};
