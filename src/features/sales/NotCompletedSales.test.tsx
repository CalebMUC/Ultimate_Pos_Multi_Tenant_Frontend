import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentMethod, SaleStatus } from '@/api/enums';
import { formatDateOnly, formatMoney } from '@/lib/format';
import { API, ok, paged, renderWithProviders, signIn } from '@/test/render';
import { aging, noAging, riderOut } from '@/test/notCompletedSales';
import type { CustomerAgingReportDto } from '@/api/dto/reports';
import SalesPage from '@/app/(app)/sales/page';

const nav = vi.hoisted(() => ({ search: '', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
  usePathname: () => '/sales',
  useSearchParams: () => new URLSearchParams(nav.search),
}));

let agingData: CustomerAgingReportDto = aging;
let salesRequests: URLSearchParams[] = [];
let riderRequests: URLSearchParams[] = [];
const server = setupServer(
  http.get(`${API}/reports/customer-aging`, () => HttpResponse.json(ok(agingData))),
  http.get(`${API}/delivery-orders`, ({ request }) => {
    riderRequests.push(new URL(request.url).searchParams);
    const size = Number(new URL(request.url).searchParams.get('pageSize'));
    return HttpResponse.json(paged([riderOut], 1, size));
  }),
  http.get(`${API}/sales`, ({ request }) => {
    salesRequests.push(new URL(request.url).searchParams);
    return HttpResponse.json(paged([]));
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  nav.search = '';
  nav.push.mockReset();
  agingData = aging;
  salesRequests = [];
  riderRequests = [];
});

const ALL = ['Sales.View', 'CustomerReports.View', 'DeliveryOrders.View'];
const creditSection = () => screen.getByRole('region', { name: 'On credit, not paid yet' });

describe('Not completed tab', () => {
  it('opens from ?view=not-completed and counts every sale still to complete', async () => {
    nav.search = 'view=not-completed';
    signIn(ALL);
    renderWithProviders(<SalesPage />);
    const tab = screen.getByRole('tab', { name: /Not completed/ });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(tab).toHaveTextContent('Not completed4'));
    expect(await screen.findByRole('region', { name: 'Out with a rider' })).toBeInTheDocument();
    expect(await within(screen.getByRole('region', { name: 'Out with a rider' })).findByText('DEL-000001')).toBeInTheDocument();
  });

  it('searches the orders out with a rider on the server, still only those out', async () => {
    nav.search = 'view=not-completed';
    signIn(ALL);
    renderWithProviders(<SalesPage />);
    const region = await screen.findByRole('region', { name: 'Out with a rider' });
    await userEvent.type(within(region).getByRole('textbox', { name: 'Search' }), 'kamau');
    await waitFor(() => expect(riderRequests.some((p) => p.get('search') === 'kamau' && p.get('status') !== null)).toBe(true));
  });

  it('lists unpaid credit sales oldest first, with what is still owed and an overdue promise', async () => {
    nav.search = 'view=not-completed';
    signIn(ALL);
    renderWithProviders(<SalesPage />);
    const section = creditSection();
    await within(section).findByText('INV-000004');
    const rows = within(section).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['INV-000004', 'INV-000010', 'INV-000012']);
    expect(rows[0]).toHaveTextContent('Otieno');
    expect(rows[0]).toHaveTextContent(formatDateOnly('2026-10-15'));
    expect(within(rows[0]).getByText('Overdue')).toBeInTheDocument();
    expect(rows[0]).toHaveTextContent(formatMoney(1500, { currency: false }));
    expect(within(rows[1]).queryByText('Overdue')).not.toBeInTheDocument();
    expect(within(rows[1]).getByRole('link', { name: 'INV-000010' })).toHaveAttribute('href', '/sales/s1');
  });

  it('opens the customer to record their payment', async () => {
    nav.search = 'view=not-completed';
    signIn(ALL);
    renderWithProviders(<SalesPage />);
    await userEvent.click(await within(creditSection()).findByText('Otieno'));
    expect(nav.push).toHaveBeenCalledWith('/customers/c2');
  });

  it('says so when every credit sale is paid', async () => {
    nav.search = 'view=not-completed';
    agingData = noAging;
    signIn(ALL);
    renderWithProviders(<SalesPage />);
    expect(await within(creditSection()).findByText('No unpaid credit sales')).toBeInTheDocument();
  });

  it('shows only the half the user may see', async () => {
    nav.search = 'view=not-completed';
    signIn(['Sales.View', 'CustomerReports.View']);
    renderWithProviders(<SalesPage />);
    expect(await within(creditSection()).findByText('INV-000004')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Out with a rider' })).not.toBeInTheDocument();
  });

  it('has no tabs for someone who can see neither half, even from the link', async () => {
    nav.search = 'view=not-completed';
    signIn(['Sales.View']);
    renderWithProviders(<SalesPage />);
    await waitFor(() => expect(salesRequests).toHaveLength(1));
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });
});

describe('Sales list from a dashboard link', () => {
  it('starts with the dates, status and payment method in the URL', async () => {
    nav.search = `from=2026-10-01&to=2026-10-31&status=${SaleStatus.Voided}&paymentMethod=${PaymentMethod.Credit}`;
    signIn(['Sales.View']);
    renderWithProviders(<SalesPage />);
    await waitFor(() => expect(salesRequests).toHaveLength(1));
    const q = salesRequests[0];
    expect(q.get('from')).toBe('2026-10-01');
    expect(q.get('to')).toBe('2026-10-31');
    expect(q.get('status')).toBe(String(SaleStatus.Voided));
    expect(q.get('paymentMethod')).toBe(String(PaymentMethod.Credit));
  });

  it('ignores filters it does not recognise', async () => {
    nav.search = 'from=yesterday&to=2026-10-31&status=9';
    signIn(['Sales.View']);
    renderWithProviders(<SalesPage />);
    await waitFor(() => expect(salesRequests).toHaveLength(1));
    expect(salesRequests[0].get('from')).not.toBe('yesterday');
    expect(salesRequests[0].has('status')).toBe(false);
  });
});
