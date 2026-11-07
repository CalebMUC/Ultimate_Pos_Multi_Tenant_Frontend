import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentMethod, PriceType, SaleStatus, labels } from '@/api/enums';
import { emptyCart, useCartStore, type BackdateMode, type Cart } from '@/stores/cart';
import { API, BUSINESS_ID, ok, paged, renderWithProviders, signIn } from '@/test/render';
import type { CreateSaleRequestDto, SaleDto, SalePreviewDto } from '@/api/dto/sales';
import SalesPage from '@/app/(app)/sales/page';
import { RolesScreen } from '@/features/admin/RolesScreen';
import {
  backdateBounds, DEFAULT_BACKDATE_REASON, defaultSoldAt, eatWallClock, formatBackdate, toSoldAt, validateBackdate,
} from './Backdate';
import { toSaleRequest } from './cartActions';
import { PosPage } from './PosPage';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/pos',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

// 09:10 UTC on Saturday 7 November 2026 is 12:10 in Nairobi.
const NOW = new Date('2026-11-07T09:10:00Z');

describe('backdate rules', () => {
  it('works in East Africa Time: from midnight three days ago to now', () => {
    expect(eatWallClock(NOW)).toBe('2026-11-07T12:10');
    expect(backdateBounds(NOW)).toEqual({ min: '2026-11-04T00:00', max: '2026-11-07T12:10' });
    expect(defaultSoldAt(NOW)).toBe('2026-11-07T12:00');
    expect(toSoldAt('2026-11-05T14:30')).toBe('2026-11-05T14:30:00+03:00');
    expect(formatBackdate('2026-11-05T14:30')).toBe('Thu 5 Nov 14:30');
  });

  it('accepts a time in the last three days with a reason, and nothing else', () => {
    const check = (soldAt: string, reason = DEFAULT_BACKDATE_REASON) => validateBackdate({ soldAt, reason }, NOW);
    expect(check('2026-11-05T14:30')).toEqual({});
    expect(check('2026-11-04T00:00')).toEqual({});
    expect(check('2026-11-03T23:59').soldAt).toMatch(/up to 3 days, to Wed 4 Nov 00:00/);
    expect(check('2026-11-07T13:00').soldAt).toMatch(/future/);
    // Within a minute of now the API records an ordinary sale.
    expect(check('2026-11-07T12:10').soldAt).toMatch(/in the past/);
    expect(check('').soldAt).toMatch(/Pick the date/);
    expect(check('2026-11-05T14:30', '  ').reason).toMatch(/Say why/);
    expect(check('2026-11-05T14:30', 'x'.repeat(201)).reason).toMatch(/200 characters/);
  });

  it('dates the request only in backdate mode', () => {
    const cart: Cart = { ...emptyCart(), lines: [] };
    expect(toSaleRequest(cart)).not.toHaveProperty('soldAt');
    expect(toSaleRequest(cart, {}, false, { soldAt: '2026-11-05T14:30', reason: ' Power failure ' })).toMatchObject({
      soldAt: '2026-11-05T14:30:00+03:00', backdateReason: 'Power failure',
    });
  });
});

// ---------------------------------------------------------------- At the till

/** Yesterday at this time, Nairobi wall clock: always inside the window. */
const yesterday = () => eatWallClock(new Date(Date.now() - 24 * 3600_000));

