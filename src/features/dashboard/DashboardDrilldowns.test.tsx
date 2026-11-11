import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { presetRange } from '@/components/shared/DateRange';
import { StatCard } from '@/components/shared/Display';
import { dayBounds } from '@/features/reports/ReportLayout';
import { formatDateTime, formatMoney, formatQty } from '@/lib/format';
import { API, HEAD_OFFICE, ok, renderWithProviders, signIn, WESTLANDS } from '@/test/render';
import type { ProfitReportDto, ProfitRowDto } from '@/api/dto/inventory';
import type { DashboardCreditCustomerDto, DashboardCreditCustomersDto, DashboardSummaryDto } from '@/api/dto/reports';
import DashboardPage from '@/app/(app)/dashboard/page';

const nav = vi.hoisted(() => ({ search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const summary: DashboardSummaryDto = {
  from: '2026-10-01', to: '2026-10-31', sections: ['Sales', 'Profit'], hiddenSections: [],
  sales: { from: '2026-10-01', to: '2026-10-31', saleCount: 10, revenue: 50000, averageSaleValue: 5000, creditSalesAmount: 12500.5, voidedCount: 0, pendingCount: 0 },
  profit: {
    from: '2026-10-01', to: '2026-10-31', revenue: 50000, costOfGoodsSold: 8200, grossProfit: 41800, grossMarginPercent: 83.6,
    operatingExpenses: 0, netProfit: 41800, netMarginPercent: 83.6, uncostedRevenue: 0, isComplete: true,
  },
  receivables: null, stock: null, production: null, customers: null,
};

const customer = (over: Partial<DashboardCreditCustomerDto>): DashboardCreditCustomerDto => ({
  customerId: 'c1', customerName: 'Mama Wanjiru', phoneNumber: '254722000000', saleCount: 3, creditSalesAmount: 9000.5,
  lastSaleAt: '2026-10-21T08:00:00Z', outstandingBalance: 1500, ...over,
});
const credit: DashboardCreditCustomersDto = {
  from: '2026-10-01', to: '2026-10-31', customerCount: 3, totalCreditSales: 12500.5,
  customers: [
    customer({}),
    customer({ customerId: 'c2', customerName: 'Otieno', creditSalesAmount: 3000, outstandingBalance: 0 }),
    customer({ customerId: 'c3', customerName: 'Achieng', creditSalesAmount: 500, outstandingBalance: -200 }),
  ],
};

const product = (over: Partial<ProfitRowDto>): ProfitRowDto => ({
  productId: 'p1', productName: 'Maize flour', sku: 'MF', quantitySoldInBaseUnits: 12.5, revenue: 2000, cost: 1000, grossProfit: 1000,
  marginPercent: 50, uncostedRevenue: 0, baseUnitSymbol: 'kg', ...over,
});
// The API sorts by gross profit: the dialog has to put the biggest cost first.
const profit: ProfitReportDto = {
  from: '2026-10-01T00:00:00+03:00', to: '2026-11-01T00:00:00+03:00', totalRevenue: 50000, totalCost: 8200, grossProfit: 41800, marginPercent: 83.6, uncostedRevenue: 300,
  items: [
    product({ productId: 'p1', productName: 'Maize flour', cost: 1000, grossProfit: 9000 }),
    product({ productId: 'p2', productName: 'Cooking oil', cost: 7000, grossProfit: 5000, quantitySoldInBaseUnits: 40, baseUnitSymbol: 'l' }),
    product({ productId: 'p3', productName: 'Sugar', cost: 200, grossProfit: 100, marginPercent: null, uncostedRevenue: 300, quantitySoldInBaseUnits: -2, baseUnitSymbol: null }),
  ],
};

const FULL = ['Dashboard.View', 'Sales.View', 'Costing.View', 'Customers.View', 'Customers.ViewLedger', 'Products.View', 'CustomerReports.View'];

let creditData = credit;
let profitData = profit;
let creditRequests: URLSearchParams[] = [];
let profitRequests: URLSearchParams[] = [];
const server = setupServer(
  http.get(`${API}/dashboard/summary`, () => HttpResponse.json(ok(summary))),
  // The Not completed card (CustomerReports.View).
  http.get(`${API}/reports/customer-aging`, () => HttpResponse.json(ok({ asOf: '2026-10-31', customerCount: 0, totalOutstanding: 0, totalUnappliedCredit: 0, totals: {}, customers: [] }))),
  http.get(`${API}/dashboard/credit-customers`, ({ request }) => {
    creditRequests.push(new URL(request.url).searchParams);
    return HttpResponse.json(ok(creditData));
  }),
  http.get(`${API}/costing/profit`, ({ request }) => {
    profitRequests.push(new URL(request.url).searchParams);
    return HttpResponse.json(ok(profitData));
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  nav.search = '';
  creditData = credit;
  profitData = profit;
  creditRequests = [];
  profitRequests = [];
});

const openCredit = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Sold on credit: view customers' }));
  return screen.findByRole('dialog', { name: 'Customers on credit' });
};
const openCost = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Cost of goods sold: view goods' }));
  return screen.findByRole('dialog', { name: 'Cost of goods sold' });
};
const closeDialog = async () => {
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
};
const row = (dialog: HTMLElement, text: string) => within(dialog).getByText(text).closest('tr') as HTMLElement;
const dataRows = (dialog: HTMLElement) => within(dialog).getAllByRole('row').slice(1);

describe('dashboard drill-downs', () => {
  it('calls neither list endpoint until a card is clicked', async () => {
    signIn(FULL);
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByRole('button', { name: 'Sold on credit: view customers' })).toHaveTextContent('View customers');
    expect(screen.getByRole('button', { name: 'Cost of goods sold: view goods' })).toHaveTextContent('View goods');
    expect(creditRequests).toHaveLength(0);
    expect(profitRequests).toHaveLength(0);
  });

  it.each([
    ['Sold on credit: view customers', 'Customers on credit'],
    ['Cost of goods sold: view goods', 'Cost of goods sold'],
  ])('%s opens from the keyboard, and Esc goes back to the card', async (card, title) => {
    signIn(FULL);
    renderWithProviders(<DashboardPage />);
    const button = await screen.findByRole('button', { name: card });
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: title })).toBeInTheDocument();
    await closeDialog();
    expect(button).toHaveFocus();
  });
});

