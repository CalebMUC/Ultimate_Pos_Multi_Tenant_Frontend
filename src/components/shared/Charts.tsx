'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '@/lib/format';

// Single-series charts: one hue (--chart-1), so no legend box; the card title names the series.
// Values and axes use text tokens, never the series colour. Every chart has a hover tooltip.
const axisTick = { fill: 'hsl(var(--muted-foreground))', fontSize: 11 };

const compact = new Intl.NumberFormat('en-KE', { notation: 'compact', maximumFractionDigits: 1 });

function ChartTooltip({ active, payload, label, format }: { active?: boolean; payload?: { value: number }[]; label?: string; format(v: number): string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold tabular text-foreground">{format(payload[0].value)}</p>
    </div>
  );
}

interface BarProps<T> {
  data: T[];
  x: keyof T & string;
  y: keyof T & string;
  /** Formats axis ticks on the category axis. */
  xFormat?: (v: string) => string;
  valueFormat?: (v: number) => string;
  height?: number;
  /** Horizontal bars for long category names (products, customers). */
  horizontal?: boolean;
  ariaLabel: string;
}

export function SimpleBarChart<T>({ data, x, y, xFormat, valueFormat = (v) => formatMoney(v), height = 260, horizontal, ariaLabel }: BarProps<T>) {
  const chartHeight = horizontal ? Math.max(height, data.length * 32 + 24) : height;
  return (
    <div role="img" aria-label={ariaLabel} style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 12, bottom: 0, left: horizontal ? 8 : 0 }} barCategoryGap={horizontal ? 6 : '20%'}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={!!horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v: number) => compact.format(v)} />
              <YAxis type="category" dataKey={x} tick={axisTick} tickLine={false} axisLine={false} width={140} tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)} />
            </>
          ) : (
            <>
              <XAxis dataKey={x} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={xFormat} minTickGap={12} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => compact.format(v)} />
            </>
          )}
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }}
            content={({ active, payload, label }) => (
              <ChartTooltip active={active} payload={payload as { value: number }[] | undefined} label={xFormat && !horizontal ? xFormat(String(label)) : String(label)} format={valueFormat} />
            )}
          />
          <Bar dataKey={y} fill="var(--chart-1)" radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={horizontal ? 22 : 36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** A share list (payment mix, expense categories): label, value, and a thin proportional bar. Readable without colour. */
export function ShareList({ items }: { items: { label: string; value: number; percent: number; hint?: string }[] }) {
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{i.label}{i.hint && <span className="ml-1 text-xs text-muted-foreground">{i.hint}</span>}</span>
            <span className="shrink-0 tabular">
              {formatMoney(i.value)} <span className="text-xs text-muted-foreground">{i.percent.toFixed(1)}%</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, i.percent))}%`, background: 'var(--chart-1)' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
