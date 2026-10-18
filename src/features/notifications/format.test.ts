import { describe, expect, it } from 'vitest';
import { EventSeverity } from '@/api/enums';
import { auditLogParams } from '@/api/endpoints/auditLog';
import { badgeText, entityLink, eventTypeLabel, groupEventTypes, prettyJson, relativeTime, safeLink, severityStyle, toSeverity } from './format';

describe('severity mapper', () => {
  it('maps numbers, numeric strings and names', () => {
    expect(toSeverity(0)).toBe(EventSeverity.Info);
    expect(toSeverity(1)).toBe(EventSeverity.Warning);
    expect(toSeverity(2)).toBe(EventSeverity.Critical);
    expect(toSeverity('2')).toBe(EventSeverity.Critical);
    expect(toSeverity('warning')).toBe(EventSeverity.Warning);
    expect(toSeverity('Critical')).toBe(EventSeverity.Critical);
  });

  it('treats unknown values as Info', () => {
    expect(toSeverity(7)).toBe(EventSeverity.Info);
    expect(toSeverity('Loud')).toBe(EventSeverity.Info);
    expect(toSeverity(null)).toBe(EventSeverity.Info);
  });

  it('gives Critical red, Warning amber and Info neutral', () => {
    expect(severityStyle(2)).toMatchObject({ label: 'Critical', badge: 'destructive', tone: 'text-destructive' });
    expect(severityStyle(1)).toMatchObject({ label: 'Warning', badge: 'warning' });
    expect(severityStyle(0)).toMatchObject({ label: 'Info', badge: 'secondary' });
  });
});

describe('eventTypeLabel', () => {
  it('turns event types into sentences', () => {
    expect(eventTypeLabel('Sale.Voided')).toBe('Sale voided');
    expect(eventTypeLabel('Stock.BelowReorderLevel')).toBe('Stock below reorder level');
    expect(eventTypeLabel('PurchaseOrder.Overdue')).toBe('Purchase order overdue');
    expect(eventTypeLabel('User.LoggedIn')).toBe('User logged in');
    expect(eventTypeLabel('Mpesa.StkPaymentFailed')).toBe('M-Pesa STK payment failed');
  });
});

describe('groupEventTypes', () => {
  it('groups by the part before the dot, sorted', () => {
    expect(groupEventTypes(['Stock.OutOfStock', 'Sale.Voided', 'Stock.Adjusted', 'Sale.Returned', 'PurchaseOrder.Overdue'])).toEqual([
      { area: 'PurchaseOrder', types: ['PurchaseOrder.Overdue'] },
      { area: 'Sale', types: ['Sale.Returned', 'Sale.Voided'] },
      { area: 'Stock', types: ['Stock.Adjusted', 'Stock.OutOfStock'] },
    ]);
  });
});

describe('entityLink', () => {
  it('builds a route for every mapped entity', () => {
    const id = '11111111-2222-3333-4444-555555555555';
    expect(entityLink('Product', id)).toBe(`/products/${id}`);
    expect(entityLink('Sale', id)).toBe(`/sales/${id}`);
    expect(entityLink('User', id)).toBe(`/users/${id}`);
    expect(entityLink('Supplier', id)).toBe(`/suppliers/${id}`);
    expect(entityLink('PurchaseOrder', id)).toBe(`/purchase-orders/${id}`);
    expect(entityLink('StockBatch', id)).toBe(`/inventory/batches?batchId=${id}`);
    expect(entityLink('Customer', id)).toBe(`/customers/${id}`);
    expect(entityLink('Expense', id)).toBe(`/expenses/${id}`);
    expect(entityLink('Role', id)).toBe(`/roles/${id}`);
    expect(entityLink('MpesaTransaction', id)).toBe('/mpesa');
  });

  it('returns null for unknown entities or a missing id', () => {
    expect(entityLink('Business', 'x')).toBeNull();
    expect(entityLink('Product', null)).toBeNull();
    expect(entityLink(null, 'x')).toBeNull();
  });
});

describe('links, badge, json, time', () => {
  it('only follows same-origin paths', () => {
    expect(safeLink('/sales/1')).toBe('/sales/1');
    expect(safeLink('https://evil.example')).toBeNull();
    expect(safeLink('//evil.example')).toBeNull();
    expect(safeLink(null)).toBeNull();
  });

  it('shows the badge as a number, 99+, or not at all', () => {
    expect(badgeText(0)).toBeNull();
    expect(badgeText(5)).toBe('5');
    expect(badgeText(99)).toBe('99');
    expect(badgeText(120)).toBe('99+');
  });

  it('pretty-prints JSON and leaves other text alone', () => {
    expect(prettyJson('{"a":1,"b":[2]}')).toBe('{\n  "a": 1,\n  "b": [\n    2\n  ]\n}');
    expect(prettyJson('not json')).toBe('not json');
    expect(prettyJson(null)).toBeNull();
  });

  it('formats relative time, reading offset-less timestamps as UTC', () => {
    const now = new Date('2026-10-18T10:00:00Z');
    expect(relativeTime('2026-10-18T09:59:30Z', now)).toBe('just now');
    expect(relativeTime('2026-10-18T09:55:00Z', now)).toBe('5 min ago');
    expect(relativeTime('2026-10-18T09:55:00', now)).toBe('5 min ago');
    expect(relativeTime('2026-10-18T07:00:00Z', now)).toBe('3 h ago');
    expect(relativeTime('2026-10-16T10:00:00Z', now)).toBe('2 d ago');
  });
});

describe('auditLogParams', () => {
  it('sends the offset with dates, drops empty filters', () => {
    const p = auditLogParams({ page: 1, pageSize: 50, from: '2026-10-12', to: '2026-10-18', eventType: 'Sale', search: '  ', minimumSeverity: 'Warning' });
    expect(p).toMatchObject({ page: 1, pageSize: 50, from: '2026-10-12', to: '2026-10-18', eventType: 'Sale', minimumSeverity: 'Warning' });
    expect(p).toHaveProperty('utcOffsetMinutes', -new Date().getTimezoneOffset());
    expect(p).not.toHaveProperty('search');
    expect(auditLogParams({ entityType: 'Sale', entityId: 'x', page: 1, pageSize: 20 })).not.toHaveProperty('utcOffsetMinutes');
  });
});