describe('on credit dialog', () => {
  it('asks for the dashboard’s dates and branch and shows the customers', async () => {
    nav.search = `branchId=${WESTLANDS.branchId}`;
    signIn(FULL, { branches: [HEAD_OFFICE, WESTLANDS] });
    renderWithProviders(<DashboardPage />);
    const dialog = await openCredit();
    const range = presetRange('month');
    expect(await within(dialog).findByText('Mama Wanjiru')).toBeInTheDocument();
    expect(creditRequests).toHaveLength(1);
    expect(creditRequests[0].get('from')).toBe(range.from);
    expect(creditRequests[0].get('to')).toBe(range.to);
    expect(creditRequests[0].get('branchId')).toBe(WESTLANDS.branchId);
    expect(creditRequests[0].has('utcOffsetMinutes')).toBe(true);
    expect(within(dialog).getByText(formatMoney(credit.totalCreditSales))).toBeInTheDocument();
    expect(within(dialog).getByText('Customers').parentElement).toHaveTextContent('3');
    expect(row(dialog, 'Mama Wanjiru')).toHaveTextContent(formatDateTime('2026-10-21T08:00:00Z'));
    expect(within(dialog).getByRole('link', { name: 'Mama Wanjiru' })).toHaveAttribute('href', '/customers/c1');
    expect(within(row(dialog, 'Mama Wanjiru')).getByRole('link', { name: '254722000000' })).toHaveAttribute('href', 'tel:254722000000');
    expect(within(dialog).getByText(/Owes now covers all branches and all dates/)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'See everyone who owes' })).toHaveAttribute('href', '/reports/customer-aging');
  });

  it('follows the dashboard’s dates when reopened', async () => {
    signIn(FULL);
    renderWithProviders(<DashboardPage />);
    await openCredit();
    await waitFor(() => expect(creditRequests).toHaveLength(1));
    await closeDialog();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Date range' }), 'today');
    await openCredit();
    await waitFor(() => expect(creditRequests).toHaveLength(2));
    expect(creditRequests[1].get('from')).toBe(presetRange('today').from);
    expect(creditRequests[1].get('to')).toBe(presetRange('today').to);
  });

  it('leaves out Owes now without Customers.ViewLedger, rather than showing 0 or Paid', async () => {
    signIn(FULL.filter((p) => p !== 'Customers.ViewLedger'));
    creditData = { ...credit, customers: credit.customers.map((c) => ({ ...c, outstandingBalance: null })) };
    renderWithProviders(<DashboardPage />);
    const dialog = await openCredit();
    await within(dialog).findByText('Mama Wanjiru');
    expect(within(dialog).queryByRole('columnheader', { name: 'Owes now' })).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Paid')).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Owes now covers/)).not.toBeInTheDocument();
  });

  it('never reads a null balance as paid, even under the column', async () => {
    signIn(FULL);
    creditData = { ...credit, customers: [customer({ outstandingBalance: null })] };
    renderWithProviders(<DashboardPage />);
    const dialog = await openCredit();
    await within(dialog).findByText('Mama Wanjiru');
    expect(within(dialog).queryByText('Paid')).not.toBeInTheDocument();
    expect(row(dialog, 'Mama Wanjiru')).toHaveTextContent('—');
  });

  it('leaves out Phone and the customer link without Customers.View', async () => {
    signIn(FULL.filter((p) => p !== 'Customers.View'));
    creditData = { ...credit, customers: credit.customers.map((c) => ({ ...c, phoneNumber: null })) };
    renderWithProviders(<DashboardPage />);
    const dialog = await openCredit();
    expect(await within(dialog).findByText('Mama Wanjiru')).toBeInTheDocument();
    expect(within(dialog).queryByRole('columnheader', { name: 'Phone' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('link', { name: 'Mama Wanjiru' })).not.toBeInTheDocument();
  });

  it('offers the customer aging report only with CustomerReports.View', async () => {
    signIn(FULL.filter((p) => p !== 'CustomerReports.View'));
    renderWithProviders(<DashboardPage />);
    const dialog = await openCredit();
    await within(dialog).findByText('Mama Wanjiru');
    expect(within(dialog).queryByRole('link', { name: 'See everyone who owes' })).not.toBeInTheDocument();
  });

  it('shows what is owed in the warning colour, 0 as Paid and a negative balance as Prepaid without the minus', async () => {
    signIn(FULL);
    renderWithProviders(<DashboardPage />);
    const dialog = await openCredit();
    await within(dialog).findByText('Mama Wanjiru');
    expect(within(row(dialog, 'Mama Wanjiru')).getByText(formatMoney(1500, { currency: false }))).toHaveClass('text-warning');
    expect(row(dialog, 'Otieno')).toHaveTextContent('Paid');
    const prepaid = row(dialog, 'Achieng');
    expect(prepaid).toHaveTextContent('Prepaid');
    expect(prepaid).toHaveTextContent(formatMoney(200, { currency: false }));
    expect(prepaid).not.toHaveTextContent(formatMoney(-200, { currency: false }));
  });

  it('says so when nobody bought on credit', async () => {
    signIn(FULL);
    creditData = { ...credit, customerCount: 0, totalCreditSales: 0, customers: [] };
    renderWithProviders(<DashboardPage />);
    const dialog = await openCredit();
    expect(await within(dialog).findByText('No credit sales in this period.')).toBeInTheDocument();
  });
});

