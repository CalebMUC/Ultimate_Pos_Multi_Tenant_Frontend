'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/primitives';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/Display';
import { labels } from '@/api/enums';
import { formatDate, formatDateOnly } from '@/lib/format';
import { ACCESS_STATUSES, accessStatusStyle, daysUntil } from '@/features/access/access';
import { AccessStatusBadge } from '@/features/access/AccessComponents';
import { daysLeftText } from '@/features/platform/ExpiringLicensesTable';
import { usePlatformBusinesses } from '@/features/platform/usePlatform';
import type { BusinessSummaryDto } from '@/api/dto/platform';

const columns: ColumnDef<BusinessSummaryDto, unknown>[] = [
  {
    header: 'Business',
    id: 'name',
    accessorFn: (s) => `${s.business.tradingName ?? ''} ${s.business.businessName} ${s.business.kraPin}`,
    cell: ({ row }) => (
      <span>
        <span className="font-medium">{row.original.business.tradingName || row.original.business.businessName}</span>
        <span className="block text-xs text-muted-foreground">{row.original.business.kraPin}{row.original.business.county ? ` · ${row.original.business.county}` : ''}</span>
      </span>
    ),
  },
  { header: 'Kind / type', id: 'kind', accessorFn: (s) => labels.businessKind[s.business.kind], cell: ({ row }) => <span className="text-xs">{labels.businessKind[row.original.business.kind]} · {labels.businessType[row.original.business.businessType]}</span> },
  { header: 'Access', id: 'status', accessorFn: (s) => s.access.status, cell: ({ row }) => <AccessStatusBadge status={row.original.access.status} /> },
  {
    header: 'Licence ends',
    id: 'ends',
    accessorFn: (s) => s.access.licenseEndsOn ?? '',
    cell: ({ row }) => row.original.access.licenseEndsOn
      ? <span className="whitespace-nowrap">{formatDateOnly(row.original.access.licenseEndsOn)} <span className="block text-xs text-muted-foreground">{daysLeftText(daysUntil(row.original.access.licenseEndsOn))}</span></span>
      : '—',
  },
  { header: 'Users', accessorKey: 'activeUsers', meta: { align: 'right' } },
  { header: 'Registered', accessorKey: 'createdAt', cell: ({ row }) => formatDate(row.original.createdAt) },
];

function Businesses() {
  const router = useRouter();
  const businesses = usePlatformBusinesses();
  const [status, setStatus] = useState('');
  const rows = businesses.data?.filter((b) => !status || b.access.status === status);
  return (
    <>
      <PageHeader
        title="Businesses"
        description="Every business on the platform, with its licence and access position."
        actions={<Can permission="Businesses.Register"><Button asChild><Link href="/platform/businesses/new"><Plus />Register business</Link></Button></Can>}
      />
      <DataTable
        columns={columns}
        data={rows}
        isLoading={businesses.isLoading}
        error={businesses.error}
        onRetry={() => businesses.refetch()}
        getRowId={(b) => b.business.businessId}
        onRowClick={(b) => router.push(`/platform/businesses/${b.business.businessId}`)}
        searchable
        searchPlaceholder="Name or KRA PIN…"
        emptyTitle={status ? 'No businesses with this status' : 'No businesses yet'}
        toolbar={
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} className="w-44" aria-label="Access status">
            <option value="">Any status</option>
            {ACCESS_STATUSES.map((s) => <option key={s} value={s}>{accessStatusStyle(s).label}</option>)}
          </NativeSelect>
        }
        csv={{
          fileName: 'businesses',
          columns: [
            { header: 'Business', value: (s) => s.business.businessName },
            { header: 'Trading name', value: (s) => s.business.tradingName },
            { header: 'KRA PIN', value: (s) => s.business.kraPin },
            { header: 'Kind', value: (s) => labels.businessKind[s.business.kind] },
            { header: 'Type', value: (s) => labels.businessType[s.business.businessType] },
            { header: 'Access', value: (s) => s.access.status },
            { header: 'Licence ends', value: (s) => s.access.licenseEndsOn },
            { header: 'Active users', value: (s) => s.activeUsers },
            { header: 'Registered', value: (s) => s.createdAt },
          ],
        }}
      />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Businesses.ViewAll"><Businesses /></PermissionRoute>;
}
