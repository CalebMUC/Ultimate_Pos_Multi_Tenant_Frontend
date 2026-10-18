'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, FolderTree, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/primitives';
import { ActivationButton } from '@/components/shared/ActivationButton';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { PageHeader, StatusBadge } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { CategorySelect } from '@/components/shared/Pickers';
import { categoriesApi } from '@/api/endpoints/catalog';
import { flattenCategories, useCategories, type FlatCategory } from '@/hooks/useLookups';
import { usePermissions } from '@/hooks/useSessionInfo';
import { requiredText } from '@/lib/schemas';

const schema = z.object({
  name: requiredText('Name', 100),
  code: z.string().trim().toUpperCase().min(1, 'Code is required.').max(20, 'At most 20 characters.').regex(/^[A-Z0-9_-]+$/, 'Letters, digits, - and _ only.'),
  parentCategoryId: z.string(),
});
type Values = z.infer<typeof schema>;

function Categories() {
  const qc = useQueryClient();
  const can = usePermissions();
  const categories = useCategories();
  const flat = flattenCategories(categories.data);
  const [editing, setEditing] = useState<FlatCategory | { parentCategoryId: string | null } | null>(null);
  const current = editing && 'categoryId' in editing ? editing : null;

  const columns: ColumnDef<FlatCategory, unknown>[] = [
    {
      header: 'Category',
      accessorKey: 'path',
      cell: ({ row }) => (
        <span className="flex items-center gap-1" style={{ paddingLeft: row.original.depth * 20 }}>
          {row.original.depth > 0 ? <ChevronRight className="size-3.5 text-muted-foreground" /> : <FolderTree className="size-4 text-primary" />}
          <span className={row.original.depth === 0 ? 'font-medium' : ''}>{row.original.name}</span>
        </span>
      ),
    },
    { header: 'Code', accessorKey: 'code', cell: ({ row }) => <code className="text-xs">{row.original.code}</code> },
    { header: 'Status', accessorKey: 'isActive', cell: ({ row }) => <StatusBadge kind="active" value={row.original.isActive} /> },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right' },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {can('Categories.Create') && <Button variant="ghost" size="sm" onClick={() => setEditing({ parentCategoryId: row.original.categoryId })}><Plus />Sub</Button>}
          {can('Categories.Update') && <Button variant="ghost" size="sm" onClick={() => setEditing(row.original)}><Pencil />Edit</Button>}
          {can('Categories.Deactivate') && (
            <ActivationButton isActive={row.original.isActive} name={row.original.name} activate={() => categoriesApi.activate(row.original.categoryId)} deactivate={() => categoriesApi.deactivate(row.original.categoryId)} invalidate={['categories']} />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Categories"
        description="Group products into categories and subcategories."
        actions={<Can permission="Categories.Create"><Button onClick={() => setEditing({ parentCategoryId: null })}><Plus />New category</Button></Can>}
      />
      {/* The tree order matters, so sorting is off; search still filters. */}
      <DataTable columns={columns.map((c) => ({ ...c, enableSorting: false }))} data={flat} isLoading={categories.isLoading} error={categories.error} onRetry={() => categories.refetch()} searchable pageSize={100} getRowId={(c) => c.categoryId} emptyTitle="No categories yet" />
      <FormDialog<Values>
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={current ? `Edit ${current.name}` : 'New category'}
        schema={schema}
        defaultValues={{ name: current?.name ?? '', code: current?.code ?? '', parentCategoryId: editing?.parentCategoryId ?? '' }}
        onSubmit={async (v) => {
          const parentCategoryId = v.parentCategoryId || null;
          if (current) await categoriesApi.update(current.categoryId, { name: v.name, parentCategoryId });
          else await categoriesApi.create({ name: v.name, code: v.code, parentCategoryId });
          await qc.invalidateQueries({ queryKey: ['categories'] });
          toast.success(current ? 'Category updated' : 'Category added');
        }}
      >
        {(form) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" required error={form.formState.errors.name}><Input autoFocus {...form.register('name')} /></Field>
            <Field label="Code" required error={form.formState.errors.code} hint={current ? 'The code can’t change once created.' : 'Used in SKUs and imports.'}>
              <Input className="uppercase read-only:bg-muted" readOnly={!!current} {...form.register('code')} />
            </Field>
            <Field label="Parent" error={form.formState.errors.parentCategoryId} className="sm:col-span-2">
              <CategorySelect placeholder="None (top level)" excludeId={current?.categoryId} {...form.register('parentCategoryId')} />
            </Field>
          </div>
        )}
      </FormDialog>
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Categories.View"><Categories /></PermissionRoute>;
}
