// Application/Notifications/NotificationService.cs
import type { EventSeverity } from '../enums';
import type { DateOnly, DateTimeString, Guid, PageParams } from './common';

export interface NotificationDto {
  notificationId: Guid;
  eventType: string;
  severity: EventSeverity;
  title: string;
  message: string;
  /** A frontend path, e.g. "/sales/{id}". */
  link: string | null;
  isRead: boolean;
  readAt: DateTimeString | null;
  createdAt: DateTimeString;
  /** Null for platform notifications, which show in every business. */
  businessId: Guid | null;
}

export interface UnreadCountDto { unreadCount: number }

export interface AuditLogEntryDto {
  systemEventId: Guid;
  eventType: string;
  severity: EventSeverity;
  summary: string;
  /** Null actor: the system (an alert sweep, an M-Pesa webhook). */
  actorUserId: Guid | null;
  actorName: string | null;
  /** The user the event is about. */
  subjectUserId: Guid | null;
  subjectName: string | null;
  entityType: string | null;
  entityId: Guid | null;
  /** JSON text. */
  data: string | null;
  occurredAt: DateTimeString;
}

export interface AuditLogQuery extends PageParams {
  /** Local calendar days, both inclusive. */
  from?: DateOnly;
  to?: DateOnly;
  /** An exact type ("Sale.Voided") or a whole area ("Sale"). */
  eventType?: string;
  actorUserId?: Guid;
  entityType?: string;
  entityId?: Guid;
  minimumSeverity?: 'Info' | 'Warning' | 'Critical';
  search?: string;
}
