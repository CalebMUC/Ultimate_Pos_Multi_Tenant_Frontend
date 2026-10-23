import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CustomerDiscountSource, MonthlyDiscountScope, PriceType } from '@/api/enums';
import { formatMoney } from '@/lib/format';
import { emptyCart, useCartStore } from '@/stores/cart';
import { API, BUSINESS_ID, ok, paged, renderWithProviders, signIn } from '@/test/render';
import type { CreateSaleRequestDto, SalePreviewDto } from '@/api/dto/sales';
import { PosPage } from './PosPage';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/pos',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

/** Priced by the "API" with the customer's 5%: already inside discountTotal and the line's discountAmount. */
function previewOf(body: CreateSaleRequestDto): SalePreviewDto {
  const lines = body.lines.map((l) => ({
    productId: l.productId, productName: 'Water (refill)', sku: 'WTR', unitOfMeasureId: l.unitOfMeasureId, quantity: l.quantity, unitPrice: 200,
    lineTotal: 190 * l.quantity, availableInBaseUnits: 500, requiredInBaseUnits: 20 * l.quantity, stockSufficient: true, discountAmount: 10 * l.quantity,
    taxRate: 0, taxAmount: 0, requiresPrescription: false, isBatchTracked: false,
  }));
  return {
    customerId: body.customerId, priceType: PriceType.Retail, totalAmount: 380, allStockSufficient: true, lines, subtotal: 400, discountTotal: 20, taxTotal: 0,
    requiresPrescription: false, customerBalance: 0, creditLimit: null, creditLimitExceeded: false, customerDiscountPercent: 5, customerDiscountTotal: 20,
  };
}

/** The monthly-reward variants: the totals here are the API's and deliberately not re-derivable from the lines. */
function monthlyPreview(body: CreateSaleRequestDto, qualifies: boolean): SalePreviewDto {
  return {
    ...previewOf(body), totalAmount: 160, discountTotal: qualifies ? 40 : 0, customerDiscountPercent: qualifies ? 20 : null,
    customerDiscountTotal: qualifies ? 40 : 0, customerDiscountSource: qualifies ? CustomerDiscountSource.MonthlySpend : null,
    customerMonth: {
      month: '2026-10', spent: qualifies ? 4200 : 3800, threshold: 4000, percent: 20, scope: MonthlyDiscountScope.RestOfMonth,
      remainingToThreshold: qualifies ? 0 : 200, qualifies,
    },
  };
}

let sent: CreateSaleRequestDto | null = null;
const server = setupServer(
  http.get(`${API}/products/get-products`, () => HttpResponse.json(paged([]))),
  http.post(`${API}/sales/preview`, async ({ request }) => HttpResponse.json(ok(previewOf((await request.json()) as CreateSaleRequestDto)))),
  http.post(`${API}/sales`, async ({ request }) => {
    sent = (await request.json()) as CreateSaleRequestDto;
    return HttpResponse.json(ok({ saleId: 's1', saleNumber: 'INV-1', status: 1, lines: [], totalAmount: 380, discountTotal: 20, customerDiscountAmount: 20 }));
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe('POS customer discount', () => {
  it('shows the customer discount from the preview, and a cashier without the discount permission can charge', async () => {
    signIn(['Sales.Create', 'Sales.View']);
    useCartStore.setState({
      carts: {
        [BUSINESS_ID]: {
          ...emptyCart(), customerId: 'c1', customerName: 'Mama Wanjiru', customerDiscountPercent: 5,
          lines: [{ key: 'k1', productId: 'water', productName: 'Water (refill)', sku: 'WTR', unitOfMeasureId: '20L', quantity: 2, discountAmount: null,
            discountPercent: null, isBatchTracked: false, requiresPrescription: false, units: [{ unitOfMeasureId: '20L', symbol: '20L' }] }],
        },
      },
      held: {},
    });
    renderWithProviders(<PosPage />);

    expect(await screen.findByText('Customer discount (5%)')).toBeInTheDocument();
    expect(screen.getByText(`−${formatMoney(20)}`)).toBeInTheDocument();
    // All of discountTotal is the customer's: no second "Discount" line taking it off again.
    expect(screen.queryByText('Discount', { selector: 'dt' })).not.toBeInTheDocument();
    expect(screen.getByText(/5% loyalty discount/)).toBeInTheDocument();

    const charge = screen.getByRole('button', { name: /Charge/ });
    await waitFor(() => expect(charge).toBeEnabled());
    await userEvent.click(charge);
    await userEvent.click(await screen.findByRole('button', { name: 'Exact' }));
    await userEvent.click(screen.getByRole('button', { name: /Complete sale/ }));
    await waitFor(() => expect(sent).not.toBeNull());
    // Nothing typed: the request carries no discount of its own (the API applies the customer's).
    expect(sent!.discountAmount).toBeNull();
    expect(sent!.lines[0]).toMatchObject({ discountAmount: null, discountPercent: null });
  });

  const setCart = () => useCartStore.setState({
    carts: {
      [BUSINESS_ID]: {
        ...emptyCart(), customerId: 'c1', customerName: 'Mama Wanjiru',
        lines: [{ key: 'k1', productId: 'water', productName: 'Water (refill)', sku: 'WTR', unitOfMeasureId: '20L', quantity: 1, discountAmount: null,
          discountPercent: null, isBatchTracked: false, requiresPrescription: false, units: [{ unitOfMeasureId: '20L', symbol: '20L' }] }],
      },
    },
    held: {},
  });

  it('shows the month’s progress and no reward until the customer qualifies', async () => {
    server.use(http.post(`${API}/sales/preview`, async ({ request }) => HttpResponse.json(ok(monthlyPreview((await request.json()) as CreateSaleRequestDto, false)))));
    signIn(['Sales.Create', 'Sales.View']);
    setCart();
    renderWithProviders(<PosPage />);
    expect(await screen.findByText((_, el) => el?.tagName === 'P' && !!el.textContent?.includes(`${formatMoney(200)} to unlock 20% off`))).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Spent this month' })).toHaveAttribute('aria-valuenow', '3800');
    expect(screen.queryByText(/monthly reward applied/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Monthly reward \(/)).not.toBeInTheDocument();
  });

  it('labels the line as the monthly reward with the API’s amount once it applies', async () => {
    server.use(http.post(`${API}/sales/preview`, async ({ request }) => HttpResponse.json(ok(monthlyPreview((await request.json()) as CreateSaleRequestDto, true)))));
    signIn(['Sales.Create', 'Sales.View']);
    setCart();
    renderWithProviders(<PosPage />);
    expect(await screen.findByText('20% monthly reward applied')).toBeInTheDocument();
    expect(screen.getByText('Monthly reward (20%)')).toBeInTheDocument();
    expect(screen.getByText(`−${formatMoney(40)}`)).toBeInTheDocument();
    expect(screen.queryByText(/Customer discount/)).not.toBeInTheDocument();
    // The total is the API's 160, not anything the lines would add up to.
    expect(screen.getByRole('button', { name: /Charge/ })).toHaveTextContent(formatMoney(160));
  });
});
