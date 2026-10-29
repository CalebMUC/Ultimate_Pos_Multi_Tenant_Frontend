'use client';

import { z } from 'zod';
import { toast } from 'sonner';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { etimsApi } from '@/api/endpoints/etims';
import { ItemClassPicker } from './ItemClassPicker';

const schema = z.object({ itemClassCode: z.string().trim().min(1, 'Choose a classification.').max(20) });
type Values = z.infer<typeof schema>;

/** The KRA item classification a category's products are registered with, unless they have their own (Etims.Manage). */
export function CategoryClassDialog({ category, onOpenChange, onSaved }: {
  category: { categoryId: string; name: string } | null;
  onOpenChange(open: boolean): void;
  onSaved(categoryId: string): void;
}) {
  return (
    <FormDialog<Values>
      open={!!category}
      onOpenChange={onOpenChange}
      title={`KRA classification: ${category?.name ?? ''}`}
      description="Products in this category are registered with this classification unless they have their own. Products KRA already registered keep theirs."
      schema={schema}
      defaultValues={{ itemClassCode: '' }}
      onSubmit={async (v) => {
        await etimsApi.setCategoryClass(category!.categoryId, v.itemClassCode);
        onSaved(category!.categoryId);
        toast.success(`${category!.name}: KRA classification set to ${v.itemClassCode}`);
      }}
    >
      {(form) => (
        <Field label="Item classification" required error={form.formState.errors.itemClassCode}>
          <ItemClassPicker
            value={form.watch('itemClassCode') || null}
            onChange={(code) => form.setValue('itemClassCode', code ?? '', { shouldValidate: form.formState.isSubmitted })}
          />
        </Field>
      )}
    </FormDialog>
  );
}
