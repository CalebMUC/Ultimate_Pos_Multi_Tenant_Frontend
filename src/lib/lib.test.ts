import { describe, expect, it } from 'vitest';
import { hasPermission } from '@/hooks/useSessionInfo';
import { flattenCategories } from '@/hooks/useLookups';
import { capabilitiesFor } from '@/config/businessCapabilities';
import { BusinessKind } from '@/api/enums';
import { dayBounds } from '@/features/reports/ReportLayout';
import { toCsv } from './csv';
import { addDays, formatDateOnly, formatMoney } from './format';
import { cleanParams, emptyToNull, round2 } from './utils';

describe('hasPermission', () => {
  it('treats a list as any-of and no requirement as allowed', () => {
    expect(hasPermission(['Sales.View'], undefined)).toBe(true);
    expect(hasPermission(['Sales.View'], 'Sales.View')).toBe(true);
    expect(hasPermission(['Sales.View'], 'Sales.Void')).toBe(false);
    expect(hasPermission(['Categories.BulkImport'], ['Products.BulkImport', 'Categories.BulkImport'])).toBe(true);
  });
});

describe('capabilities', () => {
  it('gives production to manufacturers only', () => {
    expect(capabilitiesFor(BusinessKind.Manufacturer).production).toBe(true);
    expect(capabilitiesFor(BusinessKind.Trader).production).toBe(false);
    expect(capabilitiesFor(null).production).toBe(false);
  });
});

describe('formatting', () => {
  it('shows null money as a dash, never zero', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(1250)).toBe('KES 1,250.00');
    expect(formatMoney(1250, { currency: false })).toBe('1,250.00');
  });

  it('does not shift date-only values through a time zone', () => {
    expect(formatDateOnly('2026-01-01')).toContain('2026');
    expect(formatDateOnly('2026-01-01')).toMatch(/01/);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('rounds to cents', () => {
    expect(round2(1.005)).toBe(1.01);
  });
});

describe('utils', () => {
  it('turns blank text into null', () => {
    expect(emptyToNull('  ')).toBeNull();
    expect(emptyToNull(' a ')).toBe('a');
    expect(emptyToNull(undefined)).toBeNull();
  });

  it('drops empty query parameters but keeps false and 0', () => {
    expect(cleanParams({ a: '', b: undefined, c: null, d: false, e: 0, f: 'x' })).toEqual({ d: false, e: 0, f: 'x' });
  });
});

describe('csv', () => {
  it('quotes commas, quotes and newlines', () => {
    const csv = toCsv([{ a: 'x,y', b: 'say "hi"', c: 'l1\nl2', d: null }], [
      { header: 'A', value: (r) => r.a }, { header: 'B', value: (r) => r.b }, { header: 'C', value: (r) => r.c }, { header: 'D', value: (r) => r.d },
    ]);
    expect(csv).toBe('A,B,C,D\r\n"x,y","say ""hi""","l1\nl2",');
  });
});

describe('flattenCategories', () => {
  it('walks the tree depth-first in name order with paths', () => {
    const flat = flattenCategories([
      { categoryId: '2', name: 'Medicines', code: 'MED', parentCategoryId: null, isActive: true, subcategories: [
        { categoryId: '3', name: 'Antibiotics', code: 'ABX', parentCategoryId: '2', isActive: true, subcategories: [] },
      ] },
      { categoryId: '1', name: 'Cosmetics', code: 'COS', parentCategoryId: null, isActive: true, subcategories: [] },
    ]);
    expect(flat.map((c) => [c.name, c.depth])).toEqual([['Cosmetics', 0], ['Medicines', 0], ['Antibiotics', 1]]);
    expect(flat[2].path).toBe('Medicines › Antibiotics');
  });
});

describe('dayBounds', () => {
  it('covers whole local days, end exclusive', () => {
    const { start, end } = dayBounds('2026-10-01', '2026-10-01');
    expect(new Date(end).getTime() - new Date(start).getTime()).toBe(24 * 3600 * 1000);
  });
});
