import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { env } from '@/config/env';
import { useSession } from '@/stores/session';
import { useAccess } from '@/stores/access';
import { decodeLicenseWarning, isAccessCode } from '@/features/access/access';
import type { AccessCode } from './dto/platform';
import { ApiError, normaliseError } from './errors';
import { tokenStorage } from './tokenStorage';
import type { ApiEnvelope, Paged } from './dto/common';
import type { LoginResponseDto } from './dto/identity';

/** Requests without interceptors: used for refresh so a failing refresh can never recurse. */
const bare = axios.create({ baseURL: env.apiBaseUrl, headers: { 'Content-Type': 'application/json' } });

export const http = axios.create({ baseURL: env.apiBaseUrl, headers: { 'Content-Type': 'application/json' } });

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

// ---------------------------------------------------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------------------------------------------------

let refreshPromise: Promise<LoginResponseDto> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let sessionExpiredHandler: (() => void) | null = null;
let accessBlockedHandler: ((code: AccessCode, message: string | null) => void) | null = null;

/** Called once by the app to redirect to /login when the session can't be renewed. */
export function onSessionExpired(handler: () => void) {
  sessionExpiredHandler = handler;
}

/** Called once by the app to show the blocking screen when a business is suspended, closed or out of licence. */
export function onAccessBlocked(handler: (code: AccessCode, message: string | null) => void) {
  accessBlockedHandler = handler;
}

/** Records the refusal and hands it to the app. Returns true when the error was an access refusal. */
export function reportAccessBlocked(error: ApiError): boolean {
  if (error.status !== 403 || !isAccessCode(error.code)) return false;
  useAccess.getState().setBlocked({ code: error.code, message: error.message || null });
  accessBlockedHandler?.(error.code, error.message || null);
  return true;
}

function scheduleRefresh(expiresAt: string) {
  if (refreshTimer) clearTimeout(refreshTimer);
  // About a minute before the access token expires; never sooner than 5 s from now.
  const delay = Math.max(new Date(expiresAt).getTime() - Date.now() - 60_000, 5_000);
  refreshTimer = setTimeout(() => {
    refreshSession().catch(() => undefined);
  }, delay);
}

/** Stores a login, refresh or switch-business response. */
export function applyLoginResponse(data: LoginResponseDto) {
  tokenStorage.setRefreshToken(data.refreshToken);
  if (data.activeBusinessId) tokenStorage.setLastBusinessId(data.activeBusinessId);
  useSession.getState().setAuthenticated({
    accessToken: data.token,
    expiresAt: data.expiresAt,
    user: data.user,
    activeBusinessId: data.activeBusinessId,
    businesses: data.businesses ?? [],
    mustChangePassword: data.mustChangePassword ?? false,
  });
  useAccess.getState().setWarning(data.licenseWarning ? { message: data.licenseWarning } : null);
  scheduleRefresh(data.expiresAt);
}

export function clearSession() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  tokenStorage.setRefreshToken(null);
  useSession.getState().clear();
  useAccess.getState().setWarning(null);
}

function expireSession() {
  clearSession();
  sessionExpiredHandler?.();
}

/**
 * Exchanges the refresh token for a new pair. Single-flight: refresh tokens rotate, so a second refresh with the same token
 * would fail with INVALID_TOKEN. Every caller during a refresh shares the one in-flight request.
 */
