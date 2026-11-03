import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { presetRange } from '@/components/shared/DateRange';
import { StatCard } from '@/components/shared/Display';
import { SaleStatus } from '@/api/enums';
import { formatMoney } from '@/lib/format';
import { API, HEAD_OFFICE, ok, paged, renderWithProviders, signIn, WESTLANDS } from '@/test/render';
import { aging, noAging, riderOut } from '@/test/notCompletedSales';
import type { CustomerAgingReportDto, DashboardSalesDto, DashboardSummaryDto } from '@/api/dto/reports';
import type { DeliveryOrderDto } from '@/api/dto/deliveries';
import DashboardPage from '@/app/(app)/dashboard/page';

const nav = vi.hoisted(() => ({ search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const sales: DashboardSalesDto = { from: '2026-10-01', to: '2026-10-31', saleCount: 10, revenue: 50000, averageSaleValue: 5000, creditSalesAmount: 3000, voidedCount: 1, pendingCount: 0 };
const summary: DashboardSummaryDto = {
  from: '2026-10-01', to: '2026-10-31', sections: ['Sales', 'Profit', 'Receivables', 'Stock'], hiddenSections: [],
  sales,
  profit: {
    from: '2026-10-01', to: '2026-10-31', revenue: 50000, costOfGoodsSold: 8200, grossProfit: 41800, grossMarginPercent: 83.6,
    operatingExpenses: 0, netProfit: 41800, netMarginPercent: 83.6, uncostedRevenue: 0, isComplete: true,
  },
  receivables: { totalOutstanding: 3500, customersOwing: 2, totalCustomerCredit: 0, customersInCredit: 0 },
  stock: { lowStockCount: 2, outOfStockCount: 1, totalStockValue: 90000, productsMissingCost: 0 },
  production: null, customers: null,
};

let summaryData = summary;
let agingData: CustomerAgingReportDto = aging;
let riderOrders: DeliveryOrderDto[] = [riderOut];
let agingRequests: URLSearchParams[] = [];
const server = setupServer(
  http.get(`${API}/dashboard/summary`, () => HttpResponse.json(ok(summaryData))),
  http.get(`${API}/reports/customer-aging`, ({ request }) => {
    agingRequests.push(new URL(request.url).searchParams);
    return HttpResponse.json(ok(agingData));
  }),
  http.get(`${API}/delivery-orders`, () => HttpResponse.json(paged(riderOrders, 1, 100))),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  server.resetHandlers();
  nav.search = '';
  summaryData = summary;
  agingData = aging;
  riderOrders = [riderOut];
  agingRequests = [];
});

const SALES = ['Dashboard.View', 'Sales.View', 'CustomerReports.View', 'DeliveryOrders.View'];
const card = (label: string) => screen.getByText(label).closest('a, div.rounded-lg') as HTMLElement;
const notCompletedCard = async () => (await screen.findByText('Not completed')).closest('a, div.rounded-lg') as HTMLElement;

describe('Not completed card', () => {
  it('counts unpaid credit sales and rider orders out, at every branch and date, and opens the Not completed tab', async () => {
    nav.search = `branchId=${WESTLANDS.branchId}`;
    signIn(SALES, { branches: [HEAD_OFFICE, WESTLANDS] });
    renderWithProviders(<DashboardPage />);
    const c = await notCompletedCard();
    expect(await within(c).findByText('4 sale(s)')).toBeInTheDocument();
    expect(c).toHaveTextContent(`${formatMoney(3500 + 260)} · 3 on credit, 1 with a rider`);
    expect(c.tagName).toBe('A');
    expect(c).toHaveAttribute('href', `/sales?view=not-completed&branchId=${WESTLANDS.branchId}`);
    // The open invoices behind the count, never limited to the dashboard's dates or branch.
    expect(agingRequests[0].get('includeInvoices')).toBe('true');
    expect(agingRequests[0].has('from')).toBe(false);
    expect(agingRequests[0].has('branchId')).toBe(false);
  });

  it('says nothing is waiting when every sale is completed', async () => {
    agingData = noAging;
    riderOrders = [];
    signIn(SALES);
    renderWithProviders(<DashboardPage />);
    const c = await notCompletedCard();
    expect(await within(c).findByText('0 sale(s)')).toBeInTheDocument();
    expect(c).toHaveTextContent('Nothing waiting');
  });

  it('never reads a failed load as nothing waiting', async () => {
    server.use(http.get(`${API}/reports/customer-aging`, () => HttpResponse.json({ success: false, data: null, error: { code: 'X', message: 'Down' }, meta: null }, { status: 500 })));
    signIn(SALES);
    renderWithProviders(<DashboardPage />);
    const c = await notCompletedCard();
    expect(await within(c).findByText('Couldn’t load: open to see them')).toBeInTheDocument();
    expect(c).not.toHaveTextContent('Nothing waiting');
    expect(c).not.toHaveTextContent('sale(s)');
  });

  it('counts only the half the user may see', async () => {
    signIn(SALES.filter((p) => p !== 'DeliveryOrders.View'));
    renderWithProviders(<DashboardPage />);
    const c = await notCompletedCard();
    expect(await within(c).findByText('3 sale(s)')).toBeInTheDocument();
    expect(c).toHaveTextContent(`${formatMoney(3500)} · 3 on credit`);
    expect(c).not.toHaveTextContent('rider');
  });

  it('is not shown to someone who can see neither unpaid credit nor rider orders', async () => {
    signIn(['Dashboard.View', 'Sales.View']);
    renderWithProviders(<DashboardPage />);
    await screen.findByText('Revenue');
    expect(screen.queryByText('Not completed')).not.toBeInTheDocument();
    expect(agingRequests).toHaveLength(0);
  });
});

describe('dashboard cards', () => {
  it('link to the page behind each figure, with the dashboard’s dates where that page reads them', async () => {
    signIn([...SALES, 'SalesReports.View', 'Costing.View', 'Expenses.View', 'InventoryReports.View']);
    server.use(
      http.get(`${API}/reports/sales`, () => HttpResponse.json(ok({ revenue: 0, saleCount: 0, byDay: [], byPaymentMethod: [], topProducts: [] }))),
      http.get(`${API}/expenses/summary`, () => HttpResponse.json(ok({ from: '', to: '', totalExpenses: 0, expenseCount: 0, byCategory: [], byPaymentMethod: [], expensesMissingEtimsCount: 0, expensesMissingEtimsAmount: 0 }))),
    );
    renderWithProviders(<DashboardPage />);
    await screen.findByText('Revenue');
    const { from, to } = presetRange('month');
    expect(card('Revenue')).toHaveAttribute('href', `/sales?from=${from}&to=${to}`);
    expect(card('Average sale')).toHaveAttribute('href', '/reports/sales');
    expect(card('Voided / pending')).toHaveAttribute('href', `/sales?from=${from}&to=${to}&status=${SaleStatus.Voided}`);
    expect(card('Gross profit')).toHaveAttribute('href', '/reports/profit-and-loss');
    expect(card('Net profit')).toHaveAttribute('href', '/reports/profit-and-loss');
    expect(card('Operating expenses')).toHaveAttribute('href', '/expenses');
    expect(card('Customers owe')).toHaveAttribute('href', '/reports/customer-aging');
    expect(card('Low / out of stock')).toHaveAttribute('href', '/reports/stock-status');
    expect(card('Stock value')).toHaveAttribute('href', '/inventory/valuation');
    // The two drill-downs still open their lists in place.
    expect(screen.getByRole('button', { name: 'On credit: view customers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cost of goods sold: view goods' })).toBeInTheDocument();
  });

  it('opens pending sales first when some are waiting for M-Pesa', async () => {
    summaryData = { ...summary, sales: { ...sales, pendingCount: 2 } };
    signIn(SALES);
    renderWithProviders(<DashboardPage />);
    await screen.findByText('Voided / pending');
    expect(card('Voided / pending').getAttribute('href')).toContain(`status=${SaleStatus.Pending}`);
  });

  it('stay plain when the user may not open the page behind them', async () => {
    signIn(['Dashboard.View']);
    renderWithProviders(<DashboardPage />);
    await screen.findByText('Revenue');
    expect(card('Revenue').tagName).toBe('DIV');
    expect(card('Gross profit').tagName).toBe('DIV');
    expect(card('Stock value').tagName).toBe('DIV');
  });

  it('fall back to a page the user can open', async () => {
    signIn(['Dashboard.View', 'Customers.View', 'Stock.View']);
    renderWithProviders(<DashboardPage />);
    await screen.findByText('Customers owe');
    expect(card('Customers owe')).toHaveAttribute('href', '/customers');
    expect(card('Low / out of stock')).toHaveAttribute('href', '/inventory/stock');
  });
});

describe('StatCard with href', () => {
  it('is a link holding the whole card', () => {
    render(<StatCard label="Revenue" value="KES 1" hint="2 sale(s)" href="/sales" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/sales');
    expect(link).toHaveTextContent('RevenueKES 12 sale(s)');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
