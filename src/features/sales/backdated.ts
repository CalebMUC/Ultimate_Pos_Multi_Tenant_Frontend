import { formatDateTime } from '@/lib/format';
import type { SaleDto } from '@/api/dto/sales';

/** A sale entered later than it happened (from the paper book after a power failure): when, by whom and why. */
export function backdatedNote(s: Pick<SaleDto, 'recordedAt' | 'createdByName' | 'backdateReason'>): string {
  return `Entered ${formatDateTime(s.recordedAt)}${s.createdByName ? ` by ${s.createdByName}` : ''}${s.backdateReason ? `: ${s.backdateReason}` : ''}`;
}
