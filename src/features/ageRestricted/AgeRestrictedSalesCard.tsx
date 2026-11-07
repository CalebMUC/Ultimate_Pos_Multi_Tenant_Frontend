'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Clock, Moon } from 'lucide-react';
import { BusinessSector } from '@/api/enums';
import { useActiveBusiness } from '@/hooks/useSessionInfo';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@/components/ui/primitives';
import { Checkbox, Switch } from '@/components/ui/overlays';
import { Field } from '@/components/shared/Field';
import { FormAlert } from '@/components/shared/States';
import { businessesApi } from '@/api/endpoints/business';
import { normaliseError } from '@/api/errors';
import { loadCurrentBusiness } from '@/features/auth/sessionActions';
import { useSession } from '@/stores/session';
import type { AgeRestrictedSalesSettingsDto } from '@/api/dto/business';
import { clockTime, DEFAULT_MINIMUM_AGE, describeSellingHours, runsPastMidnight } from './sellingHours';

type FieldName = keyof AgeRestrictedSalesSettingsDto;
const FIELDS: readonly FieldName[] = ['minimumAge', 'weekdayFrom', 'weekdayTo', 'weekendFrom', 'weekendTo', 'enabled'];

interface Values {
  /** The business uses age-restricted sales at all. */
  enabled: boolean;
  minimumAge: string;
  limitHours: boolean;
  weekdayFrom: string;
  weekdayTo: string;
  differentWeekend: boolean;
  weekendFrom: string;
  weekendTo: string;
}

export function toValues(s: AgeRestrictedSalesSettingsDto | null | undefined): Values {
  const weekdayFrom = clockTime(s?.weekdayFrom) ?? '';
  const weekdayTo = clockTime(s?.weekdayTo) ?? '';
  const weekendFrom = clockTime(s?.weekendFrom) ?? '';
  const weekendTo = clockTime(s?.weekendTo) ?? '';
  return {
    // An older API without the switch: on.
    enabled: s?.enabled ?? true,
    minimumAge: String(s?.minimumAge ?? DEFAULT_MINIMUM_AGE),
    limitHours: !!weekdayFrom && !!weekdayTo,
    weekdayFrom,
    weekdayTo,
    differentWeekend: !!weekendFrom && !!weekendTo,
    weekendFrom,
    weekendTo,
  };
}

/** The request: hours switched off send nulls (any time); weekend hours only when they differ. A full replace. */
export function toSettings(v: Values): AgeRestrictedSalesSettingsDto {
  const on = v.limitHours;
  const weekend = on && v.differentWeekend;
  return {
    minimumAge: Number(v.minimumAge),
    weekdayFrom: on ? clockTime(v.weekdayFrom) : null,
    weekdayTo: on ? clockTime(v.weekdayTo) : null,
    weekendFrom: weekend ? clockTime(v.weekendFrom) : null,
    weekendTo: weekend ? clockTime(v.weekendTo) : null,
    enabled: v.enabled,
  };
}

/** What the API would refuse, said before sending. The API's own 400 is shown the same way, under the field. */
export function checkValues(v: Values): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  // Switched off, the age and hours are not shown, and the saved ones are sent back as they were.
  if (!v.enabled) return errors;
  const age = Number(v.minimumAge);
  if (v.minimumAge.trim() === '' || !Number.isInteger(age) || age < 18 || age > 25) errors.minimumAge = 'The minimum age is a whole number from 18 to 25.';
  const window = (on: boolean, from: string, to: string, fromField: FieldName, toField: FieldName, label: string) => {
    if (!on) return;
    if (!from) errors[fromField] = `When do ${label} sales start?`;
    if (!to) errors[toField] = `When do ${label} sales end?`;
    if (from && to && clockTime(from) === clockTime(to)) errors[toField] = `The ${label} hours end when they start. Switch the limit off for any time.`;
  };
  window(v.limitHours, v.weekdayFrom, v.weekdayTo, 'weekdayFrom', 'weekdayTo', 'weekday');
  window(v.limitHours && v.differentWeekend, v.weekendFrom, v.weekendTo, 'weekendFrom', 'weekendTo', 'weekend');
  return errors;
}

/** "Alcohol and cigarettes can be sold 17:00–23:00 on weekdays, 14:00–23:00 at weekends." from what is in the form now. */
export function previewLine(v: Values): string {
  const s = toSettings(v);
  // Half-filled hours are not a limit yet.
  const hours = s.weekdayFrom && s.weekdayTo ? s : null;
  const weekend = s.weekendFrom && s.weekendTo ? s : { ...s, weekendFrom: null, weekendTo: null };
  return `Alcohol and cigarettes can be sold ${describeSellingHours(hours ? weekend : null)}.`;
}

function PastMidnight({ from, to }: { from: string; to: string }) {
  if (!runsPastMidnight(from, to)) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:col-span-2">
      <Moon className="size-3.5 shrink-0" aria-hidden />Runs past midnight: until {clockTime(to)} the next morning.
    </p>
  );
}

/**
 * Settings → Age-restricted sales (Liquor businesses, Businesses.Update): whether the business uses them at all, the age the till asks
 * the cashier to check for, and the hours the liquor licence allows alcohol and tobacco to be sold. Off, nothing of it applies.
 */
