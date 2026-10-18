import { AlertOctagon, AlertTriangle, Info, type LucideIcon } from 'lucide-react';
import { EventSeverity } from '@/api/enums';
import type { BadgeVariant } from '@/components/ui/primitives';

export interface SeverityStyle {
  severity: EventSeverity;
  label: string;
  icon: LucideIcon;
  /** Icon and dot colour. */
  tone: string;
  badge: BadgeVariant;
}

const styles: Record<EventSeverity, SeverityStyle> = {
  [EventSeverity.Info]: { severity: EventSeverity.Info, label: 'Info', icon: Info, tone: 'text-muted-foreground', badge: 'secondary' },
  [EventSeverity.Warning]: { severity: EventSeverity.Warning, label: 'Warning', icon: AlertTriangle, tone: 'text-warning', badge: 'warning' },
  [EventSeverity.Critical]: { severity: EventSeverity.Critical, label: 'Critical', icon: AlertOctagon, tone: 'text-destructive', badge: 'destructive' },
};

/** Severity as a number, a numeric string or a name. Anything unknown is treated as Info. */
export function toSeverity(value: unknown): EventSeverity {
  if (typeof value === 'number' && value in styles) return value as EventSeverity;
  if (typeof value === 'string') {
    if (/^\d+$/.test(value)) return toSeverity(Number(value));
    const byName = (Object.keys(EventSeverity) as (keyof typeof EventSeverity)[]).find((k) => isNaN(Number(k)) && k.toLowerCase() === value.toLowerCase());
    if (byName) return EventSeverity[byName];
  }
  return EventSeverity.Info;
}

export function severityStyle(value: unknown): SeverityStyle {
  return styles[toSeverity(value)];
}

const words = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');

/** "Sale.Voided" -> "Sale voided"; "Stock.BelowReorderLevel" -> "Stock below reorder level"; "Mpesa.StkPaymentFailed" -> "M-Pesa STK payment failed". */
export function eventTypeLabel(eventType: string): string {
  const text = words(eventType.replace('.', ' ')).toLowerCase().replace(/\s+/g, ' ').trim();
  const fixed = text.replace(/\bmpesa\b/g, 'M-Pesa').replace(/\bstk\b/g, 'STK');
  return fixed.charAt(0).toUpperCase() + fixed.slice(1);
}

/** "PurchaseOrder" -> "Purchase order". */
export function areaLabel(area: string): string {
  return eventTypeLabel(area);
}

export interface EventTypeGroup { area: string; types: string[] }

/** Groups "Area.Event" types by area (the part before the dot), areas and types in name order. */
export function groupEventTypes(types: readonly string[]): EventTypeGroup[] {
  const map = new Map<string, string[]>();
  for (const t of types) {
    const area = t.includes('.') ? t.slice(0, t.indexOf('.')) : t;
    map.set(area, [...(map.get(area) ?? []), t]);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([area, list]) => ({ area, types: [...list].sort() }));
}

const entityRoutes: Record<string, (id: string) => string> = {
  Product: (id) => `/products/${id}`,
  Sale: (id) => `/sales/${id}`,
  User: (id) => `/users/${id}`,
  Supplier: (id) => `/suppliers/${id}`,
  PurchaseOrder: (id) => `/purchase-orders/${id}`,
  StockBatch: (id) => `/inventory/batches?batchId=${encodeURIComponent(id)}`,
  Customer: (id) => `/customers/${id}`,
  Expense: (id) => `/expenses/${id}`,
  Role: (id) => `/roles/${id}`,
  MpesaTransaction: () => '/mpesa',
};

/** Where an audit entry's entity lives in the app, or null when it has no page. The platform area links only to its own pages. */
export function entityLink(entityType: string | null | undefined, entityId: string | null | undefined, area: 'business' | 'platform' = 'business'): string | null {
  if (!entityType) return null;
  if (area === 'platform') return entityType === 'Business' && entityId ? `/platform/businesses/${entityId}` : null;
  const route = entityRoutes[entityType];
  if (!route) return null;
  if (!entityId && entityType !== 'MpesaTransaction') return null;
  return route(entityId ?? '');
}

/** Only same-origin app paths are followed, so a bad link can never send the user off-site. */
export function safeLink(link: string | null | undefined): string | null {
  return link && link.startsWith('/') && !link.startsWith('//') ? link : null;
}

/** Parses an API timestamp. They are UTC; one without an offset is read as UTC rather than local time. */
export function parseUtc(value: string): Date {
  return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
}

/** "just now", "5 min ago", "3 h ago", "2 d ago", then the date. */
export function relativeTime(value: string, now: Date = new Date()): string {
  const date = parseUtc(value);
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return date.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: now.getFullYear() === date.getFullYear() ? undefined : 'numeric' });
}

export function absoluteTime(value: string): string {
  return parseUtc(value).toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** The badge text: hidden at 0, "99+" above 99. */
export function badgeText(count: number | null | undefined): string | null {
  if (!count || count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}

/** Pretty-prints the event's JSON data; returns the text unchanged when it isn't JSON. */
export function prettyJson(data: string | null | undefined): string | null {
  if (!data) return null;
  try {
    return JSON.stringify(JSON.parse(data), null, 2);
  } catch {
    return data;
  }
}

/**
 * A notification's link for the area it is opened in. Licence alerts reach Super Users with the business-side "/settings/license"
 * link, which they can't open: in the platform area that becomes the licences list. Platform links are never followed from a
 * business, nor business links from the platform.
 */
export function resolveNotificationLink(link: string | null | undefined, area: 'business' | 'platform' = 'business'): string | null {
  const safe = safeLink(link);
  if (!safe) return null;
  const isPlatformLink = safe === '/platform' || safe.startsWith('/platform/');
  if (area === 'platform') {
    if (isPlatformLink) return safe;
    return safe.startsWith('/settings/license') ? '/platform/licenses' : null;
  }
  return isPlatformLink ? null : safe;
}
