'use client';

import { Gift } from 'lucide-react';
import { Badge } from '@/components/ui/primitives';
import { CustomerDiscountSource, MonthlyDiscountScope } from '@/api/enums';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CustomerMonthlySpendDto } from '@/api/dto/sales';

/** "Monthly reward (20%)" or "Customer discount (10%)": the label of a sale's customer discount line, by where it came from. */
export function customerDiscountLabel(source: CustomerDiscountSource | null | undefined, percent: number | null | undefined): string {
  const name = source === CustomerDiscountSource.MonthlySpend ? 'Monthly reward' : 'Customer discount';
  return percent ? `${name} (${percent}%)` : name;
}

/**
 * The customer's month against the monthly-spend reward, as the API reports it: a progress bar until the threshold, then whether this
 * sale gets the reward. The bar's width is geometry only; every amount is the API's.
 */
export function MonthlyRewardProgress({ month, className }: { month: CustomerMonthlySpendDto; className?: string }) {
  const reached = month.remainingToThreshold <= 0;
  const share = month.threshold > 0 ? Math.min(100, Math.max(0, (month.spent / month.threshold) * 100)) : 0;
  const usedUp = reached && !month.qualifies && month.scope === MonthlyDiscountScope.NextPurchaseOnly;
  return (
    <div className={cn('space-y-1.5', className)} aria-label="Monthly reward">
      {month.qualifies ? (
        <Badge variant="success"><Gift className="size-3" />{month.percent}% monthly reward applied</Badge>
      ) : usedUp ? (
        <Badge variant="secondary"><Gift className="size-3" />Monthly reward already used this month</Badge>
      ) : null}
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={month.threshold}
        aria-valuenow={Math.min(month.spent, month.threshold)}
        aria-label="Spent this month"
      >
        <div className="h-full rounded-full" style={{ width: `${share}%`, background: reached ? 'hsl(var(--success))' : 'var(--chart-1)' }} />
      </div>
      <p className="text-xs text-muted-foreground">
        Spent <span className="font-medium text-foreground tabular">{formatMoney(month.spent)}</span> of {formatMoney(month.threshold)} this month
        {reached ? '' : `: ${formatMoney(month.remainingToThreshold)} to unlock ${month.percent}% off`}
      </p>
    </div>
  );
}
