'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Calculator, Lock, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { Alert, AlertDescription, AlertTitle, Badge, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea } from '@/components/ui/primitives';
import { Can } from '@/components/shared/Can';
import { DetailList, MoneyText } from '@/components/shared/Display';
import { EmptyState, FormAlert } from '@/components/shared/States';
import { cashSessionsApi } from '@/api/endpoints/cashSessions';
import { normaliseError } from '@/api/errors';
import { CashMovementType, CashSessionStatus, labels } from '@/api/enums';
import { usePermission } from '@/hooks/useSessionInfo';
import { formatDateTime, formatMoney } from '@/lib/format';
import { cn, emptyToNull } from '@/lib/utils';
import type { CashSessionDto } from '@/api/dto/cashSessions';

/**
 * A session changed: the response is the session as it now stands, so show it at once and refresh the lists behind it. refetch false
 * keeps it on screen for now (a just-closed day, whose result is still being read, would otherwise be replaced by "not opened").
 */
function useSessionUpdated() {
  const qc = useQueryClient();
  return (session?: CashSessionDto, refetch = true) => {
    if (session) {
      qc.setQueriesData<CashSessionDto>(
        { queryKey: ['cash-sessions'], predicate: (q) => (q.state.data as CashSessionDto | null | undefined)?.cashSessionId === session.cashSessionId },
        session,
      );
    }
    if (refetch) void qc.invalidateQueries({ queryKey: ['cash-sessions'] });
  };
}

/** Amounts are typed in KES with at most two decimals; the API refuses anything else. */
function parseAmount(text: string): number | null {
  if (text.trim() === '') return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 && Math.round(n * 100) === n * 100 ? n : null;
}

/** Red short, amber over, green exact. */
export function varianceTone(variance: number | null | undefined): string {
  if (variance === null || variance === undefined) return '';
  return variance < 0 ? 'text-destructive' : variance > 0 ? 'text-warning-foreground dark:text-warning' : 'text-success';
}

export function VarianceText({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn('tabular whitespace-nowrap font-semibold', varianceTone(value), className)}>
      {value > 0 ? '+' : ''}{formatMoney(value)}{value < 0 ? ' short' : value > 0 ? ' over' : ''}
    </span>
  );
}

