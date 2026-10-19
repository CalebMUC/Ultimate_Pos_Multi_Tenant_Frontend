'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/Display';
import { DateRangeFilter, presetRange } from '@/components/shared/DateRange';
import { salesApi } from '@/api/endpoints/sales';
import { labels } from '@/api/enums';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateOnly, formatDateTime, formatQty } from '@/lib/format';
import { Input } from '@/components/ui/primitives';
import { ReportLayout } from '@/features/reports/ReportLayout';
import type { PrescriptionRegisterEntryDto } from '@/api/dto/sales';
import { useBranchFilter } from '@/features/branches/branches';

const columns: ColumnDef<PrescriptionRegisterEntryDto, unknown>[] = [
  { header: 'Dispensed', accessorKey: 'dispensedAt', cell: ({ row }) => <span>{formatDateTime(row.original.dispensedAt)}<span className="block text-xs text-muted-foreground">{row.original.saleNumber}</span></span> },
  {
    header: 'Patient',
    id: 'patient',
    accessorFn: (e) => e.prescription.patientName,
    cell: ({ row }) => {
      const p = row.original.prescription;
      return <span><span className="font-medium">{p.patientName}</span><span className="block text-xs text-muted-foreground">{[p.patientAgeYears ? `${p.patientAgeYears} yrs` : null, p.patientPhoneNumber].filter(Boolean).join(' · ')}</span></span>;
    },
  },
  {
    header: 'Prescriber',
    id: 'prescriber',
    accessorFn: (e) => e.prescription.prescriberName,
    cell: ({ row }) => {
      const p = row.original.prescription;
      return <span>{p.prescriberName}<span className="block text-xs text-muted-foreground">{[p.prescriberRegistrationNumber, p.prescriberFacility].filter(Boolean).join(' · ')}</span></span>;
    },
  },
  { header: 'Rx', id: 'rx', cell: ({ row }) => <span>{row.original.prescription.prescriptionNumber ?? '—'}<span className="block text-xs text-muted-foreground">{formatDateOnly(row.original.prescription.prescriptionDate)}</span></span> },
  {
    header: 'Items',
    id: 'items',
    cell: ({ row }) => (
      <ul className="text-xs">
        {row.original.lines.map((l) => (
          <li key={l.productId}>{l.productName}{l.strength ? ` ${l.strength}` : ''} × {formatQty(l.quantity, l.unitSymbol)}{l.batchNumbers.length ? <span className="text-muted-foreground"> · {l.batchNumbers.join(', ')}</span> : null}</li>
        ))}
      </ul>
    ),
  },
  { header: 'By', accessorKey: 'dispensedByName', cell: ({ row }) => row.original.dispensedByName ?? '—' },
  { header: 'Sale', accessorKey: 'saleStatus', cell: ({ row }) => <StatusBadge kind="sale" value={row.original.saleStatus} /> },
];

function PrescriptionRegister() {
  const router = useRouter();
  const key = useQueryKey();
  const branch = useBranchFilter();
  const [range, setRange] = useState(() => presetRange('month'));
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim(), 300);
  const params = { ...range, search: debounced || undefined };
  const q = useQuery({ queryKey: key('sales', { prescriptions: params, branchId: branch.branchId }), queryFn: () => salesApi.prescriptions({ ...params, ...branch.scope }) });
  return (
    <ReportLayout
      branchFilter={branch}
      title="Prescription register"
      description="Every prescription-only sale, with patient, prescriber and batches dispensed."
      filters={<><DateRangeFilter value={range} onChange={setRange} /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Patient, prescriber or Rx no.…" className="w-64" /></>}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
    >
      <DataTable
        columns={columns}
        data={q.data}
        getRowId={(e) => e.saleId}
        onRowClick={(e) => router.push(`/sales/${e.saleId}`)}
        emptyTitle="No prescriptions dispensed in this period"
        csv={{
          fileName: `prescription-register-${range.from}-${range.to}`,
          columns: [
            { header: 'Dispensed', value: (e) => e.dispensedAt }, { header: 'Sale', value: (e) => e.saleNumber }, { header: 'Status', value: (e) => labels.saleStatus[e.saleStatus] },
            { header: 'Patient', value: (e) => e.prescription.patientName }, { header: 'Age', value: (e) => e.prescription.patientAgeYears }, { header: 'Patient phone', value: (e) => e.prescription.patientPhoneNumber },
            { header: 'Prescriber', value: (e) => e.prescription.prescriberName }, { header: 'Prescriber reg.', value: (e) => e.prescription.prescriberRegistrationNumber },
            { header: 'Facility', value: (e) => e.prescription.prescriberFacility }, { header: 'Rx no.', value: (e) => e.prescription.prescriptionNumber }, { header: 'Rx date', value: (e) => e.prescription.prescriptionDate },
            { header: 'Items', value: (e) => e.lines.map((l) => `${l.productName} x ${l.quantity} [${l.batchNumbers.join('/')}]`).join('; ') },
            { header: 'Dispensed by', value: (e) => e.dispensedByName },
          ],
        }}
      />
    </ReportLayout>
  );
}

export default function Page() {
  return <PermissionRoute permission="Prescriptions.View"><PrescriptionRegister /></PermissionRoute>;
}
