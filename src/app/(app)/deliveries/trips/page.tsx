'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { Badge, Card, CardContent, CardHeader, CardTitle, Input, Label, Skeleton } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { DateRangeFilter, presetRange, type DateRangeValue } from '@/components/shared/DateRange';
import { MoneyText, PageHeader, StatCard, StatusBadge } from '@/components/shared/Display';
import { ExpenseCategorySelect } from '@/components/shared/Pickers';
import { ErrorState } from '@/components/shared/States';
import { deliveryOrdersApi } from '@/api/endpoints/deliveries';
import { useExpenseCategories } from '@/hooks/useLookups';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { formatDateTime, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { RiderNameInput } from '@/features/deliveries/RiderNameInput';
import type { DeliveryTripDto, RiderFuelDto } from '@/api/dto/deliveries';

/** The fuel category every business is set up with. */
const FUEL_CATEGORY_CODE = 'TRN';
/** Remembered per browser: the API does not store it. */
const EXPECTED_FUEL_KEY = 'upos.expectedFuelPerTrip';

function readExpectedFuel(): string {
  try {
    return localStorage.getItem(EXPECTED_FUEL_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeExpectedFuel(value: string) {
  try {
    if (value) localStorage.setItem(EXPECTED_FUEL_KEY, value);
    else localStorage.removeItem(EXPECTED_FUEL_KEY);
  } catch {
    // Private mode or blocked storage: remembered until the page reloads.
  }
}

const fuelColumns: ColumnDef<RiderFuelDto, unknown>[] = [
  { header: 'Rider', accessorKey: 'riderName', cell: ({ row }) => <span className="font-medium">{row.original.riderName}</span> },
  { header: 'Trips', accessorKey: 'tripCount', meta: { align: 'right' } },
  { header: 'Orders carried', accessorKey: 'ordersCarried', meta: { align: 'right' } },
  { header: 'Delivered', accessorKey: 'deliveredCount', meta: { align: 'right' } },
  { header: 'Returned', accessorKey: 'returnedCount', meta: { align: 'right' } },
  {
    header: 'Wasted trips',
    accessorKey: 'wastedTrips',
    meta: { align: 'right' },
    cell: ({ row }) => <span className={row.original.wastedTrips ? 'font-semibold text-destructive' : ''} title="Came back with nothing delivered">{row.original.wastedTrips}</span>,
  },
  {
    header: 'Single-order trips',
    accessorKey: 'singleOrderTrips',
    meta: { align: 'right' },
    cell: ({ row }) => (
      <span title="Could have been combined">
        {row.original.singleOrderTrips}
        {row.original.singleOrderTrips > 0 && <span className="block text-xs text-muted-foreground">could have been combined</span>}
      </span>
    ),
  },
  { header: 'Fuel spent', accessorKey: 'fuelSpent', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.fuelSpent} className="font-medium" /> },
  {
    header: 'Fuel / trip',
    accessorKey: 'fuelPerTrip',
    meta: { align: 'right' },
    cell: ({ row }) => (
      <span>
        {row.original.fuelPerTrip === null ? '—' : <MoneyText value={row.original.fuelPerTrip} className={row.original.aboveAverage ? 'font-semibold text-warning-foreground dark:text-warning' : ''} />}
        {row.original.aboveAverage && <span className="block text-xs text-warning-foreground dark:text-warning">above average</span>}
      </span>
    ),
  },
  { header: 'Expected', accessorKey: 'expectedFuel', meta: { align: 'right' }, cell: ({ row }) => (row.original.expectedFuel === null ? '—' : <MoneyText value={row.original.expectedFuel} />) },
  {
    header: 'Variance',
    accessorKey: 'fuelVariance',
    meta: { align: 'right' },
    cell: ({ row }) => (row.original.fuelVariance === null ? '—' : <MoneyText value={row.original.fuelVariance} className={row.original.fuelVariance > 0 ? 'font-semibold text-destructive' : ''} />),
  },
  {
    header: '',
    id: 'flags',
    cell: ({ row }) => (!row.original.fuelAccountedFor ? <Badge variant="destructive">Fuel not accounted for by trips</Badge> : null),
  },
];

const tripColumns: ColumnDef<DeliveryTripDto, unknown>[] = [
  { header: 'Trip', accessorKey: 'tripNumber', cell: ({ row }) => <span className="font-medium">{row.original.tripNumber}</span> },
  { header: 'Out', accessorKey: 'dispatchedAt', cell: ({ row }) => formatDateTime(row.original.dispatchedAt) },
  { header: 'Rider', accessorKey: 'riderName' },
  { header: 'Orders', accessorKey: 'orderCount', meta: { align: 'right' } },
  { header: 'Delivered', accessorKey: 'deliveredCount', meta: { align: 'right' } },
  { header: 'Returned', accessorKey: 'returnedCount', meta: { align: 'right' } },
  { header: 'Still out', accessorKey: 'outCount', meta: { align: 'right' } },
  { header: 'Delivered value', accessorKey: 'deliveredTotal', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.deliveredTotal} /> },
  {
    header: 'Status',
    id: 'state',
    cell: ({ row }) =>
      row.original.isWasted ? <Badge variant="destructive">Came back with nothing delivered</Badge>
        : row.original.isBack ? <Badge variant="success">Back</Badge>
          : <Badge variant="info">Out</Badge>,
  },
];

function TripsAndFuel() {
  const canFuel = usePermission('Expenses.View');
  const [range, setRange] = useState<DateRangeValue>(() => presetRange('7d'));
  return (
    <>
      <PageHeader
        title="Trips & fuel"
        description="Each rider’s trips against the fuel paid for them (expenses tagged with the rider), to spot trips that could have been avoided or combined."
        actions={<Button variant="ghost" asChild><Link href="/deliveries"><ArrowLeft />Deliveries</Link></Button>}
      />
      <div className="mb-3"><DateRangeFilter value={range} onChange={setRange} /></div>
      <Tabs defaultValue={canFuel ? 'fuel' : 'trips'}>
        <TabsList>
          {canFuel && <TabsTrigger value="fuel">Fuel by rider</TabsTrigger>}
          <TabsTrigger value="trips">Trips</TabsTrigger>
        </TabsList>
        {canFuel && <TabsContent value="fuel" className="mt-3"><FuelReport range={range} /></TabsContent>}
        <TabsContent value="trips" className="mt-3"><Trips range={range} /></TabsContent>
      </Tabs>
    </>
  );
}

function FuelReport({ range }: { range: DateRangeValue }) {
  const key = useQueryKey();
  const categories = useExpenseCategories();
  // null until chosen: then the fuel category, found by its code.
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [expected, setExpected] = useState('');
  useEffect(() => setExpected(readExpectedFuel()), []);
  useEffect(() => {
    if (categoryId === null && categories.data) setCategoryId(categories.data.find((c) => c.code.toUpperCase() === FUEL_CATEGORY_CODE)?.expenseCategoryId ?? '');
  }, [categories.data, categoryId]);
  const expectedNum = useDebouncedValue(expected.trim() === '' || Number.isNaN(Number(expected)) || Number(expected) < 0 ? undefined : Number(expected), 400);
  // Wait for the default category while the list loads, so the first report is the fuel one.
  const ready = categoryId !== null || !categories.isLoading;
  const params = { ...range, expenseCategoryId: categoryId || undefined, expectedFuelPerTrip: expectedNum };
  const q = useQuery({ queryKey: key('delivery-orders', { fuel: params }), queryFn: () => deliveryOrdersApi.fuelReport(params), enabled: ready });
  const r = q.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="fuel-category">Expense category</Label>
          <ExpenseCategorySelect id="fuel-category" value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value)} placeholder="All categories" activeOnly={false} className="w-56" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expected-fuel">Expected fuel per trip (KES)</Label>
          <Input
            id="expected-fuel"
            type="number"
            inputMode="decimal"
            min={0}
            step="1"
            value={expected}
            onChange={(e) => {
              setExpected(e.target.value);
              writeExpectedFuel(e.target.value);
            }}
            className="w-44 tabular"
            placeholder="Optional"
          />
        </div>
      </div>
      {q.isLoading || !ready ? (
        <Skeleton className="h-48" />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : r && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Trips" value={r.tripCount} hint={r.wastedTrips ? `${r.wastedTrips} came back with nothing delivered` : undefined} tone={r.wastedTrips ? 'destructive' : 'default'} />
            <StatCard label="Fuel spent" value={formatMoney(r.fuelSpent)} />
            <StatCard label="Average per trip" value={r.averageFuelPerTrip === null ? '—' : formatMoney(r.averageFuelPerTrip)} />
            <StatCard
              label="Against expected"
              value={r.fuelVariance === null ? '—' : `${r.fuelVariance > 0 ? '+' : ''}${formatMoney(r.fuelVariance)}`}
              hint={r.expectedFuel === null ? 'Enter an expected cost per trip' : `Expected ${formatMoney(r.expectedFuel)}`}
              tone={r.fuelVariance !== null && r.fuelVariance > 0 ? 'destructive' : 'default'}
            />
          </div>
          <DataTable
            columns={fuelColumns}
            data={r.byRider}
            getRowId={(x) => x.riderName}
            rowClassName={(x) => (!x.fuelAccountedFor ? 'bg-destructive/5' : undefined)}
            emptyTitle="No trips or rider fuel in this period"
            emptyMessage="Only expenses tagged with a rider count as that rider’s fuel."
            csv={{
              fileName: `rider-fuel-${range.from}-${range.to}`,
              columns: [
                { header: 'Rider', value: (x) => x.riderName },
                { header: 'Trips', value: (x) => x.tripCount },
                { header: 'Orders carried', value: (x) => x.ordersCarried },
                { header: 'Delivered', value: (x) => x.deliveredCount },
                { header: 'Returned', value: (x) => x.returnedCount },
                { header: 'Wasted trips', value: (x) => x.wastedTrips },
                { header: 'Single-order trips', value: (x) => x.singleOrderTrips },
                { header: 'Fuel spent', value: (x) => x.fuelSpent },
                { header: 'Fuel per trip', value: (x) => x.fuelPerTrip },
                { header: 'Expected', value: (x) => x.expectedFuel },
                { header: 'Variance', value: (x) => x.fuelVariance },
                { header: 'Accounted for', value: (x) => (x.fuelAccountedFor ? 'Yes' : 'No') },
                { header: 'Above average', value: (x) => (x.aboveAverage ? 'Yes' : 'No') },
              ],
            }}
          />
          <p className="text-xs text-muted-foreground">Only expenses tagged with a rider count as that rider’s fuel. Tag them on the expense form.</p>
        </>
      )}
    </div>
  );
}

