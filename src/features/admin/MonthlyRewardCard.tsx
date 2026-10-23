'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/overlays';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@/components/ui/primitives';
import { FormAlert } from '@/components/shared/States';
import { businessesApi } from '@/api/endpoints/business';
import { normaliseError } from '@/api/errors';
import { MonthlyDiscountScope, enumOptions, labels } from '@/api/enums';
import { formatMoney } from '@/lib/format';
import { useSession } from '@/stores/session';
import { loadCurrentBusiness } from '@/features/auth/sessionActions';

type Errors = { threshold?: string; percent?: string };

/** At most 2 decimals, as the API takes them. */
const twoDecimals = (n: number) => Math.round(n * 100) === n * 100;

/** "Customers who spend KES 4,000 in a month get 20% off every purchase for the rest of that month." */
export function rewardSentence(threshold: number, percent: number, scope: MonthlyDiscountScope): string {
  const what = scope === MonthlyDiscountScope.NextPurchaseOnly ? 'their next purchase that month' : 'every purchase for the rest of that month';
  return `Customers who spend ${formatMoney(threshold)} in a month get ${percent}% off ${what}.`;
}

/**
 * The monthly-spend reward (Businesses.Update): once a registered customer's month reaches the threshold, the API discounts their later
 * purchases. The purchase that reaches it pays full price. Nothing here works out who qualifies.
 */
export function MonthlyRewardCard() {
  const qc = useQueryClient();
  const business = useSession((s) => s.business);
  const [on, setOn] = useState(false);
  const [threshold, setThreshold] = useState('');
  const [percent, setPercent] = useState('');
  const [scope, setScope] = useState<MonthlyDiscountScope>(MonthlyDiscountScope.RestOfMonth);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!business) return;
    setOn(business.monthlyDiscountThreshold != null && business.monthlyDiscountPercent != null);
    setThreshold(business.monthlyDiscountThreshold != null ? String(business.monthlyDiscountThreshold) : '4000');
    setPercent(business.monthlyDiscountPercent != null ? String(business.monthlyDiscountPercent) : '20');
    setScope(business.monthlyDiscountScope ?? MonthlyDiscountScope.RestOfMonth);
  }, [business]);

  const t = Number(threshold);
  const pc = Number(percent);
  const valid = threshold.trim() !== '' && percent.trim() !== '' && t > 0 && pc > 0 && pc < 100;

  function check(): Errors {
    const e: Errors = {};
    if (threshold.trim() === '' || !(t > 0)) e.threshold = 'Enter the monthly spend that unlocks the reward, above 0.';
    else if (!twoDecimals(t)) e.threshold = 'At most 2 decimals.';
    if (percent.trim() === '' || !(pc > 0 && pc < 100)) e.percent = 'Enter a discount between 0 and 100%.';
    else if (!twoDecimals(pc)) e.percent = 'At most 2 decimals.';
    return e;
  }

  async function save() {
    setError(null);
    const e = on ? check() : {};
    setErrors(e);
    if (e.threshold || e.percent) return;
    setSaving(true);
    try {
      await businessesApi.updateMonthlyDiscount(on ? { threshold: t, percent: pc, scope } : { threshold: null, percent: null, scope });
      await loadCurrentBusiness();
      void qc.invalidateQueries({ queryKey: ['business-current'] });
      // Prices on the till may change at once.
      void qc.invalidateQueries({ queryKey: ['sale-preview'] });
      toast.success(on ? 'Monthly spend reward saved' : 'Monthly spend reward turned off');
    } catch (err) {
      const apiError = normaliseError(err);
      const fields: Errors = { threshold: apiError.fieldErrors.threshold?.join(' '), percent: apiError.fieldErrors.percent?.join(' ') };
      setErrors(fields);
      if (!fields.threshold && !fields.percent) setError(apiError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Gift className="size-5" />Monthly spend reward</CardTitle>
        <CardDescription>
          Registered customers who spend enough in a calendar month get a discount for the rest of it. Purchases at every branch count; walk-in sales never do.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-3 text-sm font-medium">
          <Switch checked={on} onCheckedChange={(v) => { setOn(v); setErrors({}); }} aria-label="Monthly spend reward" />
          {on ? 'On' : 'Off'}
        </label>
        {on && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="reward-threshold">Spend threshold (KES)</Label>
                <Input id="reward-threshold" type="number" inputMode="decimal" min={0} step="0.01" value={threshold} onChange={(e) => setThreshold(e.target.value)} aria-invalid={!!errors.threshold} className="tabular" />
                {errors.threshold && <p className="text-xs text-destructive">{errors.threshold}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reward-percent">Discount (%)</Label>
                <Input id="reward-percent" type="number" inputMode="decimal" min={0} max={99.99} step="0.5" value={percent} onChange={(e) => setPercent(e.target.value)} aria-invalid={!!errors.percent} className="tabular" />
                {errors.percent && <p className="text-xs text-destructive">{errors.percent}</p>}
              </div>
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Applies to</legend>
              {enumOptions(labels.monthlyDiscountScope).map((o) => (
                <label key={o.value} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="reward-scope" checked={scope === o.value} onChange={() => setScope(o.value)} className="accent-primary" />
                  {o.label}
                </label>
              ))}
            </fieldset>
            {valid && <p className="rounded-md bg-muted p-3 text-sm" data-testid="reward-sentence">{rewardSentence(t, pc, scope)}</p>}
            <p className="text-xs text-muted-foreground">
              The purchase that reaches the threshold pays full price; the discount starts with the next one. A customer with their own discount gets the larger of the two, never both. The cashiers’ maximum discount does not limit this reward.
            </p>
          </>
        )}
        <FormAlert error={error} />
        <Button loading={saving} onClick={save}>Save</Button>
      </CardContent>
    </Card>
  );
}
