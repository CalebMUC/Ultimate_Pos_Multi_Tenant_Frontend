'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlarmClock, Ban, Building2, CalendarX2, CheckCircle2, Coins, Hourglass, Plus, Receipt, ShieldAlert, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/primitives';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { DateRangeFilter, presetRange } from '@/components/shared/DateRange';
import { MoneyText, PageHeader, StatCard } from '@/components/shared/Display';
import { ErrorState } from '@/components/shared/States';
import { platformApi } from '@/api/endpoints/platform';
import { labels, sectorLabel } from '@/api/enums';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateOnly, formatDateTime, formatMoney } from '@/lib/format';
import { daysUntil } from '@/features/access/access';
import { AccessStatusBadge } from '@/features/access/AccessComponents';
import { relativeTime } from '@/features/notifications/format';
import { daysLeftText, ExpiringLicensesTable } from '@/features/platform/ExpiringLicensesTable';
import { useExpiringLicenses, usePlatformBusinesses } from '@/features/platform/usePlatform';
import type { BusinessPerformanceDto, SectorPerformanceDto } from '@/api/dto/platform';

const sectorColumns: ColumnDef<SectorPerformanceDto, unknown>[] = [
  { header: 'Sector', id: 'sector', accessorFn: (r) => sectorLabel(r.sector), cell: ({ row }) => <span className="font-medium">{sectorLabel(row.original.sector)}</span> },
  { header: 'Businesses', accessorKey: 'businessCount', meta: { align: 'right' } },
  { header: 'Sales', accessorKey: 'saleCount', meta: { align: 'right' } },
  { header: 'Revenue', accessorKey: 'revenue', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.revenue} currency={false} className="font-medium" /> },
];

const columns: ColumnDef<BusinessPerformanceDto, unknown>[] = [
  { header: 'Business', accessorKey: 'businessName', cell: ({ row }) => <span className="font-medium">{row.original.businessName}</span> },
  { header: 'Sector', id: 'sector', accessorFn: (r) => sectorLabel(r.sector), cell: ({ row }) => <span className="whitespace-nowrap text-xs">{sectorLabel(row.original.sector)}</span> },
  { header: 'Kind / type', id: 'kind', accessorFn: (r) => `${labels.businessKind[r.kind]} ${labels.businessType[r.businessType]}`, cell: ({ row }) => <span className="whitespace-nowrap text-xs">{labels.businessKind[row.original.kind]} · {labels.businessType[row.original.businessType]}</span> },
  { header: 'Access', accessorKey: 'accessStatus', cell: ({ row }) => <AccessStatusBadge status={row.original.accessStatus} /> },
  {
    header: 'Licence ends',
    accessorKey: 'licenseEndsOn',
    cell: ({ row }) => row.original.licenseEndsOn
      ? <span className="whitespace-nowrap">{formatDateOnly(row.original.licenseEndsOn)} <span className="block text-xs text-muted-foreground">{daysLeftText(daysUntil(row.original.licenseEndsOn))}</span></span>
      : <span className="text-muted-foreground">—</span>,
  },
  { header: 'Users', accessorKey: 'activeUsers', meta: { align: 'right' } },
  { header: 'Branches', accessorKey: 'activeBranches', meta: { align: 'right' }, cell: ({ row }) => row.original.activeBranches ?? '—' },
  { header: 'Products', accessorKey: 'activeProducts', meta: { align: 'right' } },
  { header: 'Sales', accessorKey: 'saleCount', meta: { align: 'right' } },
  { header: 'Revenue', accessorKey: 'revenue', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.revenue} currency={false} className="font-medium" /> },
  { header: 'Avg sale', accessorKey: 'averageSale', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.averageSale} currency={false} /> },
  { header: 'Last sale', accessorKey: 'lastSaleAt', cell: ({ row }) => (row.original.lastSaleAt ? <span title={formatDateTime(row.original.lastSaleAt)} className="whitespace-nowrap">{relativeTime(row.original.lastSaleAt)}</span> : '—') },
  { header: 'Last sign-in', accessorKey: 'lastSignInAt', cell: ({ row }) => (row.original.lastSignInAt ? <span title={formatDateTime(row.original.lastSignInAt)} className="whitespace-nowrap">{relativeTime(row.original.lastSignInAt)}</span> : '—') },
];

