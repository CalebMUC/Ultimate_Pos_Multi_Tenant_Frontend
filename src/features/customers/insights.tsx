'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgePercent, Crown, Phone, Sparkles, TrendingDown, UserRound, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { Badge, Input, Label, Textarea, type BadgeVariant } from '@/components/ui/primitives';
import { FormAlert } from '@/components/shared/States';
import { customerInsightsApi } from '@/api/endpoints/customerInsights';
import { normaliseError } from '@/api/errors';
import { CustomerSegment, CustomerSuggestedAction, labels } from '@/api/enums';
import { useActiveBusiness, usePermission } from '@/hooks/useSessionInfo';
import { addDays, formatDateTime, todayIso } from '@/lib/format';
import type { Guid } from '@/api/dto/common';

/** Everything a discount changes: the customer, their insights, the dashboard panel and any price already previewed. */
export const DISCOUNT_RESOURCES = ['customers', 'customer-insights', 'dashboard', 'sale-preview'];

const segmentStyle: Record<CustomerSegment, { variant: BadgeVariant; icon: typeof Crown }> = {
  [CustomerSegment.Top]: { variant: 'warning', icon: Crown },
  [CustomerSegment.Regular]: { variant: 'success', icon: Users },
  [CustomerSegment.Slipping]: { variant: 'destructive', icon: TrendingDown },
  [CustomerSegment.New]: { variant: 'info', icon: Sparkles },
  [CustomerSegment.Occasional]: { variant: 'secondary', icon: UserRound },
};

/** The API's segment, with an icon so it never reads by colour alone. */
export function SegmentChip({ segment }: { segment: CustomerSegment }) {
  const { variant, icon: Icon } = segmentStyle[segment] ?? segmentStyle[CustomerSegment.Occasional];
  return <Badge variant={variant}><Icon className="size-3" />{labels.customerSegment[segment] ?? 'Occasional'}</Badge>;
}

/** What the segments mean, for help text next to them. */
export const SEGMENT_HELP: { segment: CustomerSegment; text: string }[] = [
  { segment: CustomerSegment.Top, text: 'In the top fifth by spend, and bought more than once.' },
  { segment: CustomerSegment.Regular, text: 'Comes back at least as often as the typical repeat customer.' },
  { segment: CustomerSegment.Slipping, text: 'Has stayed away more than twice as long as usual for them (and at least 7 days).' },
  { segment: CustomerSegment.New, text: 'First ever purchase in the last 30 days.' },
  { segment: CustomerSegment.Occasional, text: 'Everyone else.' },
];

export function SegmentHelp() {
  return (
    <dl className="grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[auto_1fr]">
      {SEGMENT_HELP.map((h) => (
        <div key={h.segment} className="contents">
          <dt><SegmentChip segment={h.segment} /></dt>
          <dd className="text-muted-foreground">{h.text}</dd>
        </div>
      ))}
      <p className="text-muted-foreground sm:col-span-2">Measured against this business’s own customers in the same period.</p>
    </dl>
  );
}

export const suggestionText: Record<CustomerSuggestedAction, string | null> = {
  [CustomerSuggestedAction.None]: null,
  [CustomerSuggestedAction.ConsiderDiscount]: 'Consider a loyalty discount',
  [CustomerSuggestedAction.WinBack]: 'Hasn’t been back: call them or make an offer',
  [CustomerSuggestedAction.ReviewDiscount]: 'Has a discount but isn’t buying regularly: review it',
};

/** The suggestion's action: give or change the discount, or a phone link to win them back. Nothing for None. */
export function SuggestionAction({ action, phoneNumber, hasDiscount, onDiscount, compact }: {
  action: CustomerSuggestedAction;
  phoneNumber: string | null;
  hasDiscount: boolean;
  onDiscount(): void;
  compact?: boolean;
}) {
  const canManage = usePermission('Customers.ManageDiscount');
  const size = compact ? 'sm' : 'default';
  if (action === CustomerSuggestedAction.WinBack) {
    return phoneNumber ? (
      <Button size={size} variant="outline" asChild onClick={(e) => e.stopPropagation()}>
        <a href={`tel:${phoneNumber}`}><Phone />Call</a>
      </Button>
    ) : null;
  }
  if ((action === CustomerSuggestedAction.ConsiderDiscount || action === CustomerSuggestedAction.ReviewDiscount) && canManage) {
    return (
      <Button size={size} variant="outline" onClick={(e) => { e.stopPropagation(); onDiscount(); }}>
        <BadgePercent />{hasDiscount || action === CustomerSuggestedAction.ReviewDiscount ? 'Change discount' : 'Give discount'}
      </Button>
    );
  }
  return null;
}

