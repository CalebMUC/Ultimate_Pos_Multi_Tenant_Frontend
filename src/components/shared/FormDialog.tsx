'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { useForm, type DefaultValues, type FieldValues, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType, ZodTypeDef } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { normaliseError } from '@/api/errors';
import { applyApiErrors } from '@/lib/forms';
import { FormAlert } from './States';

interface FormDialogProps<T extends FieldValues> {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: ReactNode;
  // Input may differ from output (number inputs, transforms); the form works in output terms.
  schema: ZodType<T, ZodTypeDef, any>;
  /** Re-applied every time the dialog opens. */
  defaultValues: DefaultValues<T>;
  /** Throw to keep the dialog open; field errors from the API land beside their inputs. */
  onSubmit(values: T): Promise<unknown>;
  submitLabel?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children(form: UseFormReturn<T>): ReactNode;
}

/** A dialog holding one react-hook-form + zod form, with the API's errors mapped onto it. */
export function FormDialog<T extends FieldValues>(props: FormDialogProps<T>) {
  const formId = useId();
  const [messages, setMessages] = useState<string[]>([]);
  const form = useForm<T>({ resolver: zodResolver(props.schema as never), defaultValues: props.defaultValues });

  useEffect(() => {
    if (props.open) {
      form.reset(props.defaultValues);
      setMessages([]);
    }
    // Reset only when opening; defaultValues is usually a fresh object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  async function submit(values: T) {
    setMessages([]);
    try {
      await props.onSubmit(values);
      props.onOpenChange(false);
    } catch (e) {
      const unmatched = applyApiErrors(form, e);
      const apiError = normaliseError(e);
      setMessages(unmatched.length ? unmatched : apiError.hasFieldErrors() ? [] : [apiError.message]);
    }
  }

  const submitting = form.formState.isSubmitting;
  return (
    <Dialog open={props.open} onOpenChange={(o) => !submitting && props.onOpenChange(o)}>
      <DialogContent size={props.size ?? 'md'}>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          {props.description && <DialogDescription>{props.description}</DialogDescription>}
        </DialogHeader>
        <form id={formId} onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
          <FormAlert messages={messages} />
          {props.children(form)}
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" disabled={submitting} onClick={() => props.onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form={formId} loading={submitting}>{props.submitLabel ?? 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
