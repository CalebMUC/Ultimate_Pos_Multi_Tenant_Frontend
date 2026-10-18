'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/overlays';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { PageHeader, StatusBadge } from '@/components/shared/Display';
import { formulasApi } from '@/api/endpoints/other';
import { useUnits, unitSymbol } from '@/hooks/useLookups';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDate, formatQty } from '@/lib/format';
import type { FormulaDto } from '@/api/dto/production';

function Formulas() {
  const router = useRouter();
  const key = useQueryKey();
  const units = useUnits();
  const [activeOnly, setActiveOnly] = useState(true);
  const query = useQuery({ queryKey: key('formulas', { activeOnly }), queryFn: () => formulasApi.list({ activeOnly }) });
  const columns: ColumnDef<FormulaDto, unknown>[] = [
    { header: 'Product', accessorKey: 'productName', cell: ({ row }) => <span className="font-medium">{row.original.productName}</span> },
    { header: 'Version', accessorKey: 'versionNumber', cell: ({ row }) => `v${row.original.versionNumber}` },
    { header: 'Makes', id: 'output', cell: ({ row }) => formatQty(row.original.outputQuantity, unitSymbol(units.data, row.original.outputUnitOfMeasureId)) },
    { header: 'Ingredients', id: 'ingredients', cell: ({ row }) => row.original.lines.length },
    { header: 'Created', accessorKey: 'createdAt', cell: ({ row }) => formatDate(row.original.createdAt) },
    { header: 'Status', accessorKey: 'isActive', cell: ({ row }) => <StatusBadge kind="active" value={row.original.isActive} /> },
  ];
  return (
    <>
      <PageHeader
        title="Formulas"
        description="Recipes: the ingredients and packaging that make a finished product. Saving a formula for a product that has one creates a new version."
        actions={<Can permission="Formulas.Create"><Button asChild><Link href="/production/formulas/new"><Plus />New formula</Link></Button></Can>}
      />
      <DataTable
        columns={columns}
        data={query.data}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        getRowId={(f) => f.formulaId}
        onRowClick={(f) => router.push(`/production/formulas/${f.formulaId}`)}
        searchable
        emptyTitle="No formulas yet"
        toolbar={<label className="flex items-center gap-2 text-sm"><Checkbox checked={activeOnly} onCheckedChange={(v) => setActiveOnly(v === true)} />Active only</label>}
      />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Formulas.View" requires="production"><Formulas /></PermissionRoute>;
}
