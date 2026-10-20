'use client';

import { useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, Bike, CheckCircle2, MapPin, Phone, Plus, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
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
import { useSession } from '@/stores/session';
import { ReasonDialog } from '@/features/platform/ReasonDialog';
import { describeLines, DispatchDialog, RecordDeliveryDialog } from '@/features/deliveries/DeliveryDialogs';
import type { DeliveryOrderDto } from '@/api/dto/deliveries';

type Action = { kind: 'dispatch' | 'deliver' | 'cancel'; order: DeliveryOrderDto } | null;

const columns: ColumnDef<DeliveryOrderDto, unknown>[] = [
  { header: 'Order', accessorKey: 'orderNumber', cell: ({ row }) => <span className="font-medium">{row.original.orderNumber}</span> },
  { header: 'Taken', accessorKey: 'createdAt', cell: ({ row }) => formatDateTime(row.original.createdAt) },
  { header: 'Customer', accessorKey: 'customerName' },
  { header: 'Items', id: 'items', cell: ({ row }) => <span className="text-xs">{describeLines(row.original)}</span> },
  { header: 'Rider', accessorKey: 'riderName', cell: ({ row }) => row.original.riderName ?? '—' },
  { header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusBadge kind="delivery" value={row.original.status} /> },
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
  const qc = useQueryClient();
  const close = (o: boolean) => !o && setAction(null);
  return (
    <>
      <PageHeader
        title="Deliveries"
        description="Orders delivered to customers. The stock is held for an order until it is delivered; then it becomes a sale."
        actions={
          <>
            <Button variant="outline" asChild><Link href="/deliveries/cash-up"><Wallet />Rider cash-up</Link></Button>
            <Can permission="DeliveryOrders.Create"><Button asChild><Link href="/deliveries/new"><Plus />New delivery order</Link></Button></Can>
          </>
        }
      />
      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="all">All orders</TabsTrigger>
        </TabsList>
        <TabsContent value="board"><Board onAction={setAction} /></TabsContent>
        <TabsContent value="all"><AllOrders /></TabsContent>
      </Tabs>
      {action?.kind === 'dispatch' && <DispatchDialog order={action.order} open onOpenChange={close} />}
      {action?.kind === 'deliver' && <RecordDeliveryDialog order={action.order} open onOpenChange={close} />}
      {action?.kind === 'cancel' && (
        <ReasonDialog
          open
          onOpenChange={close}
          title={`Cancel ${action.order.orderNumber}?`}
          description="Nothing has left stock, so the water and containers held for it become available again."
          confirmLabel="Cancel order"
          placeholder="e.g. customer not reachable"
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

/** Three columns: waiting, out with a rider, delivered today. Refreshes every 30 s so two counters see the same board. */
function Board({ onAction }: { onAction(a: Action): void }) {
  const key = useQueryKey();
  const today = todayIso();
  const list = (status: DeliveryOrderStatus, extra: object = {}) => ({
    queryKey: key('delivery-orders', { board: status, ...extra }),
    queryFn: () => deliveryOrdersApi.list({ status, pageSize: 100, ...extra }),
    refetchInterval: 30_000,
  });
  const pending = useQuery(list(DeliveryOrderStatus.Pending));
  const out = useQuery(list(DeliveryOrderStatus.OutForDelivery));
  // Filtered by the day an order was taken, so look back a week and keep those delivered today.
  const delivered = useQuery(list(DeliveryOrderStatus.Delivered, { from: addDays(today, -7), to: today }));
  const deliveredToday = delivered.data?.items.filter((o) => o.deliveredAt && toIsoDate(new Date(o.deliveredAt)) === today);

  return (
    <div className="mt-3 grid gap-4 lg:grid-cols-3">
      <Column title="Pending" icon={<MapPin />} query={pending} orders={pending.data?.items} onAction={onAction} empty="No orders waiting." />
      <Column title="Out for delivery" icon={<Bike />} query={out} orders={out.data?.items} onAction={onAction} empty="No one is out." />
      <Column title="Delivered today" icon={<CheckCircle2 />} query={delivered} orders={deliveredToday} onAction={onAction} empty="Nothing delivered yet today." />
    </div>
  );
}

function Column({ title, icon, query, orders, onAction, empty }: {
  title: string;
  icon: React.ReactNode;
  query: { isLoading: boolean; error: unknown; refetch(): unknown };
  orders: DeliveryOrderDto[] | undefined;
  onAction(a: Action): void;
  empty: string;
}) {
  return (
    <section className="space-y-2" aria-label={title}>
      <h2 className="flex items-center gap-2 font-semibold [&_svg]:size-4 [&_svg]:text-muted-foreground">
        {icon}{title}
        {orders && <Badge variant="secondary">{orders.length}</Badge>}
      </h2>
      {query.isLoading ? (
        <Skeleton className="h-32" />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !orders?.length ? (
        <EmptyState title={empty} className="rounded-lg border border-dashed py-8" />
      ) : (
        orders.map((o) => <OrderCard key={o.deliveryOrderId} order={o} onAction={onAction} />)
      )}
    </section>
  );
}

function OrderCard({ order: o, onAction }: { order: DeliveryOrderDto; onAction(a: Action): void }) {
  const activeBranchId = useSession((s) => s.activeBranchId);
  const branchCount = useSession((s) => s.branches.length);
  const canDispatch = usePermission('DeliveryOrders.Dispatch');
  const canDeliver = usePermission('DeliveryOrders.Deliver');
  const canCancel = usePermission('DeliveryOrders.Cancel');
  const elsewhere = o.branchId !== activeBranchId;
  const open = o.status === DeliveryOrderStatus.Pending || o.status === DeliveryOrderStatus.OutForDelivery;
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="min-w-0">
          <CardTitle className="truncate text-base">{o.customerName}</CardTitle>
          <p className="text-xs text-muted-foreground">{o.orderNumber} · {formatDateTime(o.createdAt)}{branchCount > 1 && o.kraBranchId ? ` · ${o.kraBranchId} ${o.branchName ?? ''}` : ''}</p>
        </div>
        <span className="text-right">
          <MoneyText value={o.saleTotal ?? o.estimatedTotal} className="font-semibold" />
          {o.paymentMethod !== null && (
            <span className="block text-xs text-muted-foreground">{o.paymentMethod === PaymentMethod.Credit ? 'On account' : labels.paymentMethod[o.paymentMethod]}</span>
          )}
        </span>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>{describeLines(o)}</p>
        <p className="flex items-start gap-1.5 text-muted-foreground"><MapPin className="mt-0.5 size-3.5 shrink-0" />{o.deliveryAddress}</p>
        {o.contactPhone && <p className="flex items-center gap-1.5 text-muted-foreground"><Phone className="size-3.5" /><a href={`tel:${o.contactPhone}`} className="hover:underline">{o.contactPhone}</a></p>}
        {o.riderName && <p className="flex items-center gap-1.5"><Bike className="size-3.5 text-muted-foreground" />{o.riderName}{o.dispatchedAt ? <span className="text-xs text-muted-foreground"> · out {formatDateTime(o.dispatchedAt)}</span> : null}</p>}
        {o.notes && <p className="text-xs italic text-muted-foreground">{o.notes}</p>}
        {o.saleId && <Link href={`/sales/${o.saleId}`} className="text-xs text-primary hover:underline">Sale {o.saleNumber}</Link>}
        {open && (
          <div className="flex flex-wrap gap-2 pt-1">
            {o.status === DeliveryOrderStatus.Pending && canDispatch && (
              <Button size="sm" onClick={() => onAction({ kind: 'dispatch', order: o })}><Bike />Dispatch</Button>
            )}
            {o.status === DeliveryOrderStatus.OutForDelivery && canDeliver && (
              <Button
                size="sm"
                variant="success"
                disabled={elsewhere}
                title={elsewhere ? `Switch to ${o.kraBranchId ?? ''} ${o.branchName ?? 'its branch'} to record it` : undefined}
                onClick={() => onAction({ kind: 'deliver', order: o })}
              >
                <CheckCircle2 />Record delivery
              </Button>
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
            { header: 'Status', value: (o) => labels.deliveryOrderStatus[o.status] },
            { header: 'Paid by', value: (o) => (o.paymentMethod !== null ? labels.paymentMethod[o.paymentMethod] : '') },
            { header: 'Sale', value: (o) => o.saleNumber },
            { header: 'Total', value: (o) => o.saleTotal ?? o.estimatedTotal },
            { header: 'Cancel reason', value: (o) => o.cancelReason },
          ],
        }}
      />
    </div>
  );
}

export default function Page() {
  return <PermissionRoute permission="DeliveryOrders.View" module="deliveries"><Deliveries /></PermissionRoute>;
}
