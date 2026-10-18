'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/overlays';
import { FormAlert } from './States';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  /** The dialog stays open, showing the error, if this throws. */
  onConfirm(): Promise<unknown> | unknown;
  children?: ReactNode;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirm', destructive, onConfirm, children }: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!pending) { setError(null); onOpenChange(next); } }}>
      <AlertDialogContent>
        <AlertDialogTitle className="text-lg font-semibold">{title}</AlertDialogTitle>
        {description && <AlertDialogDescription className="text-sm text-muted-foreground">{description}</AlertDialogDescription>}
        {children}
        <FormAlert error={error} />
        <div className="flex justify-end gap-2">
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant={destructive ? 'destructive' : 'default'} loading={pending} onClick={confirm}>
            {confirmLabel}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** State helper for a confirm dialog that acts on one item. */
export function useConfirm<T>() {
  const [target, setTarget] = useState<T | null>(null);
  return { target, open: target !== null, ask: setTarget, onOpenChange: (open: boolean) => !open && setTarget(null) };
}