/** "5% off": the customer's standing discount. */
export function DiscountBadge({ percent, long }: { percent: number | null | undefined; long?: boolean }) {
  if (!percent) return null;
  return <Badge variant="violet" title="Standing customer discount"><BadgePercent className="size-3" />{percent}%{long ? ' loyalty discount' : ' off'}</Badge>;
}

/** The insights list's default window, as the API's: the last 90 days. */
export const last90Days = () => ({ from: addDays(todayIso(), -89), to: todayIso() });

/** "every 3.5 days" from the API's average gap. */
export function everyDays(days: number | null | undefined): string {
  if (days === null || days === undefined) return '—';
  return `every ${Number(days.toFixed(1))} day${days === 1 ? '' : 's'}`;
}

export function daysAgo(days: number): string {
  return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

export interface DiscountTarget {
  customerId: Guid;
  customerName: string;
  discountPercent: number | null | undefined;
  discountNote?: string | null;
  discountSetAt?: string | null;
  /** The business's cap, when the caller has it (insights carry it). Else the business profile's. */
  maxDiscountPercent?: number | null;
}

/**
 * Gives, changes or removes a customer's standing discount. The API enforces the cap and the note; this asks for the note first so
 * nothing is sent without one. Sales already made keep their prices.
 */
export function DiscountDialog({ target, open, onOpenChange }: { target: DiscountTarget | null; open: boolean; onOpenChange(o: boolean): void }) {
  const qc = useQueryClient();
  const { business } = useActiveBusiness();
  const [percent, setPercent] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState<'save' | 'remove' | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (open && target) {
      setPercent(target.discountPercent ? String(target.discountPercent) : '');
      setNote(target.discountNote ?? '');
      setError(null);
    }
  }, [open, target]);
  if (!target) return null;
  const cap = target.maxDiscountPercent !== undefined ? target.maxDiscountPercent : business?.maxDiscountPercent ?? null;
  const has = !!target.discountPercent;

  async function send(discountPercent: number | null, reason: string | null, kind: 'save' | 'remove') {
    setPending(kind);
    setError(null);
    try {
      await customerInsightsApi.setDiscount(target!.customerId, { discountPercent, note: reason });
      await Promise.all(DISCOUNT_RESOURCES.map((r) => qc.invalidateQueries({ queryKey: [r] })));
      toast.success(discountPercent ? `${target!.customerName} now gets ${discountPercent}% off` : `${target!.customerName}’s discount removed`);
      onOpenChange(false);
    } catch (e) {
      const apiError = normaliseError(e);
      const field = apiError.fieldErrors.discountPercent ?? apiError.fieldErrors.note;
      setError(field ? new Error(field.join(' ')) : apiError);
    } finally {
      setPending(null);
    }
  }

  function save() {
    setError(null);
    const value = Number(percent);
    if (percent.trim() === '' || Number.isNaN(value) || value < 0) return setError(new Error('Enter the discount as a percentage, e.g. 5.'));
    if (value === 0) return send(null, null, 'remove');
    if (!note.trim()) return setError(new Error('Say why: a note is required so the decision can be reviewed later.'));
    void send(value, note.trim(), 'save');
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{has ? 'Change discount' : 'Give discount'}: {target.customerName}</DialogTitle>
          <DialogDescription>Applied by the system to every later sale to this customer, at the counter and on deliveries. Sales already made keep their prices.</DialogDescription>
        </DialogHeader>
        <div className="rounded-md bg-muted p-3 text-sm">
          {has ? (
            <>
              <p>Now <span className="font-semibold">{target.discountPercent}% off</span>{target.discountSetAt ? ` since ${formatDateTime(target.discountSetAt)}` : ''}.</p>
              {target.discountNote && <p className="text-xs text-muted-foreground">“{target.discountNote}”</p>}
            </>
          ) : <p>No discount yet.</p>}
          <p className="mt-1 text-xs text-muted-foreground">{cap === null ? 'This business sets no maximum discount.' : `The business allows at most ${cap}%.`}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="discount-percent">Discount (%)</Label>
          <Input id="discount-percent" type="number" inputMode="decimal" min={0} max={cap ?? 99.99} step={0.5} autoFocus value={percent} onChange={(e) => setPercent(e.target.value)} className="w-32 tabular" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="discount-note">Why *</Label>
          <Textarea id="discount-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Buys 20L every 3 days since March" />
        </div>
        <FormAlert error={error} />
        <DialogFooter className="sm:justify-between">
          {has ? <Button variant="ghost" className="text-destructive" loading={pending === 'remove'} disabled={!!pending} onClick={() => send(null, null, 'remove')}>Remove discount</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="outline" disabled={!!pending} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button loading={pending === 'save'} disabled={!!pending} onClick={save}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
