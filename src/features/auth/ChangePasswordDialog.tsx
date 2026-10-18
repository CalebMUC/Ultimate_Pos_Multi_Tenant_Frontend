'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { FormAlert } from '@/components/shared/States';
import { Field } from '@/components/shared/Field';
import { Input } from '@/components/ui/primitives';
import { authApi } from '@/api/endpoints/identity';
import { applyApiErrors } from '@/lib/forms';

/** Same rule as the API: at least 8 characters, with a letter and a digit. */
export const passwordRule = z
  .string()
  .min(8, 'At least 8 characters.')
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/\d/, 'Include at least one digit.');

const schema = z
  .object({ currentPassword: z.string().min(1, 'Enter your current password.'), newPassword: passwordRule, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match.' });
type Values = z.infer<typeof schema>;

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });

  async function submit(values: Values) {
    setUnmatched([]);
    try {
      await authApi.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      toast.success('Password changed. Your other devices have been signed out.');
      form.reset();
      onOpenChange(false);
    } catch (e) {
      const rest = applyApiErrors(form, e);
      setUnmatched(rest.length || !Object.keys(form.formState.errors).length ? [((e as Error).message)] : rest);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) form.reset(); setUnmatched([]); onOpenChange(o); }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>This signs you out on your other devices.</DialogDescription>
        </DialogHeader>
        <form id="change-password" onSubmit={form.handleSubmit(submit)} className="space-y-3" noValidate>
          <FormAlert messages={unmatched} />
          <Field label="Current password" error={form.formState.errors.currentPassword}>
            <Input type="password" autoComplete="current-password" {...form.register('currentPassword')} />
          </Field>
          <Field label="New password" error={form.formState.errors.newPassword} hint="At least 8 characters, with a letter and a digit.">
            <Input type="password" autoComplete="new-password" {...form.register('newPassword')} />
          </Field>
          <Field label="Confirm new password" error={form.formState.errors.confirm}>
            <Input type="password" autoComplete="new-password" {...form.register('confirm')} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="change-password" loading={form.formState.isSubmitting}>Change password</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