describe('cost of goods dialog', () => {
  it('asks for the dashboard’s day bounds and branch, and sorts by cost with the unit', async () => {
    nav.search = `branchId=${WESTLANDS.branchId}`;
    signIn(FULL, { branches: [HEAD_OFFICE, WESTLANDS] });
    renderWithProviders(<DashboardPage />);
    const dialog = await openCost();
    await within(dialog).findByText('Cooking oil');
    const range = presetRange('month');
    const { start, end } = dayBounds(range.from, range.to);
    expect(profitRequests).toHaveLength(1);
    expect(profitRequests[0].get('from')).toBe(start);
    expect(profitRequests[0].get('to')).toBe(end);
    expect(profitRequests[0].get('branchId')).toBe(WESTLANDS.branchId);
    expect(within(dialog).getByText(formatMoney(profit.totalCost))).toBeInTheDocument();
    const rows = dataRows(dialog);
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['Cooking oil', 'Maize flour', 'SugarNo cost recorded']);
    expect(rows[0]).toHaveTextContent(formatQty(40, 'l'));
    expect(rows[1]).toHaveTextContent(formatQty(12.5, 'kg'));
    expect(within(dialog).getByRole('link', { name: 'Cooking oil' })).toHaveAttribute('href', '/products/p2');
    expect(within(dialog).getByRole('link', { name: 'Profit by product' })).toHaveAttribute('href', '/reports/profit');
  });

  it('warns on a row with sales that have no recorded cost, and shows a return’s negative quantity as it is', async () => {
    signIn(FULL);
    renderWithProviders(<DashboardPage />);
    const dialog = await openCost();
    await within(dialog).findByText('Sugar');
    expect(within(row(dialog, 'Sugar')).getByText('No cost recorded')).toBeInTheDocument();
    expect(row(dialog, 'Sugar')).toHaveTextContent(formatQty(-2));
    expect(within(row(dialog, 'Cooking oil')).queryByText('No cost recorded')).not.toBeInTheDocument();
  });

  it('does not link products without Products.View', async () => {
    signIn(FULL.filter((p) => p !== 'Products.View'));
    renderWithProviders(<DashboardPage />);
    const dialog = await openCost();
    expect(await within(dialog).findByText('Cooking oil')).toBeInTheDocument();
    expect(within(dialog).queryByRole('link', { name: 'Cooking oil' })).not.toBeInTheDocument();
  });

  it('says so when nothing was sold', async () => {
    signIn(FULL);
    profitData = { ...profit, items: [], totalCost: 0 };
    renderWithProviders(<DashboardPage />);
    const dialog = await openCost();
    expect(await within(dialog).findByText('No sales in this period.')).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  it('is not a button without onClick', () => {
    render(<StatCard label="Revenue" value="KES 1" hint="2 sale(s)" />);
    expect(screen.getByText('Revenue').tagName).toBe('P');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('is a real button with onClick', async () => {
    const onClick = vi.fn();
    render(<StatCard label="On credit" value="KES 1" onClick={onClick} ariaLabel="On credit: view customers" />);
    const button = screen.getByRole('button', { name: 'On credit: view customers' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
