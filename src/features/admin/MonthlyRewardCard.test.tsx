import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MonthlyDiscountScope } from '@/api/enums';
import { formatMoney } from '@/lib/format';
import { useSession } from '@/stores/session';
import { API, BUSINESS_ID, ok, renderWithProviders, signIn } from '@/test/render';
import type { BusinessDto } from '@/api/dto/business';
import { MonthlyRewardCard } from './MonthlyRewardCard';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

const business = (over: Partial<BusinessDto> = {}) =>
  ({ businessId: BUSINESS_ID, businessName: 'Aqua', maxDiscountPercent: 10, monthlyDiscountThreshold: 4000, monthlyDiscountPercent: 20,
    monthlyDiscountScope: MonthlyDiscountScope.RestOfMonth, ...over }) as BusinessDto;

let sent: unknown = null;
const server = setupServer(
  http.put(`${API}/businesses/current/monthly-discount`, async ({ request }) => {
    sent = await request.json();
    return HttpResponse.json(ok(business()));
  }),
  http.get(`${API}/businesses/current`, () => HttpResponse.json(ok(business()))),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  sent = null;
  signIn(['Businesses.Update']);
});

describe('monthly spend reward settings', () => {
  it('turning it off sends both values as null', async () => {
    useSession.setState({ business: business() });
    renderWithProviders(<MonthlyRewardCard />);
    await userEvent.click(screen.getByRole('switch', { name: 'Monthly spend reward' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sent).toEqual({ threshold: null, percent: null, scope: MonthlyDiscountScope.RestOfMonth }));
  });

  it('needs both values when on, and the sentence follows them', async () => {
    useSession.setState({ business: business({ monthlyDiscountThreshold: null, monthlyDiscountPercent: null }) });
    renderWithProviders(<MonthlyRewardCard />);
    await userEvent.click(screen.getByRole('switch', { name: 'Monthly spend reward' }));
    expect(screen.getByTestId('reward-sentence')).toHaveTextContent(`Customers who spend ${formatMoney(4000)} in a month get 20% off every purchase for the rest of that month.`);

    await userEvent.clear(screen.getByLabelText('Discount (%)'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/between 0 and 100%/)).toBeInTheDocument();
    expect(sent).toBeNull();

    await userEvent.type(screen.getByLabelText('Discount (%)'), '15');
    await userEvent.clear(screen.getByLabelText('Spend threshold (KES)'));
    await userEvent.type(screen.getByLabelText('Spend threshold (KES)'), '5000');
    await userEvent.click(screen.getByLabelText('Only the next purchase'));
    expect(screen.getByTestId('reward-sentence')).toHaveTextContent(`spend ${formatMoney(5000)} in a month get 15% off their next purchase that month.`);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sent).toEqual({ threshold: 5000, percent: 15, scope: MonthlyDiscountScope.NextPurchaseOnly }));
  });

  it('shows the API’s field message next to the field', async () => {
    server.use(http.put(`${API}/businesses/current/monthly-discount`, () =>
      HttpResponse.json({ success: false, data: null, error: { code: 'VALIDATION_FAILED', message: 'Threshold too high.', details: { threshold: ['Threshold too high.'] } }, meta: null }, { status: 400 })));
    useSession.setState({ business: business() });
    renderWithProviders(<MonthlyRewardCard />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Threshold too high.')).toBeInTheDocument();
  });
});
