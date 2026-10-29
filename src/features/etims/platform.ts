import type { PlatformEtimsBusinessRowDto } from '@/api/dto/etims';
import { parseUtc } from '@/features/notifications/format';

const HOUR = 60 * 60_000;

/** How long a problem has waited: amber over an hour, red over a day. */
export function problemTone(at: string | null, now = Date.now()): string {
  if (!at) return '';
  const age = now - parseUtc(at).getTime();
  return age > 24 * HOUR ? 'font-medium text-destructive' : age > HOUR ? 'font-medium text-warning' : '';
}

/** The platform's overview order: problems first, the oldest problem first; then by name. */
export function sortByProblem(rows: readonly PlatformEtimsBusinessRowDto[]): PlatformEtimsBusinessRowDto[] {
  return [...rows].sort((a, b) => {
    if (!!a.oldestProblemAt !== !!b.oldestProblemAt) return a.oldestProblemAt ? -1 : 1;
    if (a.oldestProblemAt && b.oldestProblemAt && a.oldestProblemAt !== b.oldestProblemAt) {
      return parseUtc(a.oldestProblemAt).getTime() - parseUtc(b.oldestProblemAt).getTime();
    }
    return a.businessName.localeCompare(b.businessName);
  });
}
