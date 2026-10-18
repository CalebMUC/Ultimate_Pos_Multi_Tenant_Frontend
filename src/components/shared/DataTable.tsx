'use client';

import { Fragment, useState, type ReactNode } from 'react';
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type OnChangeFn, type PaginationState, type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { downloadCsv, type CsvColumn } from '@/lib/csv';
import { cn } from '@/lib/utils';
import { EmptyState, ErrorState } from './States';

export type { ColumnDef } from '@tanstack/react-table';

interface BaseProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[] | undefined;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  getRowId?: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyMessage?: ReactNode;
  emptyAction?: ReactNode;
  /** Filters and buttons shown above the table, next to the search box. */
  toolbar?: ReactNode;
  csv?: { fileName: string; columns: CsvColumn<T>[] };
  rowClassName?: (row: T) => string | undefined;
  footer?: ReactNode;
  /** Makes rows expandable: clicking a row shows this under it. Ignored when onRowClick is set. */
  renderExpanded?: (row: T) => ReactNode;
}

interface ClientProps<T> extends BaseProps<T> {
  mode?: 'client';
  /** Shows a search box that filters the loaded rows. */
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
}

interface ServerProps<T> extends BaseProps<T> {
  mode: 'server';
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange(page: number): void;
  onPageSizeChange?(pageSize: number): void;
  /** Server-side sorting (only the product list supports it). */
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  search?: string;
  onSearchChange?(value: string): void;
  searchPlaceholder?: string;
}

export type DataTableProps<T> = ClientProps<T> | ServerProps<T>;

/** One table for every list: client mode sorts, filters and pages loaded rows; server mode drives the API's paging. */
export function DataTable<T>(props: DataTableProps<T>) {
  const server = props.mode === 'server';
  const [clientSorting, setClientSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const expandable = !!props.renderExpanded && !props.onRowClick;
  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [clientPagination, setClientPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: (!server && (props as ClientProps<T>).pageSize) || 25,
  });

  const table = useReactTable<T>({
    data: props.data ?? [],
    columns: props.columns,
    getRowId: props.getRowId ? (row) => props.getRowId!(row) : undefined,
    getCoreRowModel: getCoreRowModel(),
    ...(server
      ? {
          manualPagination: true,
          manualSorting: true,
          pageCount: Math.max(1, Math.ceil(props.totalCount / props.pageSize)),
          state: { sorting: props.sorting ?? [], pagination: { pageIndex: props.page - 1, pageSize: props.pageSize } },
          onSortingChange: props.onSortingChange,
          enableSorting: !!props.onSortingChange,
        }
      : {
          getSortedRowModel: getSortedRowModel(),
          getFilteredRowModel: getFilteredRowModel(),
          getPaginationRowModel: getPaginationRowModel(),
          state: { sorting: clientSorting, globalFilter, pagination: clientPagination },
          onSortingChange: setClientSorting,
          onGlobalFilterChange: setGlobalFilter,
          onPaginationChange: setClientPagination,
          globalFilterFn: 'includesString',
        }),
  });

  const rows = table.getRowModel().rows;
  const showSearch = server ? !!props.onSearchChange : !!(props as ClientProps<T>).searchable;
  const searchValue = server ? props.search ?? '' : globalFilter;
  const onSearch = server ? props.onSearchChange : setGlobalFilter;
  const total = server ? props.totalCount : table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const pageCount = table.getPageCount();
  const colSpan = props.columns.length;

  return (
    <div className="space-y-3">
      {(showSearch || props.toolbar || props.csv) && (
        <div className="flex flex-wrap items-center gap-2">
          {showSearch && (
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(e) => {
                  onSearch?.(e.target.value);
                  if (!server) table.setPageIndex(0);
                }}
                placeholder={props.searchPlaceholder ?? 'Search…'}
                className="pl-8"
                aria-label="Search"
              />
            </div>
          )}
          {props.toolbar}
          {props.csv && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              disabled={!props.data?.length}
              onClick={() => {
                const exportRows = server ? props.data ?? [] : table.getSortedRowModel().rows.map((r) => r.original);
                downloadCsv(props.csv!.fileName, exportRows, props.csv!.columns);
              }}
            >
              <Download />CSV
            </Button>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  const meta = header.column.columnDef.meta as { align?: 'right' | 'center'; className?: string } | undefined;
                  return (
                    <TableHead key={header.id} className={cn(meta?.align === 'right' && 'text-right', meta?.align === 'center' && 'text-center', meta?.className)}>
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn('inline-flex items-center gap-1 hover:text-foreground', meta?.align === 'right' && 'flex-row-reverse')}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? <ArrowUp className="size-3" /> : sorted === 'desc' ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {props.isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  {props.columns.map((_c, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full max-w-[10rem]" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : props.error ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colSpan}><ErrorState error={props.error} onRetry={props.onRetry} /></TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colSpan}>
                  <EmptyState title={searchValue ? 'No matches' : props.emptyTitle ?? 'Nothing here yet'} message={searchValue ? 'Try a different search.' : props.emptyMessage} action={searchValue ? undefined : props.emptyAction} />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const isOpen = expandable && expanded.has(row.id);
                return (
                  <Fragment key={row.id}>
                    <TableRow
                      onClick={props.onRowClick ? () => props.onRowClick!(row.original) : expandable ? () => toggle(row.id) : undefined}
                      onKeyDown={expandable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(row.id); } } : undefined}
                      tabIndex={expandable ? 0 : undefined}
                      aria-expanded={expandable ? isOpen : undefined}
                      className={cn((props.onRowClick || expandable) && 'cursor-pointer', isOpen && 'border-b-0 bg-muted/40', props.rowClassName?.(row.original))}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const meta = cell.column.columnDef.meta as { align?: 'right' | 'center'; className?: string } | undefined;
                        return (
                          <TableCell key={cell.id} className={cn(meta?.align === 'right' && 'text-right', meta?.align === 'center' && 'text-center', meta?.className)}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell colSpan={colSpan} className="pt-0">{props.renderExpanded!(row.original)}</TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
          {props.footer}
        </Table>
      </div>

      {total > 0 && (pageCount > 1 || server) && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <NativeSelect
              value={pageSize}
              onChange={(e) => {
                const size = Number(e.target.value);
                if (server) props.onPageSizeChange?.(size);
                else table.setPageSize(size);
              }}
              className="h-8 w-20"
              aria-label="Rows per page"
              disabled={server && !props.onPageSizeChange}
            >
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </NativeSelect>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={pageIndex === 0}
              onClick={() => (server ? props.onPageChange(props.page - 1) : table.previousPage())}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <span className="tabular">{pageIndex + 1} / {pageCount}</span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={pageIndex + 1 >= pageCount}
              onClick={() => (server ? props.onPageChange(props.page + 1) : table.nextPage())}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
