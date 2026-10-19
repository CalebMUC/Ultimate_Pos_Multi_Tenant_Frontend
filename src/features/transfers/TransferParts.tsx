'use client';

import { ArrowRight, Check, PackageCheck, Truck, FileEdit, Ban } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/primitives';
import { labels, StockTransferStatus } from '@/api/enums';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { StockTransferDto } from '@/api/dto/branches';

const variant: Record<StockTransferStatus, BadgeVariant> = {
  [StockTransferStatus.Draft]: 'secondary',
  [StockTransferStatus.Dispatched]: 'warning',
  [StockTransferStatus.Received]: 'success',
  [StockTransferStatus.Cancelled]: 'outline',
};

export function TransferStatusBadge({ status }: { status: StockTransferStatus }) {
  return <Badge variant={variant[status]}>{labels.stockTransferStatus[status]}</Badge>;
}

/** "01 Westlands → 02 Kisumu". */
export function TransferRoute({ t, className }: { t: Pick<StockTransferDto, 'fromKraBranchId' | 'fromBranchName' | 'toKraBranchId' | 'toBranchName'>; className?: string }) {
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      <span><span className="tabular text-muted-foreground">{t.fromKraBranchId}</span> {t.fromBranchName}</span>
      <ArrowRight className="size-3.5 text-muted-foreground" aria-label="to" />
      <span><span className="tabular text-muted-foreground">{t.toKraBranchId}</span> {t.toBranchName}</span>
    </span>
  );
}

/** Draft → Dispatched (in transit, counted at neither branch) → Received. A cancelled draft shows its own state. */
export function TransferStatusBar({ t }: { t: StockTransferDto }) {
  if (t.status === StockTransferStatus.Cancelled) {
    return <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"><Ban className="size-4" />Cancelled before dispatch: nothing moved.</div>;
  }
  const steps = [
    { label: 'Draft', hint: formatDateTime(t.createdAt), icon: FileEdit, done: true },
    { label: 'Dispatched', hint: t.dispatchedAt ? `${formatDateTime(t.dispatchedAt)} · in transit` : 'Stock still at the source', icon: Truck, done: t.status >= StockTransferStatus.Dispatched },
    { label: 'Received', hint: t.receivedAt ? formatDateTime(t.receivedAt) : 'At the destination', icon: PackageCheck, done: t.status === StockTransferStatus.Received },
  ];
  const current = t.status === StockTransferStatus.Draft ? 0 : t.status === StockTransferStatus.Dispatched ? 1 : 2;
  return (
    <ol className="grid gap-2 sm:grid-cols-3" aria-label="Transfer progress">
      {steps.map((s, i) => (
        <li key={s.label} aria-current={i === current ? 'step' : undefined}
          className={cn('flex items-center gap-3 rounded-lg border px-4 py-3', s.done ? 'border-primary/40 bg-primary/5' : 'bg-card', i === current && 'ring-1 ring-primary/40')}>
          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', s.done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
            {s.done && i < current ? <Check className="size-4" /> : <s.icon className="size-4" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{i + 1}. {s.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{s.hint}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
