'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Command } from 'cmdk';
import { Check, ChevronsUpDown, Layers, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays';
import { auditLogApi } from '@/api/endpoints/auditLog';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { cn } from '@/lib/utils';
import { areaLabel, eventTypeLabel, groupEventTypes } from '@/features/notifications/format';

/** Event types grouped by area. Picking an area's "All … events" sends just the area, which matches every type in it. */
export function EventTypeCombobox({ value, onChange, className, types: fixedTypes }: {
  value: string | null;
  onChange(v: string | null): void;
  className?: string;
  /** A fixed list instead of GET /audit-log/event-types (which needs AuditLog.View). */
  types?: readonly string[];
}) {
  const key = useQueryKey();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const types = useQuery({ queryKey: key('audit-log', { eventTypes: true }), queryFn: auditLogApi.eventTypes, staleTime: 60 * 60_000, enabled: !fixedTypes });
  const groups = groupEventTypes(fixedTypes ?? types.data ?? []);
  const label = value ? (value.includes('.') ? eventTypeLabel(value) : `All ${areaLabel(value).toLowerCase()} events`) : null;
  const s = search.trim().toLowerCase();
  const visible = groups
    .map((g) => ({ ...g, types: g.types.filter((t) => !s || eventTypeLabel(t).toLowerCase().includes(s) || t.toLowerCase().includes(s)) }))
    .filter((g) => g.types.length > 0 || (s && areaLabel(g.area).toLowerCase().includes(s)));

  const item = 'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm aria-selected:bg-accent';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Event type"
        className={cn('flex h-9 w-56 items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
      >
        <span className={cn('truncate', !label && 'text-muted-foreground')}>{label ?? 'All events'}</span>
        <span className="flex items-center gap-1">
          {value && (
            <span role="button" tabIndex={0} aria-label="Clear event type" className="rounded p-0.5 hover:bg-muted"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange(null); } }}>
              <X className="size-3.5" />
            </span>
          )}
          <ChevronsUpDown className="size-4 opacity-50" />
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <Command shouldFilter={false}>
          <Command.Input value={search} onValueChange={setSearch} placeholder="Search events…" className="h-10 w-full border-b bg-transparent px-3 text-sm outline-none" />
          <Command.List className="max-h-80 overflow-y-auto p-1">
            {(!fixedTypes && types.isLoading) && <div className="py-4 text-center text-sm text-muted-foreground">Loading…</div>}
            {!(!fixedTypes && types.isLoading) && visible.length === 0 && <Command.Empty className="py-4 text-center text-sm text-muted-foreground">No event types.</Command.Empty>}
            {visible.map((g) => (
              <Command.Group key={g.area} heading={areaLabel(g.area)} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground">
                <Command.Item value={`area:${g.area}`} onSelect={() => { onChange(g.area); setOpen(false); setSearch(''); }} className={cn(item, 'font-medium')}>
                  <Check className={cn('size-4', value === g.area ? 'opacity-100' : 'opacity-0')} />
                  <Layers className="size-3.5 text-muted-foreground" />All {areaLabel(g.area).toLowerCase()} events
                </Command.Item>
                {g.types.map((t) => (
                  <Command.Item key={t} value={t} onSelect={() => { onChange(t); setOpen(false); setSearch(''); }} className={cn(item, 'pl-6')}>
                    <Check className={cn('size-4', value === t ? 'opacity-100' : 'opacity-0')} />
                    {eventTypeLabel(t)}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
