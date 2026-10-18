'use client';

import Link from 'next/link';
import { DetailList } from '@/components/shared/Display';
import { absoluteTime, entityLink, eventTypeLabel, prettyJson } from '@/features/notifications/format';
import type { AuditLogEntryDto } from '@/api/dto/notifications';

/** The expanded view of an audit entry: who it was about, what it touched, and its recorded data. */
export function AuditEntryDetails({ entry, area = 'business' }: { entry: AuditLogEntryDto; area?: 'business' | 'platform' }) {
  const link = entityLink(entry.entityType, entry.entityId, area);
  const subjectLink = entry.subjectUserId ? entityLink('User', entry.subjectUserId, area) : null;
  const json = prettyJson(entry.data);
  return (
    <div className="space-y-3 pb-1 pt-2">
      <DetailList
        columns={3}
        items={[
          { label: 'Event', value: <span>{eventTypeLabel(entry.eventType)} <code className="ml-1 text-xs text-muted-foreground">{entry.eventType}</code></span> },
          { label: 'When', value: absoluteTime(entry.occurredAt) },
          { label: 'By', value: entry.actorName ?? (entry.actorUserId ? 'Unknown user' : 'System') },
          {
            label: 'About user',
            value: entry.subjectUserId
              ? subjectLink ? <Link href={subjectLink} className="text-primary hover:underline">{entry.subjectName ?? 'Unknown user'}</Link> : entry.subjectName
              : '—',
          },
          {
            label: 'Record',
            value: entry.entityType
              ? link ? <Link href={link} className="text-primary hover:underline">{entry.entityType} ›</Link> : <span>{entry.entityType}{entry.entityId ? <code className="ml-1 text-xs text-muted-foreground">{entry.entityId}</code> : null}</span>
              : '—',
          },
        ]}
      />
      {json && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Data</p>
          <pre data-testid="audit-data" className="max-h-72 overflow-auto rounded-md border bg-background p-3 font-mono text-xs leading-relaxed">{json}</pre>
        </div>
      )}
    </div>
  );
}
