'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { Badge, NativeSelect } from '@/components/ui/primitives';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { DateRangeFilter, presetRange, type DateRangeValue } from '@/components/shared/DateRange';
import { PageHeader } from '@/components/shared/Display';
import { EntityCombobox } from '@/components/shared/EntityCombobox';
import { auditLogApi } from '@/api/endpoints/auditLog';
import { platformApi } from '@/api/endpoints/platform';
import { SYSTEM_EVENT_TYPES } from './eventTypes';
import { usersApi } from '@/api/endpoints/identity';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { absoluteTime, eventTypeLabel, severityStyle } from '@/features/notifications/format';
import type { AuditLogEntryDto, AuditLogQuery } from '@/api/dto/notifications';
import type { UserDto } from '@/api/dto/identity';
import { AuditEntryDetails } from './AuditEntryDetails';
import { EventTypeCombobox } from './EventTypeCombobox';

type Severity = NonNullable<AuditLogQuery['minimumSeverity']>;

const columns: ColumnDef<AuditLogEntryDto, unknown>[] = [
  {
    header: 'Time',
    accessorKey: 'occurredAt',
    meta: { className: 'whitespace-nowrap' },
    cell: ({ row }) => <span className="flex items-center gap-1"><ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />{absoluteTime(row.original.occurredAt)}</span>,
  },
  {
    header: 'Severity',
    accessorKey: 'severity',
    cell: ({ row }) => {
      const s = severityStyle(row.original.severity);
      const Icon = s.icon;
      return <Badge variant={s.badge}><Icon className="size-3" />{s.label}</Badge>;
    },
  },
  { header: 'Event', accessorKey: 'eventType', cell: ({ row }) => <span className="whitespace-nowrap font-medium">{eventTypeLabel(row.original.eventType)}</span> },
  { header: 'Who', accessorKey: 'actorName', cell: ({ row }) => row.original.actorName ?? (row.original.actorUserId ? 'Unknown user' : <span className="text-muted-foreground">System</span>) },
  { header: 'Summary', accessorKey: 'summary', meta: { className: 'min-w-[16rem]' } },
];

/**
 * The audit log table with its filters. In a business it reads /audit-log; in the platform area it reads /platform/audit-log, for one
 * business (businessId) or the platform's own events, which has no severity filter and no user list.
 */
export function AuditLogView({ platform, header = true }: { platform?: { businessId?: string }; header?: boolean }) {
  const key = useQueryKey();
  const canUsers = usePermission('Users.View') && !platform;
  const [range, setRange] = useState<DateRangeValue>(() => presetRange('7d'));
  const [eventType, setEventType] = useState<string | null>(null);
  const [actorUserId, setActorUserId] = useState<string | null>(null);
  const [severity, setSeverity] = useState<Severity | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const debounced = useDebouncedValue(search.trim(), 300);

  const params: AuditLogQuery = {
    page,
    pageSize,
    from: range.from,
    to: range.to,
    eventType: eventType ?? undefined,
    actorUserId: actorUserId ?? undefined,
    minimumSeverity: severity || undefined,
    search: debounced || undefined,
  };
  const query = useQuery({
    queryKey: platform ? key('platform-audit-log', { ...params, businessId: platform.businessId ?? null }) : key('audit-log', params),
    queryFn: ({ signal }) => {
      if (!platform) return auditLogApi.list(params, signal);
      const { minimumSeverity: _ignored, ...rest } = params;
      void _ignored;
      return platformApi.auditLog({ ...rest, businessId: platform.businessId }, signal);
    },
    placeholderData: keepPreviousData,
  });
  const area = platform ? 'platform' : 'business';
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };

  return (
    <>
      {header && (
        <PageHeader
          title={platform ? 'Platform audit log' : 'Audit log'}
          description={platform ? 'What happened on the platform: registrations, suspensions, licences and Super Users. Click a row for details.' : 'Everything recorded in this business: sign-ins, changes and alerts, newest first. Click a row for details.'}
        />
      )}
      <DataTable
        mode="server"
        columns={columns.map((c) => ({ ...c, enableSorting: false }))}
        data={query.data?.items}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        getRowId={(e) => e.systemEventId}
        renderExpanded={(e) => <AuditEntryDetails entry={e} area={area} />}
        page={page}
        pageSize={pageSize}
        totalCount={query.data?.meta.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={reset(setPageSize)}
        search={search}
        onSearchChange={reset(setSearch)}
        searchPlaceholder="Search summaries…"
        emptyTitle="Nothing recorded"
        emptyMessage="No events match these filters."
        toolbar={
          <>
            <DateRangeFilter value={range} onChange={reset(setRange)} />
            <EventTypeCombobox value={eventType} onChange={reset(setEventType)} types={platform ? SYSTEM_EVENT_TYPES : undefined} />
            {canUsers && (
              <div className="w-52">
                <EntityCombobox<UserDto>
                  resource="users"
                  fetcher={async (s) => {
                    const users = await usersApi.list();
                    const q = s.toLowerCase();
                    return users.filter((u) => !q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)).slice(0, 30);
                  }}
                  getId={(u) => u.id}
                  getLabel={(u) => u.fullName}
                  value={actorUserId}
                  onChange={reset(setActorUserId)}
                  placeholder="Anyone"
                  searchPlaceholder="Name or email…"
                  clearable
                />
              </div>
            )}
            {!platform && (
              <NativeSelect value={severity} onChange={(e) => reset(setSeverity)(e.target.value as Severity | '')} className="w-40" aria-label="Minimum severity">
                <option value="">Any severity</option>
                <option value="Warning">Warning and up</option>
                <option value="Critical">Critical only</option>
              </NativeSelect>
            )}
          </>
        }
        csv={{
          fileName: `audit-log-${range.from}-to-${range.to}-p${page}`,
          columns: [
            { header: 'Time (UTC)', value: (e) => e.occurredAt },
            { header: 'Severity', value: (e) => severityStyle(e.severity).label },
            { header: 'Event', value: (e) => e.eventType },
            { header: 'Who', value: (e) => e.actorName ?? (e.actorUserId ? '' : 'System') },
            { header: 'Summary', value: (e) => e.summary },
            { header: 'About user', value: (e) => e.subjectName },
            { header: 'Entity type', value: (e) => e.entityType },
            { header: 'Entity id', value: (e) => e.entityId },
            { header: 'Data', value: (e) => e.data },
          ],
        }}
      />
    </>
  );
}

export function AuditLogPage() {
  return <AuditLogView />;
}
