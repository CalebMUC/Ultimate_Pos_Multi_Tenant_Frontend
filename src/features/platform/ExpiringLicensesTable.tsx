'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { labels } from '@/api/enums';
import { usePermission } from '@/hooks/useSessionInfo';
import { formatDateOnly } from '@/lib/format';
import { daysUntil } from '@/features/access/access';
import { AccessStatusBadge } from '@/features/access/AccessComponents';
import type { BusinessLicenseDto, BusinessSummaryDto } from '@/api/dto/platform';
import { IssueLicenseDialog, type LicenseTarget } from './IssueLicenseDialog';

interface Row { license: BusinessLicenseDto; business: BusinessSummaryDto | undefined; days: number | null }

export function daysLeftText(days: number | null): string {
  if (days === null) return '—';
  if (days < 0) return `ended ${-days} d ago`;
  if (days === 0) return 'ends today';
  return `${days} d left`;
}

/** Licences ending soon or in grace. Each row has Renew; clicking a row opens the business's Licences tab. */
export function ExpiringLicensesTable({ licenses, businesses, isLoading, error, onRetry, compact }: {
  licenses: BusinessLicenseDto[] | undefined;
  businesses: BusinessSummaryDto[] | undefined;
  isLoading?: boolean;
  error?: unknown;
  onRetry?(): void;
  compact?: boolean;
}) {
  const router = useRouter();
  const canManage = usePermission('Licenses.Manage');
  const [renewing, setRenewing] = useState<{ target: LicenseTarget; previous: BusinessLicenseDto } | null>(null);
  const byId = new Map(businesses?.map((b) => [b.business.businessId, b]) ?? []);
  const rows: Row[] | undefined = licenses
    ?.map((l) => ({ license: l, business: byId.get(l.businessId), days: daysUntil(l.endsOn) }))
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));

  const columns: ColumnDef<Row, unknown>[] = [
    {
      header: 'Business',
      id: 'business',
      accessorFn: (r) => r.business?.business.businessName ?? '',
      cell: ({ row }) => <span className="font-medium">{row.original.business ? (row.original.business.business.tradingName || row.original.business.business.businessName) : 'Business'}</span>,
    },
    { header: 'Status', id: 'status', accessorFn: (r) => r.business?.access.status ?? '', cell: ({ row }) => <AccessStatusBadge status={row.original.business?.access.status} /> },
    { header: 'Licence', id: 'licence', accessorFn: (r) => r.license.licenseNumber, cell: ({ row }) => `${row.original.license.licenseNumber} · ${labels.licenseKind[row.original.license.kind]} · ${row.original.license.planName}` },
    {
      header: 'Ends',
      id: 'ends',
      accessorFn: (r) => r.license.endsOn,
      cell: ({ row }) => <span className={(row.original.days ?? 0) < 0 ? 'text-destructive' : ''}>{formatDateOnly(row.original.license.endsOn)} <span className="text-xs text-muted-foreground">({daysLeftText(row.original.days)})</span></span>,
    },
    ...(canManage ? [{
      id: 'actions',
      header: '',
      meta: { align: 'right' as const },
      cell: ({ row }: { row: { original: Row } }) => (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            const b = row.original.business?.business;
            setRenewing({
              target: { businessId: row.original.license.businessId, businessName: b ? b.tradingName || b.businessName : 'Business', licenseEndsOn: b?.licenseEndsOn ?? row.original.license.endsOn },
              previous: row.original.license,
            });
          }}
        >
          <RefreshCw />Renew
        </Button>
      ),
    }] : []),
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        getRowId={(r) => r.license.businessLicenseId}
        onRowClick={(r) => router.push(`/platform/businesses/${r.license.businessId}?tab=licenses`)}
        rowClassName={(r) => ((r.days ?? 0) < 0 ? 'bg-destructive/5' : undefined)}
        pageSize={compact ? 10 : 25}
        emptyTitle="Nothing needs attention"
        emptyMessage="No licence ends in this window."
      />
      <IssueLicenseDialog open={!!renewing} onOpenChange={(o) => !o && setRenewing(null)} business={renewing?.target ?? null} previous={renewing?.previous} />
    </>
  );
}
