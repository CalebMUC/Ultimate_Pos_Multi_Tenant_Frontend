'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '@/lib/format';

// Single-series charts: one hue (--chart-1), so no legend box; the card title names the series.
// Values and axes use text tokens, never the series colour. Every chart has a hover tooltip.
const axisTick = { fill: 'hsl(var(--muted-foreground))', fontSize: 11 };

const compact = new Intl.NumberFormat('en-KE', { notation: 'compact', maximumFractionDigits: 1 });

function ChartTooltip({ active, payload, label, format, detail }: {
  active?: boolean;
  payload?: { value: number; payload?: unknown }[];
  label?: string;
  format(v: number): string;
  detail?: (row: never) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold tabular text-foreground">{format(payload[0].value)}</p>
      {detail && <p className="tabular text-muted-foreground">{detail(payload[0].payload as never)}</p>}
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
  /** A second fact about the bar for the tooltip (a count beside a total), so it never needs a second axis. */
  detail?: (row: T) => string;
}

export function SimpleBarChart<T>({ data, x, y, xFormat, valueFormat = (v) => formatMoney(v), height = 260, horizontal, ariaLabel, detail }: BarProps<T>) {
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
              <ChartTooltip
                active={active}
                payload={payload as { value: number; payload?: unknown }[] | undefined}
                label={xFormat && !horizontal ? xFormat(String(label)) : String(label)}
                format={valueFormat}
                detail={detail as ((row: never) => string) | undefined}
              />
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

/**
 * A part-to-whole split of two or three amounts in one bar: the first part in the series hue, the rest neutral, with a 2px surface gap
 * between them. Every part is labelled with its value, so it reads without colour. The widths are geometry only; the amounts are the API's.
 */
export function SplitBar({ parts, ariaLabel }: { parts: { label: string; value: number; hint?: string }[]; ariaLabel: string }) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0);
  const fills = ['var(--chart-1)', 'hsl(var(--muted-foreground) / 0.35)', 'hsl(var(--muted-foreground) / 0.18)'];
  return (
    <div className="space-y-2">
      <div role="img" aria-label={ariaLabel} className="flex h-3 gap-0.5 overflow-hidden rounded bg-muted">
        {total > 0 && parts.map((p, i) => (
          p.value > 0 && <div key={p.label} title={`${p.label}: ${formatMoney(p.value)}`} className="h-full first:rounded-l last:rounded-r" style={{ width: `${(p.value / total) * 100}%`, background: fills[i] }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: fills[i] }} aria-hidden />
            <span className="text-muted-foreground">{p.label}</span>
            <span className="font-semibold tabular">{formatMoney(p.value)}</span>
            {total > 0 && <span className="text-xs text-muted-foreground tabular">{Math.round((p.value / total) * 100)}%</span>}
            {p.hint && <span className="text-xs text-muted-foreground">{p.hint}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
