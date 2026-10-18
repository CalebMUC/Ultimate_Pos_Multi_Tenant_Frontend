'use client';

import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Command } from 'cmdk';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { cn } from '@/lib/utils';

interface EntityComboboxProps<T> {
  /** Query-key resource, e.g. 'customers'. */
  resource: string;
  /** Server search. Called with the debounced text (may be empty). */
  fetcher: (search: string, signal?: AbortSignal) => Promise<T[]>;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  renderItem?: (item: T) => ReactNode;
  value: string | null;
  /** Shown while the selected item isn't in the loaded results. */
  selectedLabel?: string | null;
  onChange: (id: string | null, item: T | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  invalid?: boolean;
  className?: string;
  /** Extra key params that change the results (filters). */
  params?: unknown;
  minSearchLength?: number;
  footer?: ReactNode;
}

/** A searchable picker backed by a server search. */
export function EntityCombobox<T>(props: EntityComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim(), 250);
  const key = useQueryKey();
  const minLen = props.minSearchLength ?? 0;
  const [selectedCache, setSelectedCache] = useState<{ id: string; label: string } | null>(null);

  const query = useQuery({
    queryKey: key(props.resource, { combobox: true, search: debounced, ...(props.params as object | undefined) }),
    queryFn: ({ signal }) => props.fetcher(debounced, signal),
    enabled: open && debounced.length >= minLen,
    staleTime: 30_000,
  });

  const items = query.data ?? [];
  const label =
    (props.value && items.find((i) => props.getId(i) === props.value) && props.getLabel(items.find((i) => props.getId(i) === props.value)!)) ||
    (selectedCache?.id === props.value ? selectedCache.label : null) ||
    props.selectedLabel ||
    null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={props.disabled}
        aria-invalid={props.invalid || undefined}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-[invalid=true]:border-destructive',
          props.className,
        )}
      >
        <span className={cn('truncate', !label && 'text-muted-foreground')}>{label ?? props.placeholder ?? 'Select…'}</span>
        <span className="flex items-center gap-1">
          {props.clearable && props.value && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear"
              onClick={(e) => {
                e.stopPropagation();
                props.onChange(null, null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                  props.onChange(null, null);
                }
              }}
              className="rounded p-0.5 hover:bg-muted"
            >
              <X className="size-3.5" />
            </span>
          )}
          <ChevronsUpDown className="size-4 opacity-50" />
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Command.Input value={search} onValueChange={setSearch} placeholder={props.searchPlaceholder ?? 'Search…'} className="h-10 flex-1 bg-transparent text-sm outline-none" />
            {query.isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
          <Command.List className="max-h-64 overflow-y-auto p-1">
            {debounced.length < minLen ? (
              <div className="py-4 text-center text-sm text-muted-foreground">Type at least {minLen} characters.</div>
            ) : (
              !query.isFetching && <Command.Empty className="py-4 text-center text-sm text-muted-foreground">No results.</Command.Empty>
            )}
            {items.map((item) => {
              const id = props.getId(item);
              return (
                <Command.Item
                  key={id}
                  value={id}
                  onSelect={() => {
                    setSelectedCache({ id, label: props.getLabel(item) });
                    props.onChange(id, item);
                    setOpen(false);
                    setSearch('');
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm aria-selected:bg-accent"
                >
                  <Check className={cn('size-4 shrink-0', id === props.value ? 'opacity-100' : 'opacity-0')} />
                  <span className="min-w-0 flex-1">{props.renderItem ? props.renderItem(item) : props.getLabel(item)}</span>
                </Command.Item>
              );
            })}
          </Command.List>
          {props.footer && <div className="border-t p-1">{props.footer}</div>}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
