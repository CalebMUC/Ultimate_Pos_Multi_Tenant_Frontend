'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/primitives';
import { ActivationButton } from '@/components/shared/ActivationButton';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { PageHeader, StatusBadge } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { expenseCategoriesApi } from '@/api/endpoints/other';
import { useExpenseCategories } from '@/hooks/useLookups';
import { usePermissions } from '@/hooks/useSessionInfo';
import { requiredText, text } from '@/lib/schemas';
import { emptyToNull } from '@/lib/utils';
import type { ExpenseCategoryDto } from '@/api/dto/expenses';

const schema = z.object({
  code: z.string().trim().toUpperCase().min(1, 'Code is required.').max(20, 'At most 20 characters.').regex(/^[A-Z0-9_-]+$/, 'Letters, digits, - and _ only.'),
  name: requiredText('Name', 100),
  description: text(500),
});
type Values = z.infer<typeof schema>;

function ExpenseCategories() {
  const qc = useQueryClient();
  const can = usePermissions();
  const categories = useExpenseCategories();
  const [editing, setEditing] = useState<ExpenseCategoryDto | 'new' | null>(null);
  const current = editing === 'new' ? null : editing;
  const columns: ColumnDef<ExpenseCategoryDto, unknown>[] = [
    { header: 'Code', accessorKey: 'code', cell: ({ row }) => <code className="text-xs">{row.original.code}</code> },
    { header: 'Name', accessorKey: 'name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { header: 'Description', accessorKey: 'description', cell: ({ row }) => row.original.description ?? '' },
    { header: 'Status', accessorKey: 'isActive', cell: ({ row }) => <StatusBadge kind="active" value={row.original.isActive} /> },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right' },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {can('ExpenseCategories.Update') && <Button variant="ghost" size="sm" onClick={() => setEditing(row.original)}><Pencil />Edit</Button>}
          {can('ExpenseCategories.Deactivate') && (
            <ActivationButton isActive={row.original.isActive} name={row.original.name} activate={() => expenseCategoriesApi.activate(row.original.expenseCategoryId)} deactivate={() => expenseCategoriesApi.deactivate(row.original.expenseCategoryId)} invalidate={['expense-categories']} />
          )}
        </div>
      ),
    },
  ];
  return (
    <>
      <PageHeader title="Expense categories" description="Group expenses for the profit and loss report." actions={<Can permission="ExpenseCategories.Create"><Button onClick={() => setEditing('new')}><Plus />New category</Button></Can>} />
      <DataTable columns={columns} data={categories.data} isLoading={categories.isLoading} error={categories.error} onRetry={() => categories.refetch()} searchable getRowId={(c) => c.expenseCategoryId} emptyTitle="No expense categories yet" />
      <FormDialog<Values>
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={current ? `Edit ${current.name}` : 'New expense category'}
        schema={schema}
        defaultValues={{ code: current?.code ?? '', name: current?.name ?? '', description: current?.description ?? '' }}
        onSubmit={async (v) => {
          if (current) await expenseCategoriesApi.update(current.expenseCategoryId, { name: v.name, description: emptyToNull(v.description) });
          else await expenseCategoriesApi.create({ code: v.code, name: v.name, description: emptyToNull(v.description) });
          await qc.invalidateQueries({ queryKey: ['expense-categories'] });
          toast.success(current ? 'Category updated' : 'Category added');
        }}
      >
        {(form) => (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Code" required error={form.formState.errors.code} hint={current ? 'Fixed once created.' : undefined}><Input className="uppercase read-only:bg-muted" readOnly={!!current} {...form.register('code')} /></Field>
            <Field label="Name" required error={form.formState.errors.name} className="sm:col-span-2"><Input autoFocus {...form.register('name')} /></Field>
            <Field label="Description" error={form.formState.errors.description} className="sm:col-span-3"><Textarea {...form.register('description')} /></Field>
          </div>
        )}
      </FormDialog>
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="ExpenseCategories.View"><ExpenseCategories /></PermissionRoute>;
}
