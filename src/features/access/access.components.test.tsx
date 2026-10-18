import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, onAccessBlocked } from '@/api/client';
import { addDays, todayIso } from '@/lib/format';
import { useAccess } from '@/stores/access';
import { useSession } from '@/stores/session';
import { API, BUSINESS_ID, ok, renderWithProviders, signIn } from '@/test/render';
import { AuthGuard } from '@/features/auth/AuthGuard';
import { RegisterBusinessWizard } from '@/features/platform/RegisterBusinessWizard';
import { ReasonDialog } from '@/features/platform/ReasonDialog';
import { BlockedScreen } from './BlockedScreen';
import { isDismissedToday, LicenseBanner } from './LicenseBanner';

const replace = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/sales',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

const suspended = { success: false, data: null, error: { code: 'BUSINESS_SUSPENDED', message: 'Test Ltd is suspended: Licence fee unpaid. Contact the Ultimate POS team.' } };
const warningText = 'The licence ends on 2026-10-25 (7 days left). Renew to avoid interruption.';
let registerBody: Record<string, unknown> | null = null;

const server = setupServer(
  http.get(`${API}/sales`, () => HttpResponse.json(suspended, { status: 403 })),
  http.get(`${API}/products/get-products`, () => HttpResponse.json(ok([]), { headers: { 'X-License-Warning': encodeURIComponent(warningText) } })),
  http.get(`${API}/stock`, () => HttpResponse.json(ok([]))),
  http.post(`${API}/businesses`, async ({ request }) => {
    registerBody = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(ok({
      business: { businessId: 'nb1', businessName: 'Mama Mboga Ltd', tradingName: null, kind: 1, businessType: 1, kraPin: 'P051234567X', isActive: true },
      owner: { userId: 'o1', email: 'wanjiku@example.co.ke', fullName: 'Wanjiku Kamau', created: true, temporaryPassword: 'Tmp-7Kq9-xP2' },
      trialLicense: { endsOn: '2026-11-01' },
    }));
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  signIn(['Sales.View', 'Businesses.View', 'Businesses.Register']);
  useAccess.setState({ blocked: null, warning: null });
  registerBody = null;
  replace.mockReset();
  push.mockReset();
});

function SalesProbe() {
  const q = useQuery({ queryKey: ['sales', BUSINESS_ID], queryFn: () => api.get('/sales') });
  return <p>{q.status}</p>;
}

describe('access refusals', () => {
  it('a 403 BUSINESS_SUSPENDED from any query lands on the blocking screen', async () => {
    const handler = vi.fn();
    onAccessBlocked(handler);
    renderWithProviders(<SalesProbe />);
    await waitFor(() => expect(handler).toHaveBeenCalledWith('BUSINESS_SUSPENDED', suspended.error.message));
    expect(useAccess.getState().blocked).toEqual({ code: 'BUSINESS_SUSPENDED', message: suspended.error.message });

    renderWithProviders(<BlockedScreen code="BUSINESS_SUSPENDED" />);
    expect(screen.getByRole('heading', { name: 'This business is suspended' })).toBeInTheDocument();
    expect(screen.getByText(suspended.error.message)).toBeInTheDocument();
    // Once in the API's message, once as the contact line.
    expect(screen.getAllByText(/Contact the Ultimate POS team/)).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Sign out/ })).toBeInTheDocument();
  });

  it('offers the user’s other businesses, with blocked ones disabled', async () => {
    useSession.setState({
      businesses: [
        ...useSession.getState().businesses,
        { businessId: 'b2', businessName: 'Second Ltd', tradingName: null, kind: 1, businessType: 1, isDefault: false, accessStatus: 'Active' },
        { businessId: 'b3', businessName: 'Closed Ltd', tradingName: null, kind: 1, businessType: 1, isDefault: false, accessStatus: 'Closed' },
      ],
    });
    renderWithProviders(<BlockedScreen code="LICENSE_EXPIRED" />);
    expect(screen.getByText('Switch business')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Second Ltd/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Closed Ltd/ })).toBeDisabled();
  });
});

describe('licence banner', () => {
  it('appears from the X-License-Warning header and dismisses for the day', async () => {
    renderWithProviders(<LicenseBanner />);
    expect(screen.queryByTestId('license-banner')).not.toBeInTheDocument();

    await act(() => api.getPaged('/products/get-products'));
    const banner = await screen.findByTestId('license-banner');
    expect(banner).toHaveTextContent(warningText);
    expect(banner).toHaveAttribute('data-tone', 'expiring');

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss for today' }));
    expect(screen.queryByTestId('license-banner')).not.toBeInTheDocument();
    expect(isDismissedToday(BUSINESS_ID)).toBe(true);
    // Tomorrow it comes back.
    expect(isDismissedToday(BUSINESS_ID, addDays(todayIso(), 1))).toBe(false);
  });

  it('clears when business requests stop carrying the header', async () => {
    useAccess.setState({ warning: { message: warningText } });
    await api.get('/stock');
    expect(useAccess.getState().warning).toBeNull();
  });
});

describe('forced password change', () => {
  it('blocks navigation until the password is changed', async () => {
    useSession.setState({ mustChangePassword: true });
    renderWithProviders(<AuthGuard><p>Sales screen</p></AuthGuard>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/change-password?returnTo=${encodeURIComponent('/sales')}`));
    expect(screen.queryByText('Sales screen')).not.toBeInTheDocument();
  });

  it('lets the user through once it is done', () => {
    useSession.setState({ mustChangePassword: false });
    renderWithProviders(<AuthGuard><p>Sales screen</p></AuthGuard>);
    expect(screen.getByText('Sales screen')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('register wizard', () => {
  it('registers with the owner and shows the temporary password once', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterBusinessWizard />);
    await user.type(screen.getByLabelText(/Registered name/), 'Mama Mboga Ltd');
    await user.type(screen.getByLabelText(/KRA PIN/), 'P051234567X');
    await user.click(screen.getByRole('button', { name: /Next/ }));

    await user.type(await screen.findByLabelText(/Full name/), 'Wanjiku Kamau');
    await user.type(screen.getByLabelText(/^Email/), 'wanjiku@example.co.ke');
    await user.click(screen.getByRole('button', { name: /Next/ }));

    expect(await screen.findByText('Generated, shown once after registering')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Register business' }));

    expect(await screen.findByTestId('temporary-password')).toHaveTextContent('Tmp-7Kq9-xP2');
    expect(screen.getByText(/won’t be shown again/)).toBeInTheDocument();
    expect(registerBody).toMatchObject({ businessName: 'Mama Mboga Ltd', kraPin: 'P051234567X', owner: { fullName: 'Wanjiku Kamau', email: 'wanjiku@example.co.ke', password: null } });

    // Leaving the panel discards it: it can't be shown again.
    await user.click(screen.getByRole('button', { name: 'Register another' }));
    expect(screen.queryByText('Tmp-7Kq9-xP2')).not.toBeInTheDocument();
  });
});

describe('suspend', () => {
  it('requires a reason', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    renderWithProviders(
      <ReasonDialog open onOpenChange={onOpenChange} title="Suspend Test Ltd?" description="Its 3 users will be signed out and refused." confirmLabel="Suspend business" onConfirm={onConfirm} />,
    );
    expect(screen.getByText(/Its 3 users will be signed out and refused/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Suspend business' }));
    expect(screen.getByText('A reason is required.')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Reason/), '  Licence fee unpaid  ');
    await user.click(screen.getByRole('button', { name: 'Suspend business' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('Licence fee unpaid'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