let previews: CreateSaleRequestDto[] = [];
let sent: CreateSaleRequestDto | null = null;
function previewOf(body: CreateSaleRequestDto): SalePreviewDto {
  return {
    customerId: null, priceType: PriceType.Retail, totalAmount: 130, allStockSufficient: false, subtotal: 130, discountTotal: 0, taxTotal: 0,
    requiresPrescription: false, customerBalance: null, creditLimit: null, creditLimitExceeded: false, soldAt: body.soldAt ? '2026-11-05T11:30:00Z' : null,
    // What the shelf held then: 3 of the 40 needed. The business allows selling below zero, so it warns but does not block.
    lines: body.lines.map((l) => ({ productId: l.productId, productName: 'Water (refill)', sku: 'WTR', unitOfMeasureId: l.unitOfMeasureId, quantity: l.quantity,
      unitPrice: 65, lineTotal: 130, availableInBaseUnits: 3, requiredInBaseUnits: 40, stockSufficient: false, discountAmount: 0, taxRate: 0, taxAmount: 0,
      requiresPrescription: false, isBatchTracked: false })),
  };
}
const server = setupServer(
  http.get(`${API}/products/get-products`, () => HttpResponse.json(paged([]))),
  http.post(`${API}/sales/preview`, async ({ request }) => {
    const body = (await request.json()) as CreateSaleRequestDto;
    previews.push(body);
    return HttpResponse.json(ok(previewOf(body)));
  }),
  http.post(`${API}/sales`, async ({ request }) => {
    sent = (await request.json()) as CreateSaleRequestDto;
    return HttpResponse.json(ok({ saleId: 's1', saleNumber: 'INV-000042', status: SaleStatus.Completed, lines: [], totalAmount: 130, discountTotal: 0,
      createdAt: '2026-11-05T11:30:00Z', recordedAt: '2026-11-07T09:10:00Z', backdateReason: DEFAULT_BACKDATE_REASON }));
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  previews = [];
  sent = null;
});

function setTill(paymentMethod: PaymentMethod, backdate?: BackdateMode) {
  useCartStore.setState({
    carts: {
      [BUSINESS_ID]: {
        ...emptyCart(), paymentMethod,
        lines: [{ key: 'k1', productId: 'water', productName: 'Water (refill)', sku: 'WTR', unitOfMeasureId: '20L', quantity: 2, discountAmount: null,
          discountPercent: null, isBatchTracked: false, requiresPrescription: false, units: [{ unitOfMeasureId: '20L', symbol: '20L' }] }],
      },
    },
    held: {},
    backdate: backdate ? { [BUSINESS_ID]: backdate } : {},
  });
}

const SELLER = ['Sales.Create', 'Sales.View'];
const MANAGER = [...SELLER, 'Sales.Backdate'];
const banner = () => screen.queryByRole('status', { name: 'Entering past sales' });

describe('POS: entering past sales', () => {
  it('is not offered without Sales.Backdate, and a mode left on is ignored', async () => {
    signIn(SELLER);
    setTill(PaymentMethod.Cash, { soldAt: yesterday(), reason: DEFAULT_BACKDATE_REASON });
    renderWithProviders(<PosPage />);

    await waitFor(() => expect(previews.length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: 'Enter past sales' })).not.toBeInTheDocument();
    expect(banner()).not.toBeInTheDocument();
    expect(previews.at(-1)).not.toHaveProperty('soldAt');
    expect(screen.getByRole('radio', { name: labels.paymentMethod[PaymentMethod.MpesaStkPush] })).toBeInTheDocument();
  });

  it('turns on from the dialog, refusing a time more than three days back', async () => {
    signIn(MANAGER);
    setTill(PaymentMethod.MpesaStkPush);
    renderWithProviders(<PosPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Enter past sales' }));
    const dialog = await screen.findByRole('dialog');
    const when = within(dialog).getByLabelText('When the sale was made');
    expect(within(dialog).getByLabelText('Reason')).toHaveValue(DEFAULT_BACKDATE_REASON);

    fireEvent.change(when, { target: { value: eatWallClock(new Date(Date.now() - 5 * 24 * 3600_000)) } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Start entering' }));
    expect(within(dialog).getByText(/backdated up to 3 days/)).toBeInTheDocument();

    const soldAt = yesterday();
    fireEvent.change(when, { target: { value: soldAt } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Start entering' }));

    expect(await screen.findByRole('status', { name: 'Entering past sales' })).toHaveTextContent(formatBackdate(soldAt));
    expect(useCartStore.getState().backdate?.[BUSINESS_ID]).toEqual({ soldAt, reason: DEFAULT_BACKDATE_REASON });
    // The customer paid at the time: no STK push, and the cart moved off it.
    expect(screen.queryByRole('radio', { name: labels.paymentMethod[PaymentMethod.MpesaStkPush] })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: labels.paymentMethod[PaymentMethod.Cash] })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('button', { name: 'Enter past sales' })).not.toBeInTheDocument();
  });

  it('dates every sale and its preview at that time, shows the stock then, and stays on for the next slip', async () => {
    const soldAt = yesterday();
    signIn(MANAGER);
    setTill(PaymentMethod.Cash, { soldAt, reason: DEFAULT_BACKDATE_REASON });
    renderWithProviders(<PosPage />);

    expect(await screen.findByText(new RegExp(`in stock at ${formatBackdate(soldAt)}`))).toBeInTheDocument();
    expect(previews.at(-1)).toMatchObject({ soldAt: toSoldAt(soldAt), backdateReason: DEFAULT_BACKDATE_REASON });
    expect(screen.getByText(`Past sale, dated ${formatBackdate(soldAt)}`)).toBeInTheDocument();

    const charge = screen.getByRole('button', { name: /Charge/ });
    await waitFor(() => expect(charge).toBeEnabled());
    await userEvent.click(charge);
    expect(await screen.findByText(`Dated ${formatBackdate(soldAt)} (past sale)`)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Exact' }));
    await userEvent.click(screen.getByRole('button', { name: /Complete sale/ }));

    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent).toMatchObject({ soldAt: toSoldAt(soldAt), backdateReason: DEFAULT_BACKDATE_REASON, paymentMethod: PaymentMethod.Cash });
    // The receipt says it was entered later.
    expect(await screen.findByText(/\(backdated\)/)).toBeInTheDocument();
    // Next slip: still in the mode until Done (behind the receipt, which hides the page from the accessibility tree while it is open).
    expect(screen.getByRole('status', { name: 'Entering past sales', hidden: true })).toBeInTheDocument();
    expect(useCartStore.getState().backdate?.[BUSINESS_ID]?.soldAt).toBe(soldAt);
  });

  it('keeps the cart and shows the API’s message when there was not enough stock then', async () => {
    server.use(http.post(`${API}/sales`, () => HttpResponse.json(
      { success: false, data: null, error: { code: 'INSUFFICIENT_STOCK', message: "Not enough stock at Thu 5 Nov 14:30 for: 'Water (refill)' (3 available, 40 needed).", details: null }, meta: null },
      { status: 409 },
    )));
    signIn(MANAGER);
    setTill(PaymentMethod.Cash, { soldAt: yesterday(), reason: DEFAULT_BACKDATE_REASON });
    renderWithProviders(<PosPage />);

    const charge = screen.getByRole('button', { name: /Charge/ });
    await waitFor(() => expect(charge).toBeEnabled());
    await userEvent.click(charge);
    await userEvent.click(await screen.findByRole('button', { name: 'Exact' }));
    await userEvent.click(screen.getByRole('button', { name: /Complete sale/ }));

    expect(await screen.findByText(/3 available, 40 needed/)).toBeInTheDocument();
    expect(useCartStore.getState().carts[BUSINESS_ID].lines).toHaveLength(1);
  });

  it('keeps the cart and shows the API’s message when that time’s drawer is already closed', async () => {
    const message = 'The cash sale falls in cash session CS-0012, which has already been counted and closed. Enter past cash sales before closing the drawer.';
    server.use(http.post(`${API}/sales`, () => HttpResponse.json(
      { success: false, data: null, error: { code: 'INVALID_ASSIGNMENT', message, details: null }, meta: null },
      { status: 400 },
    )));
    signIn(MANAGER);
    setTill(PaymentMethod.Cash, { soldAt: yesterday(), reason: DEFAULT_BACKDATE_REASON });
    renderWithProviders(<PosPage />);

    const charge = screen.getByRole('button', { name: /Charge/ });
    await waitFor(() => expect(charge).toBeEnabled());
    await userEvent.click(charge);
    await userEvent.click(await screen.findByRole('button', { name: 'Exact' }));
    await userEvent.click(screen.getByRole('button', { name: /Complete sale/ }));

    expect(await screen.findByText(/CS-0012, which has already been counted and closed/)).toBeInTheDocument();
    expect(useCartStore.getState().carts[BUSINESS_ID].lines).toHaveLength(1);
    expect(useCartStore.getState().backdate?.[BUSINESS_ID]).toBeDefined();
  });

  it('turns off with Done', async () => {
    signIn(MANAGER);
    setTill(PaymentMethod.Cash, { soldAt: yesterday(), reason: DEFAULT_BACKDATE_REASON });
    renderWithProviders(<PosPage />);

    await userEvent.click(within(banner()!).getByRole('button', { name: 'Done' }));
    expect(banner()).not.toBeInTheDocument();
    expect(useCartStore.getState().backdate?.[BUSINESS_ID]).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Enter past sales' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------- The sales list

describe('Sales list: backdated sales', () => {
  it('tags a backdated sale and filters to them', async () => {
    const late = {
      saleId: 's1', saleNumber: 'INV-000042', status: SaleStatus.Completed, paymentMethod: PaymentMethod.Cash, lines: [], totalAmount: 130,
      returnedAmount: 0, createdAt: '2026-11-05T11:30:00Z', recordedAt: '2026-11-07T09:10:00Z', createdByName: 'Wanjiku',
      backdateReason: DEFAULT_BACKDATE_REASON,
    } as unknown as SaleDto;
    const requests: URLSearchParams[] = [];
    server.use(http.get(`${API}/sales`, ({ request }) => {
      requests.push(new URL(request.url).searchParams);
      return HttpResponse.json(paged([late]));
    }));
    signIn(['Sales.View']);
    renderWithProviders(<SalesPage />);

    const tag = await screen.findByText('Backdated');
    expect(tag.closest('[title]')).toHaveAttribute('title', expect.stringContaining(`by Wanjiku: ${DEFAULT_BACKDATE_REASON}`));
    expect(requests.at(-1)?.has('backdated')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: /Backdated only/ }));
    await waitFor(() => expect(requests.at(-1)?.get('backdated')).toBe('true'));
  });
});

// ---------------------------------------------------------------- Roles

describe('Roles: Sales.Backdate', () => {
  it('is listed under Sales with what it allows', async () => {
    server.use(
      http.get(`${API}/roles`, () => HttpResponse.json(ok([
        { roleId: 'r1', roleName: 'Manager', description: null, isActive: true, isSystemRole: false, permissions: ['Sales.Backdate'] },
      ]))),
      http.get(`${API}/permissions`, () => HttpResponse.json(ok([
        { permissionId: 'p1', name: 'Sales.Create', module: 'Sales', isActive: true },
        { permissionId: 'p2', name: 'Sales.Backdate', module: 'Sales', isActive: true },
      ]))),
    );
    signIn(['Roles.View', 'Permissions.View']);
    renderWithProviders(<RolesScreen />);

    const sales = (await screen.findByText('Sales', { selector: 'legend label' })).closest('fieldset')!;
    const backdate = within(sales).getByText('Backdate').closest('label')!;
    expect(backdate).toHaveTextContent('Enter sales made up to 3 days ago (e.g. after a power failure)');
    expect(within(backdate).getByRole('checkbox')).toBeChecked();
  });
});
