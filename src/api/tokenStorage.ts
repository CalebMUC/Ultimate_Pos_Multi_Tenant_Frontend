// The access token lives only in memory (session store). The refresh token is kept in localStorage, or in sessionStorage on
// shared tills (a client preference), so it does not outlive the browser tab there.
const REFRESH_KEY = 'upos.refreshToken';
const MODE_KEY = 'upos.refreshTokenStorage';
const LAST_BUSINESS_KEY = 'upos.lastBusinessId';

export type RefreshTokenStorageMode = 'local' | 'session';

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function getStorageMode(): RefreshTokenStorageMode {
  return safe(() => (localStorage.getItem(MODE_KEY) === 'session' ? 'session' : 'local'), 'local');
}

function store(): Storage {
  return getStorageMode() === 'session' ? sessionStorage : localStorage;
}

export const tokenStorage = {
  getRefreshToken(): string | null {
    return safe(() => store().getItem(REFRESH_KEY), null);
  },
  setRefreshToken(token: string | null) {
    safe(() => {
      if (token) store().setItem(REFRESH_KEY, token);
      else {
        localStorage.removeItem(REFRESH_KEY);
        sessionStorage.removeItem(REFRESH_KEY);
      }
    }, undefined);
  },
  /** Moves the current refresh token to the chosen storage. */
  setMode(mode: RefreshTokenStorageMode) {
    safe(() => {
      const token = this.getRefreshToken();
      localStorage.removeItem(REFRESH_KEY);
      sessionStorage.removeItem(REFRESH_KEY);
      localStorage.setItem(MODE_KEY, mode);
      if (token) store().setItem(REFRESH_KEY, token);
    }, undefined);
  },
  getLastBusinessId(): string | null {
    return safe(() => localStorage.getItem(LAST_BUSINESS_KEY), null);
  },
  setLastBusinessId(id: string | null) {
    safe(() => (id ? localStorage.setItem(LAST_BUSINESS_KEY, id) : localStorage.removeItem(LAST_BUSINESS_KEY)), undefined);
  },
};
