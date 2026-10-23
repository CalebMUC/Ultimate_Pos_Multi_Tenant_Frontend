import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CustomerSegment, CustomerSuggestedAction } from '@/api/enums';
import { formatMoney } from '@/lib/format';
import { API, ok, renderWithProviders, signIn } from '@/test/render';
import type { CustomerBuyingSummaryDto, DashboardCustomersDto } from '@/api/dto/customerInsights';
import type { DashboardSummaryDto } from '@/api/dto/reports';
import DashboardPage from '@/app/(app)/dashboard/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

const wanjiru: CustomerBuyingSummaryDto = {
  customerId: 'c1', customerName: 'Mama Wanjiru', phoneNumber: '254722000000', purchaseCount: 24, totalSpent: 9600, averageSpend: 400,
  firstPurchaseAt: '2026-03-02T08:00:00Z', lastPurchaseAt: '2026-10-21T08:00:00Z', daysSinceLastPurchase: 1, averageDaysBetweenPurchases: 3.5,
  discountPercent: null, discountGiven: 0, segment: CustomerSegment.Top, suggestedAction: CustomerSuggestedAction.ConsiderDiscount, spendRank: 1,
};
const customers: DashboardCustomersDto = {
  from: '2026-07-25', to: '2026-10-22', activeCustomers: 37, newCustomers: 4, regularCustomers: 12, slippingCustomers: 5, discountCandidates: 6,
  customersWithDiscount: 3, registeredRevenue: 84500, walkInRevenue: 120300, topCustomers: [wanjiru], candidates: [wanjiru],
  slipping: [{ ...wanjiru, customerId: 'c2', customerName: 'Otieno', segment: CustomerSegment.Slipping, daysSinceLastPurchase: 21 }],
};
const summary = (c: DashboardCustomersDto | null): DashboardSummaryDto => ({
  from: '2026-10-01', to: '2026-10-22', sections: c ? ['Customers'] : [], hiddenSections: c ? [] : ['Customers'],
  sales: null, profit: null, receivables: null, stock: null, production: null, customers: c,
});

let current: DashboardSummaryDto = summary(customers);
const server = setupServer(http.get(`${API}/dashboard/summary`, () => HttpResponse.json(ok(current))));
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe('dashboard customers panel', () => {
  it('shows the API’s customer figures for the last 90 days', async () => {
    signIn(['Dashboard.View', 'Customers.ViewInsights']);
    current = summary(customers);
    renderWithProviders(<DashboardPage />);
    const panel = await screen.findByRole('region', { name: 'Customers' });
    expect(panel).toHaveTextContent('Last 90 days');
    expect(panel).toHaveTextContent('Slipping away');
    expect(panel).toHaveTextContent(formatMoney(120300));
    expect(screen.getByText('Otieno')).toBeInTheDocument();
    expect(screen.getAllByText('Mama Wanjiru').length).toBeGreaterThan(0);
  });

  it('is not shown at all when the summary has no customers section', async () => {
    signIn(['Dashboard.View']);
    current = summary(null);
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText(/Some sections are hidden/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Customers' })).not.toBeInTheDocument();
    expect(screen.queryByText('Registered vs walk-in revenue')).not.toBeInTheDocument();
  });
});
