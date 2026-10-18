import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Empty strings become null, which is what the API's optional string fields expect. */
export function emptyToNull<T extends string | null | undefined>(value: T): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Drops undefined, null and empty-string values so they are not sent as query parameters. */
export function cleanParams<T extends object>(params: T | undefined): Partial<T> | undefined {
  if (!params) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

export function sum<T>(items: readonly T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + (pick(item) || 0), 0);
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
