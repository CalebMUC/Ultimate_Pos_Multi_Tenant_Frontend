'use client';

import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle, Input, Label, Textarea } from '@/components/ui/primitives';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import type { BackdateMode } from '@/stores/cart';

// Entering past sales after a power failure. The API (SalesService.ResolveSaleTime) is the rule: up to 3 calendar days back in East
// Africa Time, never in the future, with a reason, by someone with Sales.Backdate. These checks only stop the manager early.

export const MAX_BACKDATE_DAYS = 3;
export const MAX_BACKDATE_REASON = 200;
export const DEFAULT_BACKDATE_REASON = 'Power failure, entered from the paper book';

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The East Africa Time wall clock at `date`, "yyyy-MM-ddTHH:mm", whatever the browser's own time zone. */
export function eatWallClock(date: Date): string {
  return new Date(date.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 16);
}

/** The range a sale can be dated in now: from midnight three calendar days ago to the current minute (East Africa Time). */
export function backdateBounds(now = new Date()): { min: string; max: string } {
  const max = eatWallClock(now);
  const earliest = new Date(`${max.slice(0, 10)}T00:00:00Z`);
  earliest.setUTCDate(earliest.getUTCDate() - MAX_BACKDATE_DAYS);
  return { min: `${earliest.toISOString().slice(0, 10)}T00:00`, max };
}

/** The time the dialog starts at: today, at the start of the current hour. */
export function defaultSoldAt(now = new Date()): string {
  return `${eatWallClock(now).slice(0, 13)}:00`;
}

/** What the API is sent: the wall clock with its offset, "2026-11-05T14:30:00+03:00". */
export function toSoldAt(wallClock: string): string {
  return `${wallClock}:00+03:00`;
}

/** "Wed 5 Nov 14:30". */
export function formatBackdate(wallClock: string): string {
  const d = new Date(`${wallClock}:00Z`);
  if (Number.isNaN(d.getTime())) return wallClock;
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${wallClock.slice(11, 16)}`;
}

export type BackdateErrors = Partial<Record<keyof BackdateMode, string>>;

export function validateBackdate(mode: BackdateMode, now = new Date()): BackdateErrors {
  const errors: BackdateErrors = {};
  const { min, max } = backdateBounds(now);
  if (!WALL_CLOCK.test(mode.soldAt)) errors.soldAt = 'Pick the date and time the sale was made.';
  else if (mode.soldAt < min) errors.soldAt = `A sale can be backdated up to ${MAX_BACKDATE_DAYS} days, to ${formatBackdate(min)} at the earliest.`;
  else if (mode.soldAt > max) errors.soldAt = 'The time cannot be in the future.';
  // The API treats a time within a minute of now as a normal sale.
  else if (new Date(toSoldAt(mode.soldAt)).getTime() > now.getTime() - 60_000) errors.soldAt = 'Pick a time in the past: a sale made just now is entered as a normal sale.';
  const reason = mode.reason.trim();
  if (!reason) errors.reason = 'Say why the sale is entered late, e.g. “Power failure, entered from the paper book”.';
  else if (reason.length > MAX_BACKDATE_REASON) errors.reason = `Keep the reason to ${MAX_BACKDATE_REASON} characters.`;
  return errors;
}

/** Opens the mode, or changes its time (each slip in the paper book has its own) without leaving it. */
export function BackdateDialog({ open, current, onSave, onCancel }: {
  open: boolean;
  /** The mode already on, when changing it. */
  current: BackdateMode | null;
  onSave(mode: BackdateMode): void;
  onCancel(): void;
}) {
  const [soldAt, setSoldAt] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<BackdateErrors>({});
  const bounds = backdateBounds();

  useEffect(() => {
    if (!open) return;
    setSoldAt(current?.soldAt ?? defaultSoldAt());
    setReason(current?.reason ?? DEFAULT_BACKDATE_REASON);
    setErrors({});
  }, [open, current]);

  function save() {
    const mode = { soldAt, reason: reason.trim() };
    const found = validateBackdate(mode);
    setErrors(found);
    if (Object.keys(found).length === 0) onSave(mode);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History className="size-5" />{current ? 'Change the sale time' : 'Enter past sales'}</DialogTitle>
          <DialogDescription>
            For sales written down while the till was off, up to {MAX_BACKDATE_DAYS} days ago. Each one is dated when it was made, and stock is
            checked as it stood then.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="backdate-sold-at">When the sale was made</Label>
            <Input
              id="backdate-sold-at"
              type="datetime-local"
              min={bounds.min}
              max={bounds.max}
              value={soldAt}
              onChange={(e) => setSoldAt(e.target.value)}
              aria-invalid={!!errors.soldAt}
            />
            {errors.soldAt && <p className="text-xs text-destructive">{errors.soldAt}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="backdate-reason">Reason</Label>
            <Textarea
              id="backdate-reason"
              value={reason}
              maxLength={MAX_BACKDATE_REASON}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[60px]"
              aria-invalid={!!errors.reason}
            />
            {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
          </div>
          <p className="text-xs text-muted-foreground">
            Cash sales go into the drawer that was open then: enter them before that drawer is counted and closed. STK push is not available,
            since the customer paid at the time.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={save}>{current ? 'Change time' : 'Start entering'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Across the till while the mode is on: no sale is mistaken for one happening now. */
export function BackdateBanner({ mode, onChange, onDone }: { mode: BackdateMode; onChange(): void; onDone(): void }) {
  return (
    <Alert variant="warning" role="status" aria-label="Entering past sales">
      <History />
      <AlertTitle>Entering past sales: {formatBackdate(mode.soldAt)}</AlertTitle>
      <AlertDescription>
        <span className="block">{mode.reason.replace(/[.\s]+$/, '')}. Every sale is dated then, with the stock there was at that time.</span>
        <span className="mt-2 flex gap-2">
          <Button size="sm" variant="outline" onClick={onChange}>Change time</Button>
          <Button size="sm" variant="outline" onClick={onDone}>Done</Button>
        </span>
      </AlertDescription>
    </Alert>
  );
}
