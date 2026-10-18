'use client';

import { useState } from 'react';
import { Input, NativeSelect } from '@/components/ui/primitives';
import { addDays, startOfMonthIso, todayIso, toIsoDate } from '@/lib/format';

export interface DateRangeValue { from: string; to: string }

const presets: { id: string; label: string; range: () => DateRangeValue }[] = [
  { id: 'today', label: 'Today', range: () => ({ from: todayIso(), to: todayIso() }) },
  { id: 'yesterday', label: 'Yesterday', range: () => ({ from: addDays(todayIso(), -1), to: addDays(todayIso(), -1) }) },
  { id: '7d', label: 'Last 7 days', range: () => ({ from: addDays(todayIso(), -6), to: todayIso() }) },
  { id: '30d', label: 'Last 30 days', range: () => ({ from: addDays(todayIso(), -29), to: todayIso() }) },
  { id: 'month', label: 'This month', range: () => ({ from: startOfMonthIso(), to: todayIso() }) },
  {
    id: 'lastMonth',
    label: 'Last month',
    range: () => {
      const now = new Date();
      return { from: toIsoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 0)) };
    },
  },
  { id: 'year', label: 'This year', range: () => ({ from: `${new Date().getFullYear()}-01-01`, to: todayIso() }) },
];

export function presetRange(id: string): DateRangeValue {
  return (presets.find((p) => p.id === id) ?? presets[4]).range();
}

/** Preset select plus from/to inputs. Dates are local calendar days (yyyy-MM-dd). */
export function DateRangeFilter({ value, onChange }: { value: DateRangeValue; onChange(v: DateRangeValue): void }) {
  const [preset, setPreset] = useState(() => presets.find((p) => { const r = p.range(); return r.from === value.from && r.to === value.to; })?.id ?? 'custom');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        value={preset}
        onChange={(e) => {
          setPreset(e.target.value);
          if (e.target.value !== 'custom') onChange(presetRange(e.target.value));
        }}
        className="w-36"
        aria-label="Date range"
      >
        {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        <option value="custom">Custom</option>
      </NativeSelect>
      <Input
        type="date"
        value={value.from}
        max={value.to}
        onChange={(e) => { setPreset('custom'); if (e.target.value) onChange({ ...value, from: e.target.value }); }}
        className="w-[9.5rem]"
        aria-label="From"
      />
      <span className="text-sm text-muted-foreground">to</span>
      <Input
        type="date"
        value={value.to}
        min={value.from}
        onChange={(e) => { setPreset('custom'); if (e.target.value) onChange({ ...value, to: e.target.value }); }}
        className="w-[9.5rem]"
        aria-label="To"
      />
    </div>
  );
}