function PlatformDashboard() {
  const router = useRouter();
  const key = useQueryKey();
  const [range, setRange] = useState(() => presetRange('30d'));
  const dashboard = useQuery({ queryKey: key('platform', { dashboard: range }), queryFn: () => platformApi.dashboard(range.from, range.to), placeholderData: keepPreviousData });
  const expiring = useExpiringLicenses(30);
  const businesses = usePlatformBusinesses();
  const d = dashboard.data;

  return (
    <>
      <PageHeader
        title="Platform"
        description={d ? `${formatDateOnly(d.from)} – ${formatDateOnly(d.to)}` : 'How every business is doing.'}
        actions={
          <>
            <DateRangeFilter value={range} onChange={setRange} />
            <Can permission="Businesses.Register"><Button asChild><Link href="/platform/businesses/new"><Plus />Register business</Link></Button></Can>
          </>
        }
      />
      {dashboard.error ? (
        <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
      ) : !d ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-[88px]" />)}</div>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Businesses" value={d.businessCount} icon={<Building2 />} />
            <StatCard label="Active" value={d.activeCount} icon={<CheckCircle2 />} tone="success" />
            <StatCard label="Expiring soon" value={d.expiringSoonCount} icon={<AlarmClock />} tone={d.expiringSoonCount ? 'warning' : 'default'} />
            <StatCard label="In grace" value={d.gracePeriodCount} icon={<Hourglass />} tone={d.gracePeriodCount ? 'warning' : 'default'} />
            <StatCard label="Expired / unlicensed" value={`${d.expiredCount} / ${d.unlicensedCount}`} icon={<CalendarX2 />} tone={d.expiredCount + d.unlicensedCount ? 'destructive' : 'default'} />
            <StatCard label="Suspended" value={d.suspendedCount} icon={<ShieldAlert />} tone={d.suspendedCount ? 'destructive' : 'default'} />
            <StatCard label="Closed" value={d.closedCount} icon={<Ban />} />
            <StatCard label="Sales" value={d.saleCount.toLocaleString('en-KE')} icon={<Receipt />} />
            <StatCard label="Revenue" value={formatMoney(d.revenue)} hint="All businesses, VAT incl., less returns" icon={<TrendingUp />} />
            <StatCard label="Licence income" value={formatMoney(d.licenseIncome)} icon={<Coins />} />
          </section>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Needs attention</CardTitle>
              <Button variant="link" asChild><Link href="/platform/licenses">All licences</Link></Button>
            </CardHeader>
            <CardContent>
              <ExpiringLicensesTable compact licenses={expiring.data} businesses={businesses.data} isLoading={expiring.isLoading} error={expiring.error} onRetry={() => expiring.refetch()} />
            </CardContent>
          </Card>

          {!!d.bySector?.length && (
            <section className="space-y-2">
              <h2 className="font-semibold">By sector</h2>
              <DataTable
                columns={sectorColumns}
                data={d.bySector}
                getRowId={(r) => String(r.sector)}
                emptyTitle="No businesses yet"
                csv={{
                  fileName: `platform-sectors-${d.from}-to-${d.to}`,
                  columns: [
                    { header: 'Sector', value: (r) => sectorLabel(r.sector) },
                    { header: 'Businesses', value: (r) => r.businessCount },
                    { header: 'Sales', value: (r) => r.saleCount },
                    { header: 'Revenue', value: (r) => r.revenue },
                  ],
                }}
              />
            </section>
          )}

          <section className="space-y-2">
            <h2 className="font-semibold">Businesses</h2>
            <DataTable
              columns={columns}
              data={d.businesses}
              getRowId={(b) => b.businessId}
              onRowClick={(b) => router.push(`/platform/businesses/${b.businessId}`)}
              searchable
              searchPlaceholder="Business name…"
              emptyTitle="No businesses yet"
              csv={{
                fileName: `platform-businesses-${d.from}-to-${d.to}`,
                columns: [
                  { header: 'Business', value: (b) => b.businessName },
                  { header: 'Sector', value: (b) => sectorLabel(b.sector) },
                  { header: 'Kind', value: (b) => labels.businessKind[b.kind] },
                  { header: 'Type', value: (b) => labels.businessType[b.businessType] },
                  { header: 'Access', value: (b) => b.accessStatus },
                  { header: 'Licence ends', value: (b) => b.licenseEndsOn },
                  { header: 'Active users', value: (b) => b.activeUsers },
                  { header: 'Open branches', value: (b) => b.activeBranches },
                  { header: 'Active products', value: (b) => b.activeProducts },
                  { header: 'Sales', value: (b) => b.saleCount },
                  { header: 'Revenue', value: (b) => b.revenue },
                  { header: 'Average sale', value: (b) => b.averageSale },
                  { header: 'Last sale', value: (b) => b.lastSaleAt },
                  { header: 'Last sign-in', value: (b) => b.lastSignInAt },
                  { header: 'Registered', value: (b) => b.createdAt },
                ],
              }}
            />
          </section>
        </div>
      )}
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Platform.Dashboard.View"><PlatformDashboard /></PermissionRoute>;
}
