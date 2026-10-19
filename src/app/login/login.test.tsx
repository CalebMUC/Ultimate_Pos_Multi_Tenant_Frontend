import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession } from '@/api/client';
import { tokenStorage } from '@/api/tokenStorage';
import { useSession } from '@/stores/session';
import { API, BUSINESS_ID, HEAD_OFFICE, ok, renderWithProviders, WESTLANDS } from '@/test/render';
import type { LoginResponseDto } from '@/api/dto/identity';
import LoginPage from './page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/login',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

let branches = [HEAD_OFFICE, WESTLANDS];
let loginBodies: Record<string, unknown>[] = [];
let switchBody: Record<string, unknown> | null = null;

function response(activeBranchId: string, token = 'token-1'): LoginResponseDto {
  return {
    token,
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    refreshToken: `refresh-${token}`,
    refreshTokenExpiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    user: { id: 'u1', email: 'cashier@afya.ke', fullName: 'Amina Cashier', phoneNumber: null, isActive: true, isLocked: false, roles: ['Cashier'], permissions: ['Sales.Create'] },
    activeBusinessId: BUSINESS_ID,
    businesses: [{ businessId: BUSINESS_ID, businessName: 'Afya Pharmacy', tradingName: null, kind: 1, businessType: 1, isDefault: true }],
    activeBranchId,
    branches,
  };
}

const server = setupServer(
  http.post(`${API}/auth/Login`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    loginBodies.push(body);
    return HttpResponse.json(ok(response(String(body.branchId ?? branches[0].branchId))));
  }),
  http.post(`${API}/auth/switch-branch`, async ({ request }) => {
    switchBody = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(ok(response(String(switchBody.branchId), 'token-2')));
  }),
  http.get(`${API}/businesses/current`, () => HttpResponse.json(ok({ businessId: BUSINESS_ID, businessName: 'Afya Pharmacy' }))),
  http.get(`${API}/auth/me`, () => HttpResponse.json(ok({ user: response(HEAD_OFFICE.branchId).user, activeBusinessId: BUSINESS_ID, businesses: [], branches }))),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  clearSession();
  branches = [HEAD_OFFICE, WESTLANDS];
  loginBodies = [];
  switchBody = null;
  replace.mockReset();
  localStorage.clear();
});

async function signIn() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'cashier@afya.ke');
  await user.type(screen.getByLabelText('Password'), 'Secret123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return user;
}

describe('choosing the branch at sign-in', () => {
  it('asks where the user works today, in the sign-in card, and switches to the chosen branch', async () => {
    renderWithProviders(<LoginPage />);
    const user = await signIn();

    expect(await screen.findByRole('heading', { name: 'Where are you working today?' })).toBeInTheDocument();
    // Signed in at the default for now, and marked as such.
    expect(screen.getByRole('button', { name: /Head Office/ })).toHaveAttribute('aria-current', 'true');
    expect(replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Westlands/ }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/pos'));
    expect(switchBody).toMatchObject({ branchId: WESTLANDS.branchId, refreshToken: 'refresh-token-1' });
    expect(useSession.getState().activeBranchId).toBe(WESTLANDS.branchId);
    expect(tokenStorage.getLastBranchId(BUSINESS_ID)).toBe(WESTLANDS.branchId);
  });

  it('keeps the branch already signed in to without another call', async () => {
    renderWithProviders(<LoginPage />);
    const user = await signIn();
    await user.click(await screen.findByRole('button', { name: /Head Office/ }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/pos'));
    expect(switchBody).toBeNull();
  });

  it('sends the branch remembered from last time, and falls back when it can no longer be used', async () => {
    tokenStorage.setLastBusinessId(BUSINESS_ID);
    tokenStorage.setLastBranchId(BUSINESS_ID, 'closed-branch');
    server.use(http.post(`${API}/auth/Login`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      loginBodies.push(body);
      if (body.branchId === 'closed-branch') {
        return HttpResponse.json({ success: false, data: null, error: { code: 'FORBIDDEN', message: 'You do not work at that branch, or it has been closed.' } }, { status: 403 });
      }
      return HttpResponse.json(ok(response(HEAD_OFFICE.branchId)));
    }));
    renderWithProviders(<LoginPage />);
    await signIn();
    expect(await screen.findByRole('heading', { name: 'Where are you working today?' })).toBeInTheDocument();
    expect(loginBodies.map((b) => b.branchId)).toEqual(['closed-branch', null]);
    expect(loginBodies.every((b) => b.businessId === BUSINESS_ID)).toBe(true);
  });

  it('goes straight in for a user with one branch', async () => {
    branches = [HEAD_OFFICE];
    renderWithProviders(<LoginPage />);
    await signIn();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/pos'));
    expect(screen.queryByRole('heading', { name: 'Where are you working today?' })).not.toBeInTheDocument();
  });
});
