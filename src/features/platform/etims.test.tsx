import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessKind, BusinessSector, BusinessType } from '@/api/enums';
import { API, ok, renderWithProviders, signIn } from '@/test/render';
import { ChangeEtimsDialog } from './ChangeEtimsDialog';
import { RegisterBusinessWizard } from './RegisterBusinessWizard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/platform/businesses/new',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

let registered: Record<string, unknown> | null = null;
let switched: { id: string; body: unknown } | null = null;
const server = setupServer(
  http.post(`${API}/businesses`, async ({ request }) => {
    registered = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(ok({
      business: {
        businessId: 'b9', businessName: registered.businessName, tradingName: null, kind: BusinessKind.Trader, businessType: BusinessType.Retailer,
        sector: BusinessSector.General, kraPin: registered.kraPin, isVatRegistered: registered.isVatRegistered, etimsEnabled: registered.etimsEnabled,
      },
      owner: { fullName: 'Jane Wanjiru', email: 'jane@duka.ke', created: true, temporaryPassword: 'Temp#12345' },
      trialLicense: null,
    }));
  }),
  http.put(`${API}/platform/businesses/:id/etims`, async ({ params, request }) => {
    switched = { id: params.id as string, body: await request.json() };
    return HttpResponse.json(ok({ business: { businessId: params.id }, access: {}, activeUsers: 1, createdAt: '2026-10-01T00:00:00Z' }));
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  registered = null;
  switched = null;
  signIn(['Businesses.Register', 'Businesses.ViewAll']);
});

describe('registering a business', () => {
  it('suggests eTIMS for a VAT-registered business, shows it on the review, and sends etimsEnabled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterBusinessWizard />);
    const etims = screen.getByRole('switch', { name: 'Reports to KRA eTIMS' });
    expect(etims).not.toBeChecked();

    await user.click(screen.getByRole('switch', { name: /VAT registered/ }));
    expect(etims).toBeChecked();
    await user.click(screen.getByRole('switch', { name: /VAT registered/ }));
    expect(etims).not.toBeChecked();
    await user.click(screen.getByRole('switch', { name: /VAT registered/ }));
    expect(etims).toBeChecked();

    await user.type(screen.getByLabelText(/^Registered name/), 'Duka Bora Ltd');
    await user.type(screen.getByLabelText(/^KRA PIN/), 'P051234567X');
    await user.selectOptions(screen.getByLabelText(/^Kind/), String(BusinessKind.Trader));
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await user.type(await screen.findByLabelText(/^Full name/), 'Jane Wanjiru');
    await user.type(screen.getByLabelText(/^Email/), 'jane@duka.ke');
    await user.click(screen.getByRole('button', { name: /Next/ }));

    // The review step: <dt>KRA eTIMS</dt><dd>On</dd>.
    expect((await screen.findByText('KRA eTIMS', { selector: 'dt' })).nextElementSibling).toHaveTextContent('On');
    await user.click(screen.getByRole('button', { name: 'Register business' }));
    await waitFor(() => expect(registered).not.toBeNull());
    expect(registered).toMatchObject({ businessName: 'Duka Bora Ltd', isVatRegistered: true, etimsEnabled: true });
    expect(await screen.findByText(/its admin registers each branch’s device/)).toBeInTheDocument();
  }, 15_000); // Two steps of typing: slow when the whole suite runs at once.

  it('keeps the switch editable: a VAT-registered business can still go without eTIMS', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterBusinessWizard />);
    await user.click(screen.getByRole('switch', { name: /VAT registered/ }));
    await user.click(screen.getByRole('switch', { name: 'Reports to KRA eTIMS' }));
    expect(screen.getByRole('switch', { name: 'Reports to KRA eTIMS' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: /VAT registered/ })).toBeChecked();
  });
});

describe('switching eTIMS for an existing business', () => {
  it('turns it on', async () => {
    const onChanged = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    renderWithProviders(<ChangeEtimsDialog businessId="b1" name="Duka Bora" enabled={false} onOpenChange={onOpenChange} onChanged={onChanged} />);
    expect(screen.getByText(/Duka Bora will start reporting to KRA from now/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Turn eTIMS on' }));
    await waitFor(() => expect(switched).toEqual({ id: 'b1', body: { enabled: true } }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('turns it off', async () => {
    renderWithProviders(<ChangeEtimsDialog businessId="b1" name="Duka Bora" enabled onOpenChange={vi.fn()} onChanged={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByText(/Sales made while it is off are never reported/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Turn eTIMS off' }));
    await waitFor(() => expect(switched).toEqual({ id: 'b1', body: { enabled: false } }));
  });
});