export function AgeRestrictedSalesCard() {
  const saved = useSession((s) => s.business?.ageRestrictedSales);
  // Only a liquor store can switch it on; an older API without the switch shows the settings alone.
  const canSwitch = useActiveBusiness().sector === BusinessSector.Liquor && saved?.enabled !== undefined;
  const supported = useSession((s) => !!s.business && s.business.ageRestrictedSales !== undefined);
  const [values, setValues] = useState<Values>(() => toValues(saved));
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValues(toValues(saved)); }, [saved]);

  const set = (patch: Partial<Values>) => {
    setValues((v) => ({ ...v, ...patch }));
    // A changed field's message no longer applies.
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as FieldName];
      if ('limitHours' in patch) (['weekdayFrom', 'weekdayTo', 'weekendFrom', 'weekendTo'] as const).forEach((k) => delete next[k]);
      if ('differentWeekend' in patch) { delete next.weekendFrom; delete next.weekendTo; }
      return next;
    });
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const found = checkValues(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      // Off: the age and hours on file are kept as they were, for when it is switched back on.
      await businessesApi.updateAgeRestrictedSales(values.enabled ? toSettings(values) : { ...toSettings(toValues(saved)), enabled: false });
      await loadCurrentBusiness();
      toast.success(values.enabled ? 'Age-restricted sales saved' : 'Age-restricted sales switched off');
    } catch (err) {
      const apiError = normaliseError(err);
      const mine: Partial<Record<FieldName, string>> = {};
      const others: string[] = [];
      for (const [k, messages] of Object.entries(apiError.fieldErrors)) {
        const field = FIELDS.find((f) => f.toLowerCase() === k.toLowerCase());
        if (field) mine[field] = messages.join(' ');
        else others.push(...messages);
      }
      setErrors(mine);
      if (!Object.keys(mine).length || others.length) setError(others.length ? new Error(others.join(' ')) : apiError);
    } finally {
      setSaving(false);
    }
  }

  const err = (k: FieldName) => (errors[k] ? { message: errors[k] } : undefined);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Clock className="size-5" />Age-restricted sales</CardTitle>
        <CardDescription>
          Alcohol and tobacco. The till asks the cashier to check the customer’s age on every sale of them, and refuses them outside the
          hours set here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!supported ? (
          <Alert variant="warning"><AlertDescription>The server does not keep these settings yet. Update the API, then set them here.</AlertDescription></Alert>
        ) : (
          <form aria-label="Age-restricted sales" className="space-y-4" onSubmit={save} noValidate>
            {canSwitch && (
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Switch checked={values.enabled} onCheckedChange={(v) => set({ enabled: v })} />
                  Use age-restricted sales
                </label>
                {errors.enabled && <p className="text-xs text-destructive">{errors.enabled}</p>}
                {!values.enabled && (
                  <p className="text-sm text-muted-foreground">
                    Off: no age check at the till or on deliveries, no selling hours and no age-check register. Products marked 18+ sell like
                    any other and keep their mark for when you switch this back on.
                  </p>
                )}
              </div>
            )}
            {values.enabled && (
              <>
                <Field label="Minimum age" required error={err('minimumAge')} hint="18 by law today. From 18 to 25." className="max-w-40">
                  <Input type="number" inputMode="numeric" min={18} max={25} step={1} value={values.minimumAge} onChange={(e) => set({ minimumAge: e.target.value })} />
                </Field>
                <div className="space-y-3 rounded-md border p-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Switch checked={values.limitHours} onCheckedChange={(v) => set({ limitHours: v })} />
                    Limit the hours alcohol and tobacco can be sold
                  </label>
                  {values.limitHours && (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="From" required error={err('weekdayFrom')}>
                          <Input type="time" value={values.weekdayFrom} onChange={(e) => set({ weekdayFrom: e.target.value })} />
                        </Field>
                        <Field label="To" required error={err('weekdayTo')}>
                          <Input type="time" value={values.weekdayTo} onChange={(e) => set({ weekdayTo: e.target.value })} />
                        </Field>
                        <PastMidnight from={values.weekdayFrom} to={values.weekdayTo} />
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={values.differentWeekend} onCheckedChange={(v) => set({ differentWeekend: v === true })} />
                        Different hours at weekends
                      </label>
                      {values.differentWeekend && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Weekend from" required error={err('weekendFrom')} hint="Saturday and Sunday.">
                            <Input type="time" value={values.weekendFrom} onChange={(e) => set({ weekendFrom: e.target.value })} />
                          </Field>
                          <Field label="Weekend to" required error={err('weekendTo')}>
                            <Input type="time" value={values.weekendTo} onChange={(e) => set({ weekendTo: e.target.value })} />
                          </Field>
                          <PastMidnight from={values.weekendFrom} to={values.weekendTo} />
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">Use the hours on your liquor licence. Public holidays use the weekday hours.</p>
                    </>
                  )}
                </div>
                <p className="rounded-md bg-muted px-3 py-2 text-sm" aria-live="polite">
                  {previewLine(values)}{' '}
                  <span className="text-muted-foreground">Customers must be {Number(values.minimumAge) || DEFAULT_MINIMUM_AGE} or over.</span>
                </p>
              </>
            )}
            <FormAlert error={error} />
            <div className="flex justify-end">
              <Button type="submit" loading={saving}>Save</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
