import { AxiosError } from 'axios';
import type { ApiErrorBody } from './dto/common';

/** Error codes the API returns (§4.3). Others may appear; treat unknown codes by HTTP status. */
export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'INVALID_ASSIGNMENT'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_TOKEN'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INSUFFICIENT_STOCK'
  | 'CREDIT_LIMIT_EXCEEDED'
  | 'USER_EXISTS'
  | 'BUSINESS_EXISTS'
  | 'DUPLICATE'
  | 'PURCHASE_NOT_ALLOWED'
  | 'PRESCRIPTION_REQUIRED'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'NO_PERMISSION'
  | 'UNKNOWN';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | string;
  /** Field path (react-hook-form style: lines.0.quantity) to messages. */
  readonly fieldErrors: Record<string, string[]>;

  constructor(status: number, code: string, message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  hasFieldErrors(): boolean {
    return Object.keys(this.fieldErrors).length > 0;
  }
}

/** "lines[0].quantity" -> "lines.0.quantity", the path react-hook-form uses. */
export function toFormPath(apiPath: string): string {
  return apiPath.replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '');
}

function normaliseDetails(details: Record<string, string[]> | null | undefined): Record<string, string[]> {
  if (!details) return {};
  const out: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(details)) {
    if (!messages?.length) continue;
    out[toFormPath(key)] = messages;
  }
  return out;
}

function isEnvelopeError(body: unknown): body is { error: ApiErrorBody } {
  return !!body && typeof body === 'object' && 'error' in body && !!(body as { error: unknown }).error
    && typeof (body as { error: { code?: unknown } }).error.code === 'string';
}

/** ASP.NET ProblemDetails, in case a framework error bypasses the envelope. */
function isProblemDetails(body: unknown): body is { title?: string; detail?: string; errors?: Record<string, string[]> } {
  return !!body && typeof body === 'object' && ('title' in body || 'errors' in body);
}

const defaultMessages: Record<number, [string, string]> = {
  401: ['UNAUTHORIZED', 'Your session has expired. Please sign in again.'],
  403: ['NO_PERMISSION', "You don't have permission to do this."],
  404: ['NOT_FOUND', 'Not found.'],
  500: ['INTERNAL_ERROR', 'Something went wrong on the server. Please try again.'],
};

/** Turns any thrown value into an ApiError. Handles the envelope (with or without details), empty bodies and network failures. */
export function normaliseError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof AxiosError) {
    if (!error.response) {
      if (error.code === AxiosError.ERR_CANCELED) return new ApiError(0, 'CANCELLED', 'Request cancelled.');
      return new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.');
    }
    const { status, data } = error.response;
    if (isEnvelopeError(data)) {
      return new ApiError(status, data.error.code, data.error.message, normaliseDetails(data.error.details));
    }
    if (isProblemDetails(data)) {
      const fieldErrors = normaliseDetails(data.errors);
      const first = Object.values(fieldErrors)[0]?.[0];
      return new ApiError(status, status === 400 ? 'VALIDATION_FAILED' : 'UNKNOWN', first ?? data.detail ?? data.title ?? 'Request failed.', fieldErrors);
    }
    const [code, message] = defaultMessages[status] ?? (status >= 500 ? defaultMessages[500] : ['UNKNOWN', `Request failed (${status}).`]);
    return new ApiError(status, code, message);
  }
  if (error instanceof Error) return new ApiError(0, 'UNKNOWN', error.message);
  return new ApiError(0, 'UNKNOWN', 'Something went wrong.');
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}
