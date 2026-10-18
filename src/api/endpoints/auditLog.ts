import { utcOffsetMinutes } from '@/lib/format';
import { cleanParams } from '@/lib/utils';
import { api } from '../client';
import type { AuditLogEntryDto, AuditLogQuery } from '../dto/notifications';

/** The query string the audit log is called with. The offset makes from/to mean local days. */
export function auditLogParams(query: AuditLogQuery) {
  const params = cleanParams({ ...query, search: query.search?.trim() || undefined });
  return query.from || query.to ? { ...params, utcOffsetMinutes: utcOffsetMinutes() } : params;
}

/** Needs AuditLog.View. */
export const auditLogApi = {
  list: (query: AuditLogQuery, signal?: AbortSignal) => api.getPaged<AuditLogEntryDto>('/audit-log', auditLogParams(query), { signal }),
  eventTypes: () => api.get<string[]>('/audit-log/event-types'),
};