export function refreshSession(): Promise<LoginResponseDto> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = tokenStorage.getRefreshToken();
  refreshPromise = (async () => {
    if (!refreshToken) throw new ApiError(401, 'INVALID_TOKEN', 'You are signed out.');
    try {
      const res = await bare.post<ApiEnvelope<LoginResponseDto>>('/auth/refresh', { refreshToken });
      const data = unwrap(res.data, res.status);
      applyLoginResponse(data);
      return data;
    } catch (error) {
      const apiError = normaliseError(error);
      // A network failure is not a rejected session: keep the user signed in and let them retry.
      if (apiError.status === 401 || apiError.code === 'INVALID_TOKEN') expireSession();
      // The business was suspended, closed or ran out of licence: the session can't be renewed in it.
      else reportAccessBlocked(apiError);
      throw apiError;
    }
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

/** Test hook: whether a refresh is in flight. */
export function isRefreshing() {
  return refreshPromise !== null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Interceptors
// ---------------------------------------------------------------------------------------------------------------------

const AUTH_PATHS = ['/auth/login', '/auth/refresh'];
const isAuthPath = (url?: string) => !!url && AUTH_PATHS.some((p) => url.toLowerCase().startsWith(p));

http.interceptors.request.use(async (config) => {
  // Requests made while a refresh is running wait for its new token instead of failing with the old one.
  if (refreshPromise && !isAuthPath(config.url)) await refreshPromise.catch(() => undefined);
  const token = useSession.getState().accessToken;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

/** X-License-Warning rides on business requests while the licence is ending or in grace; its absence means all is well. */
function trackLicenseWarning(url: string | undefined, header: unknown) {
  if (url?.toLowerCase().startsWith('/auth') || !useSession.getState().activeBusinessId) return;
  const message = decodeLicenseWarning(header);
  const access = useAccess.getState();
  if (message) {
    if (access.warning?.message !== message) access.setWarning({ message });
  } else if (access.warning) {
    access.setWarning(null);
  }
}

http.interceptors.response.use(
  (response) => {
    trackLicenseWarning(response.config.url, response.headers?.['x-license-warning']);
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const body = error.response?.data as Partial<ApiEnvelope<unknown>> | undefined | '';
    const hasErrorBody = !!body && typeof body === 'object' && !!body.error;

    // 401 without a body: the access token expired. Refresh once, then retry the request.
    if (status === 401 && !hasErrorBody && config && !config._retried && !isAuthPath(config.url)) {
      config._retried = true;
      try {
        await refreshSession();
      } catch (refreshError) {
        throw normaliseError(refreshError);
      }
      config.headers.set('Authorization', `Bearer ${useSession.getState().accessToken}`);
      return http.request(config);
    }

    const apiError = normaliseError(error);
    if (apiError.code === 'INVALID_TOKEN' && !isAuthPath(config?.url)) expireSession();
    // A switch to a blocked business is the user's own choice: the switcher shows the error instead.
    if (!config?.url?.startsWith('/auth')) reportAccessBlocked(apiError);
    throw apiError;
  },
);

// ---------------------------------------------------------------------------------------------------------------------
// Envelope helpers: the only place the { success, data, error, meta } envelope is unwrapped.
// ---------------------------------------------------------------------------------------------------------------------

function unwrap<T>(body: ApiEnvelope<T>, status: number): T {
  if (body && body.success === false && body.error) {
    throw new ApiError(status, body.error.code, body.error.message);
  }
  return (body?.data ?? null) as T;
}

type Params = object | undefined;

export const api = {
  async get<T>(url: string, params?: Params, config?: AxiosRequestConfig): Promise<T> {
    const res = await http.get<ApiEnvelope<T>>(url, { ...config, params });
    return unwrap(res.data, res.status);
  },
  async getPaged<T>(url: string, params?: Params, config?: AxiosRequestConfig): Promise<Paged<T>> {
    const res = await http.get<ApiEnvelope<T[]>>(url, { ...config, params });
    const items = unwrap(res.data, res.status) ?? [];
    const meta = res.data.meta ?? { page: 1, pageSize: items.length, totalCount: items.length, totalPages: 1 };
    return { items, meta };
  },
  async post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const res = await http.post<ApiEnvelope<T>>(url, body ?? {}, config);
    return unwrap(res.data, res.status);
  },
  async put<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const res = await http.put<ApiEnvelope<T>>(url, body ?? {}, config);
    return unwrap(res.data, res.status);
  },
  async upload<T>(url: string, file: File, params?: Params): Promise<T> {
    const form = new FormData();
    form.append('file', file);
    const res = await http.post<ApiEnvelope<T>>(url, form, { params, headers: { 'Content-Type': 'multipart/form-data' } });
    return unwrap(res.data, res.status);
  },
  /** Downloads a file response (bulk-import templates) and saves it. */
  async download(url: string, fallbackName: string): Promise<void> {
    const res = await http.get<Blob>(url, { responseType: 'blob' });
    const disposition = String(res.headers['content-disposition'] ?? '');
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    const name = match ? decodeURIComponent(match[1]) : fallbackName;
    const href = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.click();
    URL.revokeObjectURL(href);
  },
};

/** Anonymous auth calls (login) go through the bare instance: no token, no refresh. */
export const anonymousApi = {
  async post<T>(url: string, body: unknown): Promise<T> {
    try {
      const res = await bare.post<ApiEnvelope<T>>(url, body);
      return unwrap(res.data, res.status);
    } catch (error) {
      throw normaliseError(error);
    }
  },
};
