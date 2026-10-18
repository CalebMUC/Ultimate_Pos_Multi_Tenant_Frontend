import { addDays, todayIso, toIsoDate } from '@/lib/format';
import type { AccessCode, AccessStatus } from '@/api/dto/platform';

/** 403 codes that refuse a whole business: shown as a full-page blocking screen, never a toast. */
export const ACCESS_CODES: readonly AccessCode[] = ['BUSINESS_SUSPENDED', 'BUSINESS_CLOSED', 'LICENSE_EXPIRED', 'UNLICENSED'];

export function isAccessCode(code: unknown): code is AccessCode {
  return typeof code === 'string' && (ACCESS_CODES as readonly string[]).includes(code);
}

export interface AccessScreen { title: string; description: string; showReason: boolean }

/** What the blocking screen says for each refusal. The API's message (with the suspension reason) is shown under it when relevant. */
export function accessScreen(code: string | null | undefined): AccessScreen {
  switch (code) {
    case 'BUSINESS_SUSPENDED':
      return { title: 'This business is suspended', description: 'Its users can’t work in it until it is reactivated.', showReason: true };
    case 'BUSINESS_CLOSED':
      return { title: 'This business has been closed', description: 'It no longer runs on Ultimate POS. Its records are kept.', showReason: false };
    case 'LICENSE_EXPIRED':
      return { title: 'The licence has expired', description: 'Renew to continue.', showReason: true };
    case 'UNLICENSED':
      return { title: 'This business has no licence yet', description: 'It can be used once a licence is issued.', showReason: true };
    default:
      return { title: 'This business can’t be used right now', description: 'Contact the Ultimate POS team.', showReason: true };
  }
}

export interface AccessStatusStyle { label: string; className: string }

const statusStyles: Record<AccessStatus, AccessStatusStyle> = {
  Active: { label: 'Active', className: 'border-transparent bg-success/15 text-success' },
  ExpiringSoon: { label: 'Expiring soon', className: 'border-transparent bg-warning/20 text-warning-foreground dark:text-warning' },
  GracePeriod: { label: 'Grace period', className: 'border-transparent bg-orange-500/20 text-orange-700 dark:text-orange-300' },
  Expired: { label: 'Expired', className: 'border-transparent bg-destructive/15 text-destructive' },
  Unlicensed: { label: 'Unlicensed', className: 'border-transparent bg-destructive/15 text-destructive' },
  Suspended: { label: 'Suspended', className: 'border-destructive bg-transparent text-destructive' },
  Closed: { label: 'Closed', className: 'border-transparent bg-muted text-muted-foreground' },
};

/** Badge colours: Active green, ExpiringSoon amber, GracePeriod orange, Expired/Unlicensed red, Suspended red outline, Closed grey. */
export function accessStatusStyle(status: string | null | undefined): AccessStatusStyle {
  return statusStyles[status as AccessStatus] ?? { label: status || 'Unknown', className: 'border-transparent bg-muted text-muted-foreground' };
}

/** Statuses whose users are refused. */
export function isBlockedStatus(status: string | null | undefined): boolean {
  return status === 'Expired' || status === 'Unlicensed' || status === 'Suspended' || status === 'Closed';
}

export const ACCESS_STATUSES: readonly AccessStatus[] = ['Active', 'ExpiringSoon', 'GracePeriod', 'Expired', 'Unlicensed', 'Suspended', 'Closed'];

/** X-License-Warning is URL-encoded by the API. Returns null for a missing or empty header. */
export function decodeLicenseWarning(header: unknown): string | null {
  if (typeof header !== 'string' || header.trim() === '') return null;
  try {
    return decodeURIComponent(header.replace(/\+/g, ' ')).trim() || null;
  } catch {
    return header.trim();
  }
}

/** Red during the grace period, amber before the licence ends. The header carries only text, so the wording decides when no status is known. */
export function warningTone(message: string, status?: string | null): 'grace' | 'expiring' {
  if (status === 'GracePeriod') return 'grace';
  if (status === 'ExpiringSoon') return 'expiring';
  return /\bended on\b|access stops/i.test(message) ? 'grace' : 'expiring';
}

// ---- Licence period preview (mirrors PlatformService.IssueLicenseAsync) ----

/** .NET DateOnly.AddMonths: the day is clamped to the end of a shorter month (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsClamped(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return toIsoDate(new Date(target.getFullYear(), target.getMonth(), Math.min(d, lastDay)));
}

export interface LicensePeriodInput {
  months?: number | null;
  startsOn?: string | null;
  endsOn?: string | null;
  /** The business's current licence end date (LicenseEndsOn). */
  currentEndsOn?: string | null;
  today?: string;
}

export type LicensePeriod =
  | { ok: true; startsOn: string; endsOn: string; renewal: boolean; days: number }
  | { ok: false; error: string };

/**
 * The period the API will record. Start: the given date, else the day after the current licence if it hasn't lapsed (a renewal),
 * else today. End: the given date, else start + months − 1 day.
 */
export function computeLicensePeriod(input: LicensePeriodInput): LicensePeriod {
  const today = input.today ?? todayIso();
  const months = input.months ?? null;
  const endsOnGiven = input.endsOn || null;
  if (months !== null && endsOnGiven) return { ok: false, error: 'Give either months or an end date, not both.' };
  if (months === null && !endsOnGiven) return { ok: false, error: 'Give the number of months (1–36) or an end date.' };
  if (months !== null && (!Number.isInteger(months) || months < 1 || months > 36)) return { ok: false, error: 'Months must be between 1 and 36.' };

  const renewal = !input.startsOn && !!input.currentEndsOn && input.currentEndsOn >= today;
  const startsOn = input.startsOn || (renewal ? addDays(input.currentEndsOn!, 1) : today);
  const endsOn = endsOnGiven ?? addDays(addMonthsClamped(startsOn, months!), -1);
  if (endsOn < startsOn) return { ok: false, error: 'The end date must be on or after the start date.' };
  const days = Math.round((Date.parse(`${endsOn}T00:00:00Z`) - Date.parse(`${startsOn}T00:00:00Z`)) / 86_400_000) + 1;
  return { ok: true, startsOn, endsOn, renewal, days };
}

/** Days from today to a date-only value (negative once past). */
export function daysUntil(iso: string | null | undefined, today: string = todayIso()): number | null {
  if (!iso) return null;
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
