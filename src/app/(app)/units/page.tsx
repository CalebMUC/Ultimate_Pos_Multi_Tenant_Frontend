'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/primitives';
import { ActivationButton } from '@/components/shared/ActivationButton';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { PageHeader, StatusBadge } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { unitsApi } from '@/api/endpoints/catalog';
import { useUnits } from '@/hooks/useLookups';
import { usePermissions } from '@/hooks/useSessionInfo';
import { requiredText } from '@/lib/schemas';
import type { UnitOfMeasureDto } from '@/api/dto/catalog';

const schema = z.object({ name: requiredText('Name', 50), symbol: requiredText('Symbol', 10) });
type Values = z.infer<typeof schema>;

function Units() {
  const qc = useQueryClient();
  const can = usePermissions();
  const units = useUnits();
  const [editing, setEditing] = useState<UnitOfMeasureDto | 'new' | null>(null);
  const current = editing === 'new' ? null : editing;

  const columns: ColumnDef<UnitOfMeasureDto, unknown>[] = [
    { header: 'Name', accessorKey: 'name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { header: 'Symbol', accessorKey: 'symbol' },
    { header: 'Status', accessorKey: 'isActive', cell: ({ row }) => <StatusBadge kind="active" value={row.original.isActive} /> },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right' },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {can('Units.Update') && <Button variant="ghost" size="sm" onClick={() => setEditing(row.original)}><Pencil />Edit</Button>}
          {can('Units.Deactivate') && (
            <ActivationButton isActive={row.original.isActive} name={row.original.name} activate={() => unitsApi.activate(row.original.unitOfMeasureId)} deactivate={() => unitsApi.deactivate(row.original.unitOfMeasureId)} invalidate={['units']} />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Units of measure"
        description="Units products are stocked, bought and sold in (pcs, kg, L, box…)."
        actions={<Can permission="Units.Create"><Button onClick={() => setEditing('new')}><Plus />New unit</Button></Can>}
      />
      <DataTable columns={columns} data={units.data} isLoading={units.isLoading} error={units.error} onRetry={() => units.refetch()} searchable getRowId={(u) => u.unitOfMeasureId} emptyTitle="No units yet" />
      <FormDialog<Values>
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={current ? `Edit ${current.name}` : 'New unit'}
        schema={schema}
        size="sm"
        defaultValues={{ name: current?.name ?? '', symbol: current?.symbol ?? '' }}
        onSubmit={async (v) => {
          if (current) await unitsApi.update(current.unitOfMeasureId, v);
          else await unitsApi.create(v);
          await qc.invalidateQueries({ queryKey: ['units'] });
          toast.success(current ? 'Unit updated' : 'Unit added');
        }}
      >
        {(form) => (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" required error={form.formState.errors.name}><Input autoFocus placeholder="Kilogram" {...form.register('name')} /></Field>
            <Field label="Symbol" required error={form.formState.errors.symbol}><Input placeholder="kg" {...form.register('symbol')} /></Field>
          </div>
        )}
      </FormDialog>
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Units.View"><Units /></PermissionRoute>;
}
