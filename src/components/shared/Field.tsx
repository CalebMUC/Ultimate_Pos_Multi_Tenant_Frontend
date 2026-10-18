'use client';

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import type { FieldError } from 'react-hook-form';
import { Label } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: ReactNode;
  error?: FieldError | { message?: string } | undefined;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactElement;
}

/** Label + control + error/hint. Wires id, aria-invalid and aria-describedby onto the child control. */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId();
  const describedBy = error?.message ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: (children.props as { id?: string }).id ?? id,
        'aria-invalid': !!error?.message || undefined,
        'aria-describedby': describedBy,
      })
    : children;
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={(children.props as { id?: string }).id ?? id}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {control}
      {error?.message ? (
        <p id={`${id}-error`} className="text-xs text-destructive">{error.message}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Inline error under a control that isn't wrapped in Field (table cells, custom controls). */
export function FieldMessage({ error }: { error?: { message?: string } }) {
  return error?.message ? <p className="mt-1 text-xs text-destructive">{error.message}</p> : null;
}
