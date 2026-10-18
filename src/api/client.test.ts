import { http as mswHttp, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, applyLoginResponse, clearSession } from './client';
import { tokenStorage } from './tokenStorage';
import { useSession } from '@/stores/session';
import type { LoginResponseDto } from './dto/identity';

const BASE = 'http://localhost/api/v1';

function loginResponse(token: string, refreshToken: string): LoginResponseDto {
  return {
    token,
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    refreshToken,
    refreshTokenExpiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    user: { id: 'u1', email: 'a@b.c', fullName: 'Test User', phoneNumber: null, isActive: true, isLocked: false, roles: [], permissions: [] },
    activeBusinessId: 'b1',
    businesses: [],
  };
}

let refreshCalls = 0;
const server = setupServer(
  mswHttp.post(`${BASE}/auth/refresh`, async ({ request }) => {
    refreshCalls += 1;
    const body = (await request.json()) as { refreshToken: string };
    await delay(30);
    if (body.refreshToken !== 'refresh-1') {
      return HttpResponse.json({ success: false, data: null, error: { code: 'INVALID_TOKEN', message: 'Refresh token revoked.' } }, { status: 401 });
    }
    return HttpResponse.json({ success: true, data: loginResponse('fresh', 'refresh-2'), error: null, meta: null });
  }),
  mswHttp.get(`${BASE}/thing/:id`, ({ request, params }) => {
    if (request.headers.get('Authorization') !== 'Bearer fresh') return new HttpResponse(null, { status: 401 });
    return HttpResponse.json({ success: true, data: { id: params.id }, error: null, meta: null });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  refreshCalls = 0;
  clearSession();
  applyLoginResponse({ ...loginResponse('stale', 'refresh-1') });
});

describe('api client refresh', () => {
  it('refreshes once for concurrent 401s and retries every request', async () => {
    const results = await Promise.all([api.get<{ id: string }>('/thing/1'), api.get<{ id: string }>('/thing/2'), api.get<{ id: string }>('/thing/3')]);
    expect(results.map((r) => r.id)).toEqual(['1', '2', '3']);
    expect(refreshCalls).toBe(1);
    expect(useSession.getState().accessToken).toBe('fresh');
    // The rotated refresh token replaces the old one; the old one is never sent again.
    expect(tokenStorage.getRefreshToken()).toBe('refresh-2');
  });

  it('signs out when the refresh token is rejected', async () => {
    tokenStorage.setRefreshToken('revoked');
    await expect(api.get('/thing/1')).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
    expect(useSession.getState().status).toBe('anonymous');
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });
});
