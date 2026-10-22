'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, Bike, CheckCircle2, Fuel, MapPin, Phone, Plus, Route, Undo2, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/primitives';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, PageHeader, StatusBadge } from '@/components/shared/Display';
import { EnumSelect } from '@/components/shared/Pickers';
import { EmptyState, ErrorState } from '@/components/shared/States';
import { deliveryOrdersApi } from '@/api/endpoints/deliveries';
import { DeliveryOrderStatus, PaymentMethod, labels } from '@/api/enums';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { addDays, formatDateTime, todayIso, toIsoDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSession } from '@/stores/session';
import { ReasonDialog } from '@/features/platform/ReasonDialog';
import {
  describeLines, DispatchDialog, paymentLabel, RecordDeliveryDialog, ReturnDeliveryDialog, SendTogetherDialog,
} from '@/features/deliveries/DeliveryDialogs';
import type { DeliveryOrderDto } from '@/api/dto/deliveries';

type Action = { kind: 'dispatch' | 'deliver' | 'cancel' | 'return'; order: DeliveryOrderDto } | null;
/** A trip picked from a card: the board shows only its orders. */
type TripFilter = { id: string; number: string } | null;

const isOpenOrder = (o: Pick<DeliveryOrderDto, 'status'>) => o.status === DeliveryOrderStatus.Pending || o.status === DeliveryOrderStatus.OutForDelivery;

const columns: ColumnDef<DeliveryOrderDto, unknown>[] = [
  { header: 'Order', accessorKey: 'orderNumber', cell: ({ row }) => <span className="font-medium">{row.original.orderNumber}</span> },
  { header: 'Taken', accessorKey: 'createdAt', cell: ({ row }) => formatDateTime(row.original.createdAt) },
  { header: 'Customer', accessorKey: 'customerName' },
  { header: 'Items', id: 'items', cell: ({ row }) => <span className="text-xs">{describeLines(row.original)}</span> },
  { header: 'Rider', accessorKey: 'riderName', cell: ({ row }) => row.original.riderName ?? '—' },
  { header: 'Trip', accessorKey: 'tripNumber', cell: ({ row }) => row.original.tripNumber ?? '—' },
  {
    header: 'Status',
    accessorKey: 'status',
    cell: ({ row }) => (
      <span className="flex flex-wrap items-center gap-1">
        <StatusBadge kind="delivery" value={row.original.status} />
        {row.original.status === DeliveryOrderStatus.OutForDelivery && <Badge variant="warning">Not completed</Badge>}
      </span>
    ),
  },
  {
    header: 'Paid',
    id: 'paid',
    cell: ({ row }) => (row.original.paymentMethod !== null ? labels.paymentMethod[row.original.paymentMethod] : '—'),
  },
  {
    header: 'Total',
    id: 'total',
    meta: { align: 'right' },
    cell: ({ row }) => <MoneyText value={row.original.saleTotal ?? row.original.estimatedTotal} className={row.original.saleTotal === null ? 'text-muted-foreground' : 'font-medium'} />,
  },
];

function Deliveries() {
  const [action, setAction] = useState<Action>(null);
  const [trip, setTrip] = useState<TripFilter>(null);
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const focusId = useSearchParams().get('orderId');
  const close = (o: boolean) => !o && setAction(null);
  return (
    <>
      <PageHeader
        title="Deliveries"
        description="Orders delivered to customers. The stock is held for an order until the rider is back; the sale is completed then."
        actions={
          <>
            <Button variant="outline" asChild><Link href="/deliveries/cash-up"><Wallet />Rider cash-up</Link></Button>
            <Button variant="outline" asChild><Link href="/deliveries/trips"><Fuel />Trips &amp; fuel</Link></Button>
            <Can permission="DeliveryOrders.Create"><Button asChild><Link href="/deliveries/new"><Plus />New delivery order</Link></Button></Can>
          </>
        }
      />
      {focusId && <FocusedOrder id={focusId} onAction={setAction} onClose={() => router.replace(pathname)} />}
      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="all">All orders</TabsTrigger>
        </TabsList>
        <TabsContent value="board"><Board onAction={setAction} trip={trip} onTrip={setTrip} focusId={focusId} /></TabsContent>
        <TabsContent value="all"><AllOrders /></TabsContent>
      </Tabs>
      {action?.kind === 'dispatch' && <DispatchDialog order={action.order} open onOpenChange={close} />}
      {action?.kind === 'deliver' && <RecordDeliveryDialog order={action.order} open onOpenChange={close} />}
      {action?.kind === 'return' && <ReturnDeliveryDialog order={action.order} open onOpenChange={close} />}
      {action?.kind === 'cancel' && (
        <ReasonDialog
          open
          onOpenChange={close}
          title={`Cancel ${action.order.orderNumber}?`}
          description="Nothing has left stock, so the water and containers held for it become available again."
          confirmLabel="Cancel order"
          placeholder="e.g. customer called it off"
          onConfirm={async (reason) => {
            try {
              await deliveryOrdersApi.cancel(action.order.deliveryOrderId, reason);
            } finally {
              // Cancelled now, or recorded by someone else meanwhile: either way the board is out of date.
              void qc.invalidateQueries({ queryKey: ['delivery-orders'] });
              void qc.invalidateQueries({ queryKey: ['stock'] });
            }
            toast.success(`${action.order.orderNumber} cancelled`);
          }}
        />
      )}
    </>
  );
}

