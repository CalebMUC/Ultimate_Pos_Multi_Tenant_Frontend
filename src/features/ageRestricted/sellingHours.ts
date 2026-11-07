import { AgeCheckMethod } from '@/api/enums';
import type { AgeRestrictedSalesSettingsDto } from '@/api/dto/business';

/** The law's age, and what the API uses when a business has not set one. */
export const DEFAULT_MINIMUM_AGE = 18;

/** "17:00:30" or "17:00" → "17:00"; blank → null. The API keeps minutes only. */
export function clockTime(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v.slice(0, 5) : null;
}

/** A window whose end is before its start runs past midnight: 17:00–02:00 covers 01:30 the next morning. */
export function runsPastMidnight(from: string | null | undefined, to: string | null | undefined): boolean {
  const f = clockTime(from);
  const t = clockTime(to);
  return !!f && !!t && t < f;
}

/**
 * The hours in words, as the settings preview shows them: "17:00–23:00 every day", "17:00–23:00 on weekdays, 14:00–23:00 at weekends",
 * or "at any time". Mirrors SellingHours.Describe in the API.
 */
export function describeSellingHours(s: Pick<AgeRestrictedSalesSettingsDto, 'weekdayFrom' | 'weekdayTo' | 'weekendFrom' | 'weekendTo'> | null | undefined): string {
  const from = clockTime(s?.weekdayFrom);
  const to = clockTime(s?.weekdayTo);
  if (!from || !to) return 'at any time';
  const weekday = `${from}–${to}`;
  const weekendFrom = clockTime(s?.weekendFrom);
  const weekendTo = clockTime(s?.weekendTo);
  if (!weekendFrom || !weekendTo || (weekendFrom === from && weekendTo === to)) return `${weekday} every day`;
  return `${weekday} on weekdays, ${weekendFrom}–${weekendTo} at weekends`;
}

/**
 * The age-check buttons, most used first: Kenyans carry the national ID; "Regular" goes last so it is never the easy tap. Fixed on
 * purpose: the order never follows the last choice, so no button becomes the habit.
 */
export const AGE_CHECK_METHODS: readonly AgeCheckMethod[] = [
  AgeCheckMethod.NationalId,
  AgeCheckMethod.DrivingLicence,
  AgeCheckMethod.Passport,
  AgeCheckMethod.OtherId,
  AgeCheckMethod.KnownCustomer,
];

/** A short line under a button where its label alone could mislead. */
export const ageCheckHints: Partial<Record<AgeCheckMethod, string>> = {
  [AgeCheckMethod.OtherId]: 'Alien card, student ID…',
  [AgeCheckMethod.KnownCustomer]: 'A regular whose ID you have seen before',
};
