import { utcOffsetMinutes } from '@/lib/format';
import { cleanParams } from '@/lib/utils';
import { api } from '../client';
import type { Guid } from '../dto/common';
import type {
  CashSessionDto, CashSessionQuery, CloseCashSessionRequestDto, OpenCashSessionRequestDto, RecordCashMovementRequestDto,
} from '../dto/cashSessions';

/** The day's float and the end-of-day count, per branch. Sessions at the branches the caller can see. */
export const cashSessionsApi = {
  list: (query: CashSessionQuery = {}) =>
    api.getPaged<CashSessionDto>('/cash-sessions', cleanParams({ ...query, utcOffsetMinutes: utcOffsetMinutes() })),
  /** The open session at the branch signed in to, or null when the day has not been opened. */
  current: () => api.get<CashSessionDto | null>('/cash-sessions/current'),
  get: (id: Guid) => api.get<CashSessionDto>(`/cash-sessions/${id}`),
  /** At the branch signed in to. 400 when one is still open there. */
  open: (body: OpenCashSessionRequestDto) => api.post<CashSessionDto>('/cash-sessions/open', body),
  /** 400 once the session is closed. */
  recordMovement: (id: Guid, body: RecordCashMovementRequestDto) => api.post<CashSessionDto>(`/cash-sessions/${id}/movements`, body),
  /** Fixes expected, counted and the variance. */
  close: (id: Guid, body: CloseCashSessionRequestDto) => api.post<CashSessionDto>(`/cash-sessions/${id}/close`, body),
};
