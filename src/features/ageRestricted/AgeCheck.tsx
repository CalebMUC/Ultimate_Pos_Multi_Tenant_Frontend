'use client';

import { IdCard, ShieldAlert, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { AgeCheckMethod, labels } from '@/api/enums';
import { cn } from '@/lib/utils';
import { AGE_CHECK_METHODS, ageCheckHints, DEFAULT_MINIMUM_AGE } from './sellingHours';

/**
 * One button per way of checking the customer's age. Nothing is typed (there is no ID number to keep) and nothing is pre-selected.
 * `value` set: a radio group (the delivery form, where the choice is sent with the rest). Left out: each tap is the answer (the till).
 */
export function AgeCheckButtons({ value, onChoose, disabled, className }: {
  value?: AgeCheckMethod | null;
  onChoose(method: AgeCheckMethod): void;
  disabled?: boolean;
  className?: string;
}) {
  const radio = value !== undefined;
  return (
    <div role={radio ? 'radiogroup' : 'group'} aria-label="How the age was checked" className={cn('grid gap-2 sm:grid-cols-2', className)}>
      {AGE_CHECK_METHODS.map((m) => {
        const known = m === AgeCheckMethod.KnownCustomer;
        const Icon = known ? UserCheck : IdCard;
        const checked = radio && value === m;
        return (
          <button
            key={m}
            type="button"
            role={radio ? 'radio' : undefined}
            aria-checked={radio ? checked : undefined}
            disabled={disabled}
            onClick={() => onChoose(m)}
            className={cn(
              'flex min-h-14 items-center gap-3 rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors disabled:opacity-50',
              // "Regular" spans the row, apart from the IDs.
              known && 'sm:col-span-2',
              checked ? 'border-primary bg-primary/10 text-primary' : 'hover:border-primary hover:bg-accent',
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            <span>
              {labels.ageCheckMethod[m]}
              {ageCheckHints[m] && <span className="block text-xs font-normal text-muted-foreground">{ageCheckHints[m]}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * "Check the customer's age", before payment at the till. One tap records how and continues; Cancel goes back to the cart. The answer
 * is never remembered: the next sale asks again.
 */
export function AgeCheckDialog({ open, minimumAge, onChoose, onCancel }: {
  open: boolean;
  minimumAge: number | null | undefined;
  onChoose(method: AgeCheckMethod): void;
  onCancel(): void;
}) {
  const age = minimumAge ?? DEFAULT_MINIMUM_AGE;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldAlert className="size-5 text-warning" />Check the customer’s age</DialogTitle>
          <DialogDescription>
            <span className="block text-base font-semibold text-foreground">Is the customer {age} or over?</span>
            Ask for an ID if you are not sure.
          </DialogDescription>
        </DialogHeader>
        <AgeCheckButtons onChoose={onChoose} />
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