/** No open session at this branch: a manager opens the day with the float for change. */
export function OpenDayCard() {
  const updated = useSessionUpdated();
  const [float, setFloat] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function open() {
    setError(null);
    const amount = parseAmount(float);
    if (amount === null) return setError(new Error('Enter the float in KES (0 or more, at most 2 decimals).'));
    setPending(true);
    try {
      const session = await cashSessionsApi.open({ openingFloat: amount, notes: emptyToNull(notes) });
      updated(session);
      toast.success(`${session.sessionNumber} opened with a float of ${formatMoney(session.openingFloat)}`);
    } catch (e) {
      setError(e);
      // Someone else opened it a moment ago: show theirs.
      if (normaliseError(e).status === 400) updated();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="max-w-md">
      <CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="size-5" />Open the day</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Count the cash put in the drawer for giving change. The end-of-day count is checked against it.</p>
        <div className="space-y-1.5">
          <Label htmlFor="opening-float">Float (KES)</Label>
          <Input id="opening-float" type="number" inputMode="decimal" min={0} step="0.01" autoFocus value={float} onChange={(e) => setFloat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && open()} className="h-12 text-xl tabular" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="opening-notes">Notes</Label>
          <Input id="opening-notes" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </div>
        <FormAlert error={error} />
        <Button className="w-full" size="lg" loading={pending} onClick={open}>Open the day</Button>
      </CardContent>
    </Card>
  );
}

/** The day as a statement, every figure the API's. The expected figure is never added up here. */
export function BreakdownStatement({ session }: { session: CashSessionDto }) {
  const b = session.breakdown;
  const rows: { label: string; value: number; sign: '+' | '−' | ''; hint?: string }[] = [
    { label: 'Opening float', value: b.openingFloat, sign: '' },
    { label: 'Cash sales', value: b.cashSales, sign: '+', hint: `${b.cashSaleCount} sale(s), rider deliveries included` },
    { label: 'Customer payments', value: b.customerPayments, sign: '+' },
    { label: 'Pay-ins', value: b.payIns, sign: '+' },
    { label: 'Cash refunds', value: b.cashRefunds, sign: '−' },
    { label: 'Cash expenses', value: b.cashExpenses, sign: '−' },
    { label: 'Supplier payments', value: b.supplierPayments, sign: '−' },
    { label: 'Pay-outs', value: b.payOuts, sign: '−' },
  ];
  return (
    <dl className="space-y-1 text-sm" aria-label="Cash statement">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-3">
          <dt>
            <span className="inline-block w-4 text-muted-foreground">{r.sign}</span>{r.label}
            {r.hint && <span className="ml-1 text-xs text-muted-foreground">({r.hint})</span>}
          </dt>
          <dd className="tabular">{formatMoney(r.value)}</dd>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-3 border-t pt-2 text-base font-semibold">
        <dt><span className="inline-block w-4">=</span>Expected in drawer</dt>
        <dd className="text-xl tabular" data-testid="expected-cash">{formatMoney(b.expectedCash)}</dd>
      </div>
    </dl>
  );
}

const SUGGESTED_REASONS = {
  [CashMovementType.PayIn]: ['Float top-up', 'Rider returned change'],
  [CashMovementType.PayOut]: ['Banked', 'Change for rider '],
} as const;

export function MovementDialog({ session, type, open, onOpenChange }: { session: CashSessionDto; type: CashMovementType; open: boolean; onOpenChange(o: boolean): void }) {
  const updated = useSessionUpdated();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (open) {
      setAmount('');
      setReason('');
      setError(null);
    }
  }, [open]);

  async function submit() {
    setError(null);
    const value = parseAmount(amount);
    if (value === null || value === 0) return setError(new Error('Enter an amount above zero (at most 2 decimals).'));
    if (!reason.trim()) return setError(new Error('What was the cash for? A reason is required.'));
    setPending(true);
    try {
      const next = await cashSessionsApi.recordMovement(session.cashSessionId, { movementType: type, amount: value, reason: reason.trim() });
      updated(next);
      toast.success(`${labels.cashMovementType[type]} of ${formatMoney(value)} recorded`);
      onOpenChange(false);
    } catch (e) {
      setError(e);
      // Closed meanwhile: reload it.
      if (normaliseError(e).status === 400) updated();
    } finally {
      setPending(false);
    }
  }

  const payIn = type === CashMovementType.PayIn;
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{payIn ? 'Pay in' : 'Pay out'}</DialogTitle>
          <DialogDescription>{payIn ? 'Cash put into the drawer that is not a sale.' : 'Cash taken out of the drawer that is not a refund or an expense.'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="movement-amount">Amount (KES)</Label>
          <Input id="movement-amount" type="number" inputMode="decimal" min={0} step="0.01" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 text-lg tabular" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="movement-reason">Reason *</Label>
          <Input id="movement-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <div className="flex flex-wrap gap-1">
            {SUGGESTED_REASONS[type].map((r) => (
              <Button key={r} type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReason(r)}>{r.trim()}{r.endsWith(' ') ? '…' : ''}</Button>
            ))}
          </div>
        </div>
        <FormAlert error={error} />
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={pending} onClick={submit}>{payIn ? 'Record pay-in' : 'Record pay-out'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const DENOMINATIONS = [1000, 500, 200, 100, 50, 40, 20, 10, 5, 1] as const;

/**
 * Counts out the day. The counted amount can be typed or added up from notes and coins. The result (expected, counted, variance) is the
 * API's response, shown before the dialog closes.
 */
export function CloseDayDialog({ session, open, onOpenChange }: { session: CashSessionDto; open: boolean; onOpenChange(o: boolean): void }) {
  const updated = useSessionUpdated();
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [counting, setCounting] = useState(false);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [closed, setClosed] = useState<CashSessionDto | null>(null);
  useEffect(() => {
    if (open) {
      setCounted('');
      setNotes('');
      setCounting(false);
      setCounts({});
      setError(null);
      setClosed(null);
    }
  }, [open]);

  function setCount(denomination: number, value: string) {
    const next = { ...counts, [denomination]: value };
    setCounts(next);
    // The cashier's own count of notes and coins, put into the box: the API still works out what was expected.
    const total = DENOMINATIONS.reduce((acc, d) => acc + d * Math.max(0, Math.floor(Number(next[d]) || 0)), 0);
    setCounted(String(total));
  }

  async function submit() {
    setError(null);
    const value = parseAmount(counted);
    if (value === null) return setError(new Error('Enter the cash counted in the drawer, the float included.'));
    setPending(true);
    try {
      const result = await cashSessionsApi.close(session.cashSessionId, { countedCash: value, notes: emptyToNull(notes) });
      updated(result, false);
      setClosed(result);
    } catch (e) {
      setError(e);
      if (normaliseError(e).status === 400) updated();
    } finally {
      setPending(false);
    }
  }

  const stillOut = session.breakdown.cashStillWithRiders;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        onOpenChange(o);
        if (!o && closed) updated();
      }}
    >
      <DialogContent size="md">
        {closed ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Lock className="size-5" />{closed.sessionNumber} closed</DialogTitle>
              <DialogDescription>The figures are fixed: later changes never move a closed day.</DialogDescription>
            </DialogHeader>
            <CloseResult session={closed} />
            <DialogFooter><Button onClick={() => { onOpenChange(false); updated(); }}>Done</Button></DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Count out the day</DialogTitle>
              <DialogDescription>Count everything in the drawer, the float included.</DialogDescription>
            </DialogHeader>
            {stillOut > 0 && (
              <Alert variant="warning">
                <AlertTriangle />
                <AlertTitle>Cash still with riders</AlertTitle>
                <AlertDescription>
                  {formatMoney(stillOut)} is still with riders ({session.breakdown.ordersStillOut} order(s)). Complete or return those deliveries before counting.{' '}
                  <Link href="/deliveries" className="font-medium underline">Deliveries board</Link>
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="counted-cash">Cash counted (KES)</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCounting((c) => !c)}><Calculator />{counting ? 'Hide notes and coins' : 'Count notes and coins'}</Button>
              </div>
              <Input id="counted-cash" type="number" inputMode="decimal" min={0} step="0.01" autoFocus value={counted} onChange={(e) => setCounted(e.target.value)} className="h-12 text-xl tabular" />
            </div>
            {counting && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border p-3 sm:grid-cols-5" aria-label="Notes and coins">
                {DENOMINATIONS.map((d) => (
                  <label key={d} className="space-y-0.5 text-xs">
                    <span className="text-muted-foreground">{d.toLocaleString()} ×</span>
                    <Input type="number" inputMode="numeric" min={0} step={1} value={counts[d] ?? ''} onChange={(e) => setCount(d, e.target.value)} className="h-8 tabular" aria-label={`Number of ${d}`} />
                  </label>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="closing-notes">Notes</Label>
              <Textarea id="closing-notes" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder="Optional: explain a difference" />
            </div>
            <FormAlert error={error} />
            <DialogFooter>
              <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button loading={pending} onClick={submit}>Close the day</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Expected, counted and the variance, as the API fixed them at the close. */
export function CloseResult({ session }: { session: CashSessionDto }) {
  return (
    <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted p-4 text-center">
      <div>
        <p className="text-xs text-muted-foreground">Expected</p>
        <p className="text-lg font-semibold tabular">{formatMoney(session.breakdown.expectedCash)}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Counted</p>
        <p className="text-lg font-semibold tabular">{formatMoney(session.countedCash)}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Variance</p>
        <p className="text-lg" data-testid="variance"><VarianceText value={session.variance} /></p>
      </div>
    </div>
  );
}

/** One session: its statement, its movements and, while open, the day's actions. A closed session is read-only. */
export function CashSessionView({ session }: { session: CashSessionDto }) {
  const [movement, setMovement] = useState<CashMovementType | null>(null);
  const [closing, setClosing] = useState(false);
  const isOpen = session.status === CashSessionStatus.Open;
  const canMove = usePermission('CashSessions.RecordMovement');
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                {session.sessionNumber}
                <Badge variant={isOpen ? 'success' : 'secondary'}>{labels.cashSessionStatus[session.status]}</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {session.kraBranchId ? `${session.kraBranchId} ${session.branchName ?? ''} · ` : ''}Opened {formatDateTime(session.openedAt)}{session.openedByName ? ` by ${session.openedByName}` : ''}
              </p>
            </div>
            {isOpen && (
              <Can permission="CashSessions.Close">
                <Button onClick={() => setClosing(true)}><Lock />Close the day</Button>
              </Can>
            )}
          </CardHeader>
          <CardContent>
            <BreakdownStatement session={session} />
            {isOpen && session.breakdown.cashStillWithRiders > 0 && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-warning-foreground dark:text-warning">
                <AlertTriangle className="size-3.5" />
                {formatMoney(session.breakdown.cashStillWithRiders)} still with riders ({session.breakdown.ordersStillOut} order(s)): not in the drawer yet.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>Pay-ins and pay-outs</CardTitle>
            {isOpen && canMove && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setMovement(CashMovementType.PayIn)}><ArrowDownLeft />Pay in</Button>
                <Button size="sm" variant="outline" onClick={() => setMovement(CashMovementType.PayOut)}><ArrowUpRight />Pay out</Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {session.movements.length === 0 ? (
              <EmptyState title="No cash paid in or out" message={isOpen ? 'Banking, change given to a rider, a float top-up…' : undefined} className="py-6" />
            ) : (
              <ul className="divide-y text-sm">
                {session.movements.map((m) => {
                  const payIn = m.movementType === CashMovementType.PayIn;
                  return (
                    <li key={m.cashSessionMovementId} className="flex items-center gap-3 py-2">
                      {payIn ? <ArrowDownLeft className="size-4 text-success" /> : <ArrowUpRight className="size-4 text-destructive" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{m.reason}</span>
                        <span className="text-xs text-muted-foreground">{labels.cashMovementType[m.movementType]} · {formatDateTime(m.createdAt)}{m.createdByName ? ` · ${m.createdByName}` : ''}</span>
                      </span>
                      <MoneyText value={payIn ? m.amount : -m.amount} className="font-medium" />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="space-y-4">
        {!isOpen && (
          <Card>
            <CardHeader><CardTitle>Count</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <CloseResult session={session} />
              <DetailList
                columns={1}
                items={[
                  { label: 'Closed', value: `${formatDateTime(session.closedAt)}${session.closedByName ? ` by ${session.closedByName}` : ''}` },
                  ...(session.closingNotes ? [{ label: 'Closing notes', value: session.closingNotes }] : []),
                ]}
              />
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader><CardTitle>Day</CardTitle></CardHeader>
          <CardContent>
            <DetailList
              columns={1}
              items={[
                { label: 'Float', value: formatMoney(session.openingFloat) },
                { label: 'Opened', value: `${formatDateTime(session.openedAt)}${session.openedByName ? ` by ${session.openedByName}` : ''}` },
                ...(session.openingNotes ? [{ label: 'Opening notes', value: session.openingNotes }] : []),
              ]}
            />
          </CardContent>
        </Card>
      </div>
      {movement !== null && <MovementDialog session={session} type={movement} open onOpenChange={(o) => !o && setMovement(null)} />}
      <CloseDayDialog session={session} open={closing} onOpenChange={setClosing} />
    </div>
  );
}
