import { AgeCheckMethod } from '@/api/enums';
import { round2 } from '@/lib/utils';
import type { AgeCheckRegisterEntryDto } from '@/api/dto/sales';

/** From this hour (local) a sale counts as an evening sale, when the bars fill up. */
export const EVENING_FROM_HOUR = 18;

export interface CashierAgeChecks {
  name: string;
  sales: number;
  /** Recorded as "Regular: ID seen before". */
  regular: number;
  /** regular / sales, 0–100. */
  regularShare: number;
  eveningSales: number;
  eveningRegular: number;
  /** eveningRegular / eveningSales, 0–100; null without evening sales. */
  eveningRegularShare: number | null;
}

const share = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : 0);

/** The sum of the age-restricted items on an entry (the register lists only those). */
export function restrictedTotal(entry: Pick<AgeCheckRegisterEntryDto, 'lines'>): number {
  return round2(entry.lines.reduce((sum, l) => sum + l.lineTotal, 0));
}

/**
 * Per cashier: how many sales of alcohol or tobacco they made, and how many they recorded as a regular whose ID was seen before, all
 * day and in the evening. The busiest first. A cashier who writes "regular" on most evening sales is what the owner looks for.
 */
export function cashierAgeChecks(entries: AgeCheckRegisterEntryDto[]): CashierAgeChecks[] {
  const by = new Map<string, CashierAgeChecks>();
  for (const e of entries) {
    const name = e.checkedByName?.trim() || 'Unknown';
    const row = by.get(name) ?? { name, sales: 0, regular: 0, regularShare: 0, eveningSales: 0, eveningRegular: 0, eveningRegularShare: null };
    const regular = e.ageCheck === AgeCheckMethod.KnownCustomer;
    const evening = new Date(e.soldAt).getHours() >= EVENING_FROM_HOUR;
    row.sales += 1;
    if (regular) row.regular += 1;
    if (evening) {
      row.eveningSales += 1;
      if (regular) row.eveningRegular += 1;
    }
    by.set(name, row);
  }
  return [...by.values()]
    .map((r) => ({ ...r, regularShare: share(r.regular, r.sales), eveningRegularShare: r.eveningSales ? share(r.eveningRegular, r.eveningSales) : null }))
    .sort((a, b) => b.sales - a.sales || a.name.localeCompare(b.name));
}

/** Worth a second look: most of their sales (or evening sales) were "regular", over enough sales to mean something. */
export function needsLook(c: CashierAgeChecks, minSales = 5): boolean {
  return (c.sales >= minSales && c.regularShare > 50) || (c.eveningSales >= minSales && (c.eveningRegularShare ?? 0) > 50);
}
