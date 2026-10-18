import { env } from '@/config/env';

const moneyFormatter = new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyFormatter = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 3 });
const percentFormatter = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 1 });

/** "KES 1,250.00". Null renders as an em dash, never as zero (cost fields are null without Costing.View). */
export function formatMoney(value: number | null | undefined, opts: { currency?: boolean } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const text = moneyFormatter.format(value);
  return opts.currency === false ? text : `KES ${text}`;
}

export function formatQty(value: number | null | undefined, unit?: string | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return unit ? `${qtyFormatter.format(value)} ${unit}` : qtyFormatter.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${percentFormatter.format(value)}%`;
}

/** Date-only values (yyyy-MM-dd) are calendar days: never shift them through a time zone. */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Today's local calendar day as yyyy-MM-dd. */
export function todayIso(): string {
  return toIsoDate(new Date());
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toIsoDate(new Date(y, m - 1, d + days));
}

export function startOfMonthIso(): string {
  const now = new Date();
  return toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

/** The browser's offset from UTC in minutes (Nairobi: 180). Reports and date filters send this. */
export function utcOffsetMinutes(): number {
  const offset = -new Date().getTimezoneOffset();
  return Number.isFinite(offset) ? offset : env.defaultUtcOffsetMinutes;
}
