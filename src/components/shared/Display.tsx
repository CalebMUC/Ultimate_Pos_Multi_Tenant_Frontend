'use client';

import type { ReactNode } from 'react';
import { Pill, Layers } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/primitives';
import { formatMoney, formatQty } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PurchaseOrderStatus, SaleStatus, labels, type ExpiryStatus, ExpenseStatus } from '@/api/enums';

export function MoneyText({ value, className, currency = true }: { value: number | null | undefined; className?: string; currency?: boolean }) {
  return <span className={cn('tabular whitespace-nowrap', value !== null && value !== undefined && value < 0 && 'text-destructive', className)}>{formatMoney(value, { currency })}</span>;
}

export function QuantityText({ value, unit, className }: { value: number | null | undefined; unit?: string | null; className?: string }) {
  return <span className={cn('tabular whitespace-nowrap', className)}>{formatQty(value, unit)}</span>;
}

const saleVariant: Record<SaleStatus, BadgeVariant> = {
  [SaleStatus.Pending]: 'warning', [SaleStatus.Completed]: 'success', [SaleStatus.Voided]: 'secondary', [SaleStatus.Failed]: 'destructive',
};
const poVariant: Record<PurchaseOrderStatus, BadgeVariant> = {
  [PurchaseOrderStatus.Draft]: 'secondary', [PurchaseOrderStatus.Ordered]: 'info', [PurchaseOrderStatus.PartiallyReceived]: 'warning',
  [PurchaseOrderStatus.Received]: 'success', [PurchaseOrderStatus.Cancelled]: 'secondary',
};
const expiryVariant: Record<ExpiryStatus, BadgeVariant> = { Expired: 'destructive', NearExpiry: 'warning', Ok: 'success', NoExpiry: 'secondary' };

export type StatusBadgeProps =
  | { kind: 'sale'; value: SaleStatus }
  | { kind: 'purchaseOrder'; value: PurchaseOrderStatus }
  | { kind: 'expiry'; value: ExpiryStatus }
  | { kind: 'expense'; value: ExpenseStatus }
  | { kind: 'active'; value: boolean }
  | { kind: 'stock'; value: 'InStock' | 'LowStock' | 'OutOfStock' };

export function StatusBadge(props: StatusBadgeProps) {
  switch (props.kind) {
    case 'sale':
      return <Badge variant={saleVariant[props.value]}>{labels.saleStatus[props.value]}</Badge>;
    case 'purchaseOrder':
      return <Badge variant={poVariant[props.value]}>{labels.purchaseOrderStatus[props.value]}</Badge>;
    case 'expiry':
      return <Badge variant={expiryVariant[props.value]}>{labels.expiryStatus[props.value]}</Badge>;
    case 'expense':
      return <Badge variant={props.value === ExpenseStatus.Posted ? 'success' : 'secondary'}>{labels.expenseStatus[props.value]}</Badge>;
    case 'active':
      return <Badge variant={props.value ? 'success' : 'secondary'}>{props.value ? 'Active' : 'Inactive'}</Badge>;
    case 'stock': {
      const map = { InStock: ['success', 'In stock'], LowStock: ['warning', 'Low stock'], OutOfStock: ['destructive', 'Out of stock'] } as const;
      const [variant, text] = map[props.value];
      return <Badge variant={variant}>{text}</Badge>;
    }
  }
}

/** Rx and Batch badges for medicines. */
export function ProductFlags({ requiresPrescription, isBatchTracked, className }: { requiresPrescription?: boolean; isBatchTracked?: boolean; className?: string }) {
  if (!requiresPrescription && !isBatchTracked) return null;
  return (
    <span className={cn('inline-flex gap-1', className)}>
      {requiresPrescription && <Badge variant="destructive" title="Prescription only"><Pill className="size-3" />Rx</Badge>}
      {isBatchTracked && <Badge variant="violet" title="Batch-tracked with expiry dates"><Layers className="size-3" />Batch</Badge>}
    </span>
  );
}

export function PageHeader({ title, description, actions, children }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon, tone = 'default' }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: 'default' | 'success' | 'warning' | 'destructive' }) {
  const toneClass = { default: 'bg-primary/10 text-primary', success: 'bg-success/15 text-success', warning: 'bg-warning/20 text-warning', destructive: 'bg-destructive/10 text-destructive' }[tone];
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4 shadow-sm">
      {icon && <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5', toneClass)}>{icon}</div>}
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-xl font-semibold tabular">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

/** Label/value pairs for detail pages. */
export function DetailList({ items, columns = 2 }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3', { 1: 'grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }[columns])}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
          <dd className="mt-0.5 break-words text-sm">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
