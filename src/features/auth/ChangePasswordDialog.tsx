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
import { normaliseError } from '@/api/errors';
import { applyApiErrors } from '@/lib/forms';
import { changePassword } from './sessionActions';

/** Same rule as the API: at least 8 characters, with a letter and a digit. */
export const passwordRule = z
  .string()
  .min(8, 'At least 8 characters.')
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/\d/, 'Include at least one digit.');

const schema = z
  .object({ currentPassword: z.string().min(1, 'Enter your current password.'), newPassword: passwordRule, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match.' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Choose a password different from the current one.' });
type Values = z.infer<typeof schema>;

/** The change-password form, shared by the dialog and the blocking /change-password page. */
export function useChangePasswordForm(onDone: () => void) {
  const [messages, setMessages] = useState<string[]>([]);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });
  const submit = form.handleSubmit(async (values) => {
    setMessages([]);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      form.reset();
      onDone();
    } catch (e) {
      const rest = applyApiErrors(form, e);
      const apiError = normaliseError(e);
      setMessages(rest.length ? rest : apiError.hasFieldErrors() ? [] : [apiError.message]);
    }
  });
  const reset = () => { form.reset(); setMessages([]); };
  return { form, submit, messages, reset };
}

export function ChangePasswordFields({ form, messages, autoFocus }: { form: ReturnType<typeof useChangePasswordForm>['form']; messages: string[]; autoFocus?: boolean }) {
  const e = form.formState.errors;
  return (
    <div className="space-y-3">
      <FormAlert messages={messages} />
      <Field label="Current password" error={e.currentPassword} hint="If an administrator set it for you, use that one.">
        <Input type="password" autoComplete="current-password" autoFocus={autoFocus} {...form.register('currentPassword')} />
      </Field>
      <Field label="New password" error={e.newPassword} hint="At least 8 characters, with a letter and a digit.">
        <Input type="password" autoComplete="new-password" {...form.register('newPassword')} />
      </Field>
      <Field label="Confirm new password" error={e.confirm}>
        <Input type="password" autoComplete="new-password" {...form.register('confirm')} />
      </Field>
    </div>
  );
}

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const { form, submit, messages, reset } = useChangePasswordForm(() => {
    toast.success('Password changed. Your other devices have been signed out.');
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>This signs you out on your other devices.</DialogDescription>
        </DialogHeader>
        <form id="change-password" onSubmit={submit} noValidate>
          <ChangePasswordFields form={form} messages={messages} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="change-password" loading={form.formState.isSubmitting}>Change password</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
