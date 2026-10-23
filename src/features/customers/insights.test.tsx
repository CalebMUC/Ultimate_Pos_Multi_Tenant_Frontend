import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerInsightsSort, CustomerSegment, CustomerSuggestedAction } from '@/api/enums';
import { API, ok, paged, renderWithProviders, signIn } from '@/test/render';
import type { CustomerBuyingSummaryDto } from '@/api/dto/customerInsights';
import InsightsPage from '@/app/(app)/customers/insights/page';
import { DiscountDialog } from './insights';

let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/customers/insights',
  useSearchParams: () => searchParams,
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

const fail = (status: number, code: string, message: string, details: Record<string, string[]> | null = null) =>
  HttpResponse.json({ success: false, data: null, error: { code, message, details }, meta: null }, { status });

const row = (over: Partial<CustomerBuyingSummaryDto>): CustomerBuyingSummaryDto => ({
  customerId: 'c', customerName: '', phoneNumber: '0722000000', purchaseCount: 10, totalSpent: 4000, averageSpend: 400, firstPurchaseAt: '2026-03-02T08:00:00Z',
  lastPurchaseAt: '2026-10-21T08:00:00Z', daysSinceLastPurchase: 1, averageDaysBetweenPurchases: 3.5, discountPercent: null, discountGiven: 0,
  segment: CustomerSegment.Regular, suggestedAction: CustomerSuggestedAction.None, spendRank: 1, ...over,
});

let discountBody: unknown = null;
let listUrls: URL[] = [];
const server = setupServer(
  http.put(`${API}/customers/c1/discount`, async ({ request }) => {
    discountBody = await request.json();
    const body = discountBody as { discountPercent: number | null };
    if (body.discountPercent !== null && body.discountPercent > 15) return fail(400, 'VALIDATION_FAILED', 'At most 15% (the business’s maximum discount).', { discountPercent: ['At most 15% (the business’s maximum discount).'] });
    return HttpResponse.json(ok({ customerId: 'c1', customerName: 'Mama Wanjiru', discountPercent: body.discountPercent }));
  }),
  http.get(`${API}/customers/insights`, ({ request }) => {
    const url = new URL(request.url);
    listUrls.push(url);
    // Recent first, as the API sorted them: rank 2 before rank 1.
    return HttpResponse.json(paged([
      row({ customerId: 'b', customerName: 'Baraka', spendRank: 2, totalSpent: 3000 }),
      row({ customerId: 'a', customerName: 'Akinyi', spendRank: 1, totalSpent: 9600, segment: CustomerSegment.Top, suggestedAction: CustomerSuggestedAction.ConsiderDiscount }),
    ]));
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  discountBody = null;
  listUrls = [];
  searchParams = new URLSearchParams();
});

const target = { customerId: 'c1', customerName: 'Mama Wanjiru', discountPercent: null, maxDiscountPercent: 15 };

describe('discount dialog', () => {
  beforeEach(() => signIn(['Customers.ManageDiscount']));

  it('needs a note before it saves anything, and shows the cap', async () => {
    renderWithProviders(<DiscountDialog target={target} open onOpenChange={vi.fn()} />);
    expect(screen.getByText('The business allows at most 15%.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Discount (%)'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/a note is required/)).toBeInTheDocument();
    expect(discountBody).toBeNull();

    await userEvent.type(screen.getByLabelText('Why *'), 'Buys 20L every 3 days since March');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(discountBody).toEqual({ discountPercent: 5, note: 'Buys 20L every 3 days since March' }));
  });

  it('shows the API’s refusal above the cap', async () => {
    renderWithProviders(<DiscountDialog target={target} open onOpenChange={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Discount (%)'), '20');
    await userEvent.type(screen.getByLabelText('Why *'), 'Big buyer');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/At most 15%/)).toBeInTheDocument();
  });

  it('removes a discount by sending null', async () => {
    renderWithProviders(<DiscountDialog target={{ ...target, discountPercent: 5, discountNote: 'Loyal' }} open onOpenChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove discount' }));
    await waitFor(() => expect(discountBody).toEqual({ discountPercent: null, note: null }));
  });
});

describe('buying insights list', () => {
  beforeEach(() => signIn(['Customers.ViewInsights', 'Customers.ManageDiscount']));

  it('sends the filters and the sort to the API and keeps its order', async () => {
    searchParams = new URLSearchParams({ segment: String(CustomerSegment.Slipping) });
    renderWithProviders(<InsightsPage />);
    await screen.findByText('Baraka');
    expect(listUrls.at(-1)!.searchParams.get('segment')).toBe(String(CustomerSegment.Slipping));
    expect(listUrls.at(-1)!.searchParams.get('sort')).toBe(String(CustomerInsightsSort.Spend));

    await userEvent.selectOptions(screen.getByLabelText('Sort'), String(CustomerInsightsSort.Recent));
    await userEvent.click(screen.getByRole('button', { name: 'Top customer', pressed: false }));
    await waitFor(() => {
      const url = listUrls.at(-1)!;
      expect(url.searchParams.get('sort')).toBe(String(CustomerInsightsSort.Recent));
      expect(url.searchParams.get('segment')).toBe(String(CustomerSegment.Top));
    });

    // Rows stay in the API's order: no re-ranking here.
    const table = screen.getByRole('table');
    const names = within(table).getAllByRole('row').slice(1).map((r) => r.textContent ?? '');
    expect(names[0]).toContain('Baraka');
    expect(names[1]).toContain('Akinyi');
    expect(within(table).getByRole('button', { name: /Give discount/ })).toBeInTheDocument();
  });
});