function Trips({ range }: { range: DateRangeValue }) {
  const key = useQueryKey();
  const [rider, setRider] = useState('');
  const riderName = useDebouncedValue(rider.trim(), 300);
  const params = { ...range, riderName: riderName || undefined };
  const q = useQuery({ queryKey: key('delivery-orders', { trips: params }), queryFn: () => deliveryOrdersApi.trips(params) });
  return (
    <DataTable
      columns={tripColumns}
      data={q.data}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
      getRowId={(t) => t.deliveryTripId}
      rowClassName={(t) => (t.isWasted ? 'bg-destructive/5' : undefined)}
      renderExpanded={(t) => (
        <Card className="m-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t.tripNumber} · {t.riderName}</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {t.orders.map((o) => (
                <li key={o.deliveryOrderId} className="flex items-center gap-3 py-1.5">
                  <Link href={`/deliveries?orderId=${o.deliveryOrderId}`} className="font-medium text-primary hover:underline">{o.orderNumber}</Link>
                  <span className="min-w-0 flex-1 truncate">{o.customerName} <span className="text-xs text-muted-foreground">· {o.deliveryAddress}</span></span>
                  <StatusBadge kind="delivery" value={o.status} />
                  <MoneyText value={o.saleTotal ?? o.estimatedTotal} className={cn(o.saleTotal === null && 'text-muted-foreground')} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      emptyTitle="No trips in this period"
      toolbar={<div className="w-48"><RiderNameInput value={rider} onChange={setRider} placeholder="All riders" aria-label="Rider" /></div>}
      csv={{
        fileName: `delivery-trips-${range.from}-${range.to}`,
        columns: [
          { header: 'Trip', value: (t) => t.tripNumber },
          { header: 'Out', value: (t) => t.dispatchedAt },
          { header: 'Rider', value: (t) => t.riderName },
          { header: 'Orders', value: (t) => t.orderCount },
          { header: 'Delivered', value: (t) => t.deliveredCount },
          { header: 'Returned', value: (t) => t.returnedCount },
          { header: 'Still out', value: (t) => t.outCount },
          { header: 'Delivered value', value: (t) => t.deliveredTotal },
          { header: 'Back', value: (t) => (t.isBack ? 'Yes' : 'No') },
          { header: 'Wasted', value: (t) => (t.isWasted ? 'Yes' : 'No') },
          { header: 'Orders list', value: (t) => t.orders.map((o) => o.orderNumber).join(' ') },
        ],
      }}
    />
  );
}

export default function Page() {
  return <PermissionRoute permission="DeliveryOrders.View" module="deliveries"><TripsAndFuel /></PermissionRoute>;
}