/** The order a notification or the POS linked to (?orderId=), with its actions, whatever column it is in. */
function FocusedOrder({ id, onAction, onClose }: { id: string; onAction(a: Action): void; onClose(): void }) {
  const key = useQueryKey();
  const q = useQuery({ queryKey: key('delivery-orders', { id }), queryFn: () => deliveryOrdersApi.get(id), refetchInterval: 30_000 });
  return (
    <section className="mb-4 max-w-xl space-y-2" aria-label="Selected order">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Selected order</h2>
        <Button variant="ghost" size="sm" onClick={onClose}><X />Close</Button>
      </div>
      {q.isLoading ? <Skeleton className="h-32" /> : q.error || !q.data ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <OrderCard order={q.data} onAction={onAction} />}
    </section>
  );
}

/**
 * Four columns: waiting, out with a rider (not completed), delivered today, returned today. Refreshes every 30 s so two counters see the
 * same board. With a trip picked, only that trip's orders, whenever they were delivered or returned.
 */
function Board({ onAction, trip, onTrip, focusId }: { onAction(a: Action): void; trip: TripFilter; onTrip(t: TripFilter): void; focusId: string | null }) {
  const key = useQueryKey();
  const canDispatch = usePermission('DeliveryOrders.Dispatch');
  const [selected, setSelected] = useState<string[]>([]);
  const [sendingTogether, setSendingTogether] = useState(false);
  const today = todayIso();
  const list = (status: DeliveryOrderStatus, extra: object = {}) => ({
    queryKey: key('delivery-orders', { board: status, ...extra }),
    queryFn: () => deliveryOrdersApi.list({ status, pageSize: 100, ...extra }),
    refetchInterval: 30_000,
    enabled: !trip,
  });
  const pending = useQuery(list(DeliveryOrderStatus.Pending));
  const out = useQuery(list(DeliveryOrderStatus.OutForDelivery));
  // Filtered by the day an order was taken, so look back a week and keep those delivered (or returned) today.
  const delivered = useQuery(list(DeliveryOrderStatus.Delivered, { from: addDays(today, -7), to: today }));
  const returned = useQuery(list(DeliveryOrderStatus.Returned, { from: addDays(today, -7), to: today }));
  const tripOrders = useQuery({
    queryKey: key('delivery-orders', { board: 'trip', deliveryTripId: trip?.id }),
    queryFn: () => deliveryOrdersApi.list({ deliveryTripId: trip!.id, pageSize: 100 }),
    refetchInterval: 30_000,
    enabled: !!trip,
  });
  const onDay = (at: string | null | undefined) => !!at && toIsoDate(new Date(at)) === today;

  const ofTrip = (status: DeliveryOrderStatus) => tripOrders.data?.items.filter((o) => o.status === status);
  const cols = trip
    ? {
        pending: { query: tripOrders, orders: ofTrip(DeliveryOrderStatus.Pending) },
        out: { query: tripOrders, orders: ofTrip(DeliveryOrderStatus.OutForDelivery) },
        delivered: { query: tripOrders, orders: ofTrip(DeliveryOrderStatus.Delivered) },
        returned: { query: tripOrders, orders: ofTrip(DeliveryOrderStatus.Returned) },
      }
    : {
        pending: { query: pending, orders: pending.data?.items },
        out: { query: out, orders: out.data?.items },
        delivered: { query: delivered, orders: delivered.data?.items.filter((o) => onDay(o.deliveredAt)) },
        returned: { query: returned, orders: returned.data?.items.filter((o) => onDay(o.returnedAt)) },
      };

  // Only orders still pending can go out together.
  const pendingOrders = cols.pending.orders ?? [];
  const chosen = pendingOrders.filter((o) => selected.includes(o.deliveryOrderId));
  useEffect(() => {
    setSelected((ids) => ids.filter((id) => pendingOrders.some((o) => o.deliveryOrderId === id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOrders.map((o) => o.deliveryOrderId).join()]);
  const toggle = (id: string) => setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const card = { onAction, onTrip, focusId };
  return (
    <div className="mt-3 space-y-3">
      {trip && (
        <div className="flex items-center gap-2 text-sm">
          <Route className="size-4 text-muted-foreground" />
          Showing trip <span className="font-semibold">{trip.number}</span>
          <Button variant="ghost" size="sm" onClick={() => onTrip(null)}><X />Show all</Button>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        <Column
          title="Pending"
          icon={<MapPin />}
          {...cols.pending}
          empty="No orders waiting."
          action={canDispatch && chosen.length > 0 && <Button size="sm" onClick={() => setSendingTogether(true)}><Bike />Send together ({chosen.length})</Button>}
          render={(o) => (
            <OrderCard key={o.deliveryOrderId} order={o} {...card} selectable={canDispatch} selected={selected.includes(o.deliveryOrderId)} onSelect={() => toggle(o.deliveryOrderId)} />
          )}
        />
        <Column title="Out for delivery" icon={<Bike />} {...cols.out} empty="No one is out." render={(o) => <OrderCard key={o.deliveryOrderId} order={o} {...card} />} />
        <Column title={trip ? 'Delivered' : 'Delivered today'} icon={<CheckCircle2 />} {...cols.delivered} empty="Nothing delivered yet today." render={(o) => <OrderCard key={o.deliveryOrderId} order={o} {...card} />} />
        <Column title={trip ? 'Returned' : 'Returned today'} icon={<Undo2 />} {...cols.returned} empty="Nothing came back today." render={(o) => <OrderCard key={o.deliveryOrderId} order={o} {...card} />} />
      </div>
      <SendTogetherDialog orders={chosen} open={sendingTogether} onOpenChange={setSendingTogether} onSent={() => setSelected([])} />
    </div>
  );
}

function Column({ title, icon, query, orders, render, empty, action }: {
  title: string;
  icon: React.ReactNode;
  query: { isLoading: boolean; error: unknown; refetch(): unknown };
  orders: DeliveryOrderDto[] | undefined;
  render(o: DeliveryOrderDto): React.ReactNode;
  empty: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-2" aria-label={title}>
      <h2 className="flex min-h-8 items-center gap-2 font-semibold [&>svg]:size-4 [&>svg]:text-muted-foreground">
        {icon}{title}
        {orders && <Badge variant="secondary">{orders.length}</Badge>}
        {action && <span className="ml-auto">{action}</span>}
      </h2>
      {query.isLoading ? (
        <Skeleton className="h-32" />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !orders?.length ? (
        <EmptyState title={empty} className="rounded-lg border border-dashed py-8" />
      ) : (
        orders.map(render)
      )}
    </section>
  );
}

function OrderCard({ order: o, onAction, onTrip, focusId, selectable, selected, onSelect }: {
  order: DeliveryOrderDto;
  onAction(a: Action): void;
  onTrip?(t: TripFilter): void;
  focusId?: string | null;
  selectable?: boolean;
  selected?: boolean;
  onSelect?(): void;
}) {
  const activeBranchId = useSession((s) => s.activeBranchId);
  const branchCount = useSession((s) => s.branches.length);
  const canDispatch = usePermission('DeliveryOrders.Dispatch');
  const canDeliver = usePermission('DeliveryOrders.Deliver');
  const canReturn = usePermission('DeliveryOrders.Return');
  const canCancel = usePermission('DeliveryOrders.Cancel');
  const ref = useRef<HTMLDivElement>(null);
  const focused = focusId === o.deliveryOrderId;
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [focused]);
  const elsewhere = o.branchId !== activeBranchId;
  const out = o.status === DeliveryOrderStatus.OutForDelivery;
  const expected = o.expectedPaymentMethod ?? PaymentMethod.Cash;
  return (
    <Card ref={ref} className={cn(focused && 'ring-2 ring-primary', selected && 'border-primary bg-primary/5')}>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="flex min-w-0 items-start gap-2">
          {selectable && <Checkbox checked={selected} onCheckedChange={() => onSelect?.()} aria-label={`Select ${o.orderNumber}`} className="mt-1" />}
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{o.customerName}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {o.orderNumber} · {formatDateTime(o.createdAt)}{branchCount > 1 && o.kraBranchId ? ` · ${o.kraBranchId} ${o.branchName ?? ''}` : ''}
            </p>
          </div>
        </div>
        <span className="text-right">
          <MoneyText value={o.saleTotal ?? o.estimatedTotal} className="font-semibold" />
          {o.paymentMethod !== null ? (
            <span className="block text-xs text-muted-foreground">{o.paymentMethod === PaymentMethod.Credit ? 'On account' : labels.paymentMethod[o.paymentMethod]}</span>
          ) : out ? (
            <span className="block text-xs text-muted-foreground">to collect · {paymentLabel(expected)}</span>
          ) : null}
        </span>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {out && <Badge variant="warning">Not completed</Badge>}
        <p>{describeLines(o)}</p>
        <p className="flex items-start gap-1.5 text-muted-foreground"><MapPin className="mt-0.5 size-3.5 shrink-0" />{o.deliveryAddress}</p>
        {o.contactPhone && <p className="flex items-center gap-1.5 text-muted-foreground"><Phone className="size-3.5" /><a href={`tel:${o.contactPhone}`} className="hover:underline">{o.contactPhone}</a></p>}
        {o.riderName && (
          <p className="flex flex-wrap items-center gap-1.5">
            <Bike className="size-3.5 text-muted-foreground" />{o.riderName}
            {o.dispatchedAt ? <span className="text-xs text-muted-foreground"> · out {formatDateTime(o.dispatchedAt)}</span> : null}
            {o.tripNumber && o.deliveryTripId && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => onTrip?.({ id: o.deliveryTripId!, number: o.tripNumber! })}
                title="Show this trip’s orders"
              >
                {o.tripNumber}
              </button>
            )}
          </p>
        )}
        {o.notes && <p className="text-xs italic text-muted-foreground">{o.notes}</p>}
        {o.status === DeliveryOrderStatus.Returned && (
          <p className="text-xs text-warning-foreground dark:text-warning">Came back {formatDateTime(o.returnedAt)}{o.returnReason ? `: ${o.returnReason}` : ''}</p>
        )}
        {o.status === DeliveryOrderStatus.Cancelled && o.cancelReason && <p className="text-xs text-muted-foreground">Cancelled: {o.cancelReason}</p>}
        {o.saleId && <Link href={`/sales/${o.saleId}`} className="text-xs text-primary hover:underline">Sale {o.saleNumber}</Link>}
        {isOpenOrder(o) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {o.status === DeliveryOrderStatus.Pending && canDispatch && (
              <Button size="sm" onClick={() => onAction({ kind: 'dispatch', order: o })}><Bike />Dispatch</Button>
            )}
            {out && canDeliver && (
              <Button
                size="sm"
                variant="success"
                disabled={elsewhere}
                title={elsewhere ? `Switch to ${o.kraBranchId ?? ''} ${o.branchName ?? 'its branch'} to record it` : undefined}
                onClick={() => onAction({ kind: 'deliver', order: o })}
              >
                <CheckCircle2 />Complete sale
              </Button>
            )}
            {out && canReturn && (
              <Button size="sm" variant="outline" onClick={() => onAction({ kind: 'return', order: o })}><Undo2 />Returned</Button>
            )}
            {canCancel && <Button size="sm" variant="ghost" onClick={() => onAction({ kind: 'cancel', order: o })}><Ban />Cancel</Button>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AllOrders() {
  const key = useQueryKey();
  const [status, setStatus] = useState<DeliveryOrderStatus | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const params = { page, pageSize, status: status ?? undefined };
  const query = useQuery({ queryKey: key('delivery-orders', params), queryFn: () => deliveryOrdersApi.list(params), placeholderData: keepPreviousData });
  return (
    <div className="mt-3">
      <DataTable
        mode="server"
        columns={columns}
        data={query.data?.items}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        getRowId={(o) => o.deliveryOrderId}
        page={page}
        pageSize={pageSize}
        totalCount={query.data?.meta.totalCount ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        emptyTitle="No delivery orders"
        toolbar={<EnumSelect map={labels.deliveryOrderStatus} value={status} onChange={(v) => { setStatus(v); setPage(1); }} placeholder="All statuses" className="w-44" aria-label="Status" />}
        csv={{
          fileName: 'delivery-orders',
          columns: [
            { header: 'Order', value: (o) => o.orderNumber },
            { header: 'Taken', value: (o) => o.createdAt },
            { header: 'Customer', value: (o) => o.customerName },
            { header: 'Address', value: (o) => o.deliveryAddress },
            { header: 'Items', value: (o) => describeLines(o) },
            { header: 'Rider', value: (o) => o.riderName },
            { header: 'Trip', value: (o) => o.tripNumber },
            { header: 'Status', value: (o) => labels.deliveryOrderStatus[o.status] },
            { header: 'Expected payment', value: (o) => (o.expectedPaymentMethod != null ? labels.paymentMethod[o.expectedPaymentMethod] : '') },
            { header: 'Paid by', value: (o) => (o.paymentMethod !== null ? labels.paymentMethod[o.paymentMethod] : '') },
            { header: 'Sale', value: (o) => o.saleNumber },
            { header: 'Total', value: (o) => o.saleTotal ?? o.estimatedTotal },
            { header: 'Cancel reason', value: (o) => o.cancelReason },
            { header: 'Return reason', value: (o) => o.returnReason },
          ],
        }}
      />
    </div>
  );
}

export default function Page() {
  return <PermissionRoute permission="DeliveryOrders.View" module="deliveries"><Deliveries /></PermissionRoute>;
}
