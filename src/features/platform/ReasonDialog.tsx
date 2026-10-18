'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { Label, Textarea } from '@/components/ui/primitives';
import { FormAlert } from '@/components/shared/States';
import { normaliseError } from '@/api/errors';

const MAX = 300;

/** A confirmation that needs a written reason (suspend, close, cancel a licence). The API stores the reason and shows it to users. */
export function ReasonDialog({ open, onOpenChange, title, description, confirmLabel, destructive = true, onConfirm, placeholder }: {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  /** Spell out the effect. */
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  placeholder?: string;
  onConfirm(reason: string): Promise<unknown>;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setTouched(false);
      setError(null);
    }
  }, [open]);

  const trimmed = reason.trim();
  const invalid = trimmed.length === 0 ? 'A reason is required.' : trimmed.length > MAX ? `At most ${MAX} characters.` : null;

  async function confirm() {
    setTouched(true);
    if (invalid) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm(trimmed);
      onOpenChange(false);
    } catch (e) {
      const apiError = normaliseError(e);
      setError(apiError.fieldErrors.reason ? new Error(apiError.fieldErrors.reason.join(' ')) : e);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild><div>{description}</div></DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason *</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={placeholder}
            aria-invalid={touched && !!invalid}
            maxLength={MAX + 50}
            autoFocus
          />
          <div className="flex justify-between text-xs">
            <span className="text-destructive">{touched && invalid}</span>
            <span className="text-muted-foreground">{trimmed.length}/{MAX}</span>
          </div>
        </div>
        <FormAlert error={error} />
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant={destructive ? 'destructive' : 'default'} loading={pending} onClick={confirm}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
