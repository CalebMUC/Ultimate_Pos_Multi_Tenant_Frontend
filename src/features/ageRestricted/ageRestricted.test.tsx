import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgeCheckMethod, BusinessSector, DeliveryMode, DeliveryOrderStatus, ItemType, PaymentMethod, PriceType, SaleStatus, TaxClassification } from '@/api/enums';
import { emptyCart, useCartStore, type CartLine } from '@/stores/cart';
import { useSession } from '@/stores/session';
import { API, BUSINESS_ID, HEAD_OFFICE, ok, paged, renderWithProviders, signIn } from '@/test/render';
import type { BusinessDto } from '@/api/dto/business';
import type { ProductDto } from '@/api/dto/catalog';
import type { DeliveryOrderDto } from '@/api/dto/deliveries';
import type { AgeCheckRegisterEntryDto, CreateSaleRequestDto, SaleDto, SalePreviewDto } from '@/api/dto/sales';
import { ProductFlags } from '@/components/shared/Display';
import { PosPage } from '@/features/pos/PosPage';
import { PaymentDialog } from '@/features/pos/PaymentDialog';
import { RecordDeliveryDialog } from '@/features/deliveries/DeliveryDialogs';
import { ProductFormDialog } from '@/features/products/ProductFormDialog';
import { Receipt } from '@/features/sales/Receipt';
import { AgeRestrictedSalesCard } from './AgeRestrictedSalesCard';
import { cashierAgeChecks, needsLook, restrictedTotal } from './register';
import { clockTime, describeSellingHours, runsPastMidnight } from './sellingHours';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/pos',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

const LIQUOR = ['sales', 'catalog', 'ageRestricted'];
/** The active business's sector and modules, as the sign-in membership carries them. */
function useBusiness(sector: BusinessSector, modules: string[]) {
  useSession.setState((s) => ({ businesses: s.businesses.map((b) => ({ ...b, sector, modules })) }));
}
const fail = (status: number, code: string, message: string, details: Record<string, string[]> | null = null) =>
  HttpResponse.json({ success: false, data: null, error: { code, message, details }, meta: null }, { status });

// ---- The till's "API": beer is age-restricted, soda is not ----

const PRODUCTS: Record<string, { name: string; price: number; restricted: boolean }> = {
  beer: { name: 'Tusker Lager 500ml', price: 250, restricted: true },
  soda: { name: 'Coca-Cola 500ml', price: 80, restricted: false },
};
let withinHours = true;
function previewOf(body: CreateSaleRequestDto): SalePreviewDto {
  const lines = body.lines.map((l) => {
    const p = PRODUCTS[l.productId];
    return {
      productId: l.productId, productName: p.name, sku: l.productId, unitOfMeasureId: l.unitOfMeasureId, quantity: l.quantity, unitPrice: p.price,
      lineTotal: p.price * l.quantity, availableInBaseUnits: 100, requiredInBaseUnits: l.quantity, stockSufficient: true, discountAmount: 0, taxRate: 0,
      taxAmount: 0, requiresPrescription: false, isBatchTracked: false, isAgeRestricted: p.restricted,
    };
  });
  const total = lines.reduce((a, l) => a + l.lineTotal, 0);
  const requiresAgeCheck = lines.some((l) => l.isAgeRestricted);
  return {
    customerId: body.customerId, priceType: PriceType.Retail, totalAmount: total, allStockSufficient: true, lines, subtotal: total, discountTotal: 0, taxTotal: 0,
    requiresPrescription: false, customerBalance: null, creditLimit: null, creditLimitExceeded: false,
    requiresAgeCheck, minimumAge: requiresAgeCheck ? 18 : null, withinSellingHours: !requiresAgeCheck || withinHours, sellingHours: '17:00-23:00 every day',
  };
}
const line = (productId: string): CartLine => ({
  key: productId, productId, productName: PRODUCTS[productId].name, sku: productId, unitOfMeasureId: 'btl', quantity: 1, discountAmount: null,
  discountPercent: null, isBatchTracked: false, requiresPrescription: false, units: [{ unitOfMeasureId: 'btl', symbol: 'btl' }],
});
const setCart = (...ids: string[]) => useCartStore.setState({ carts: { [BUSINESS_ID]: { ...emptyCart(), lines: ids.map(line) } }, held: {} });

let sales: CreateSaleRequestDto[] = [];
const saleDto = (body: CreateSaleRequestDto) => ({ saleId: 's1', saleNumber: 'INV-000123', status: SaleStatus.Completed, lines: [], totalAmount: 330, ageCheck: body.ageCheck ?? null });

const business = (over: Partial<BusinessDto> = {}) => ({
  businessId: BUSINESS_ID, businessName: 'Pombe Wines', sector: BusinessSector.Liquor, modules: LIQUOR,
  ageRestrictedSales: { minimumAge: 18, weekdayFrom: null, weekdayTo: null, weekendFrom: null, weekendTo: null, enabled: true }, ...over,
}) as BusinessDto;
let settingsSent: unknown = null;

const server = setupServer(
  http.get(`${API}/products/get-products`, () => HttpResponse.json(paged([]))),
  http.post(`${API}/sales/preview`, async ({ request }) => HttpResponse.json(ok(previewOf((await request.json()) as CreateSaleRequestDto)))),
  http.post(`${API}/sales`, async ({ request }) => {
    const body = (await request.json()) as CreateSaleRequestDto;
    sales.push(body);
    return HttpResponse.json(ok(saleDto(body)));
  }),
  http.put(`${API}/businesses/current/age-restricted-sales`, async ({ request }) => {
    settingsSent = await request.json();
    return HttpResponse.json(ok(business({ ageRestrictedSales: settingsSent as BusinessDto['ageRestrictedSales'] })));
  }),
  http.get(`${API}/businesses/current`, () => HttpResponse.json(ok(business()))),
  // The product form's pickers.
  http.get(`${API}/categories/get-categories`, () => HttpResponse.json(ok([]))),
  http.get(`${API}/units-of-measure/get-units`, () => HttpResponse.json(ok([]))),
  http.get(`${API}/brands`, () => HttpResponse.json(paged([]))),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  withinHours = true;
  sales = [];
  settingsSent = null;
});

describe('selling hours in words', () => {
  it('says any time, every day, or weekdays and weekends, as the API does', () => {
    expect(describeSellingHours(null)).toBe('at any time');
    expect(describeSellingHours({ weekdayFrom: '10:00', weekdayTo: null, weekendFrom: null, weekendTo: null })).toBe('at any time');
    expect(describeSellingHours({ weekdayFrom: '17:00:00', weekdayTo: '23:00', weekendFrom: null, weekendTo: null })).toBe('17:00–23:00 every day');
    expect(describeSellingHours({ weekdayFrom: '17:00', weekdayTo: '23:00', weekendFrom: '17:00', weekendTo: '23:00' })).toBe('17:00–23:00 every day');
    expect(describeSellingHours({ weekdayFrom: '17:00', weekdayTo: '23:00', weekendFrom: '14:00', weekendTo: '23:00' }))
      .toBe('17:00–23:00 on weekdays, 14:00–23:00 at weekends');
  });

  it('knows a window that ends before it starts runs past midnight', () => {
    expect(runsPastMidnight('17:00', '02:00')).toBe(true);
    expect(runsPastMidnight('10:00', '23:00')).toBe(false);
    expect(runsPastMidnight('17:00', '')).toBe(false);
    expect(clockTime(' 07:30:15 ')).toBe('07:30');
    expect(clockTime('')).toBeNull();
  });
});

describe('age-check register by cashier', () => {
  const at = (hour: number) => new Date(2026, 10, 4, hour, 0).toISOString();
  const entry = (who: string, hour: number, ageCheck: AgeCheckMethod): AgeCheckRegisterEntryDto => ({
    saleId: `${who}${hour}${ageCheck}${Math.random()}`, saleNumber: 'INV-1', soldAt: at(hour), saleStatus: SaleStatus.Completed, ageCheck, checkedByName: who,
    deliveryMode: DeliveryMode.Counter, customerName: null,
    lines: [{ productId: 'beer', productName: 'Tusker', quantity: 2, unitSymbol: 'btl', lineTotal: 250 }, { productId: 'gin', productName: 'Gin', quantity: 1, unitSymbol: 'btl', lineTotal: 1200.5 }],
  });

  it('counts sales and "regular" checks per cashier, all day and in the evening', () => {
    const entries = [
      entry('Mercy', 11, AgeCheckMethod.NationalId), entry('Mercy', 19, AgeCheckMethod.KnownCustomer),
      ...[19, 20, 21, 22, 23].map((h) => entry('Otieno', h, AgeCheckMethod.KnownCustomer)), entry('Otieno', 12, AgeCheckMethod.Passport),
    ];
    const [otieno, mercy] = cashierAgeChecks(entries);
    expect(otieno).toMatchObject({ name: 'Otieno', sales: 6, regular: 5, eveningSales: 5, eveningRegular: 5, eveningRegularShare: 100 });
    expect(otieno.regularShare).toBeCloseTo(83.33, 2);
    expect(mercy).toMatchObject({ name: 'Mercy', sales: 2, regular: 1, regularShare: 50, eveningSales: 1 });
    expect(needsLook(otieno)).toBe(true);
    // Too few sales to mean anything.
    expect(needsLook(mercy)).toBe(false);
    expect(restrictedTotal(entries[0])).toBe(1450.5);
  });
});

describe('settings: age-restricted sales', () => {
  beforeEach(() => {
    signIn(['Businesses.Update']);
    useSession.setState({ business: business() });
  });

  it('sets hours that run past midnight, says so, and sends them as HH:mm', async () => {
    renderWithProviders(<AgeRestrictedSalesCard />);
    expect(screen.getByText(/can be sold at any time\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: /Limit the hours alcohol and tobacco can be sold/ }));
    fireEvent.change(screen.getByLabelText(/^From/), { target: { value: '17:00' } });
    fireEvent.change(screen.getByLabelText(/^To/), { target: { value: '02:00' } });

    expect(screen.getByText('Runs past midnight: until 02:00 the next morning.')).toBeInTheDocument();
    expect(screen.getByText(/Alcohol and cigarettes can be sold 17:00–02:00 every day\./)).toBeInTheDocument();
    expect(screen.getByText('Use the hours on your liquor licence. Public holidays use the weekday hours.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Different hours at weekends' }));
    fireEvent.change(screen.getByLabelText(/^Weekend from/), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText(/^Weekend to/), { target: { value: '23:00' } });
    expect(screen.getByText(/can be sold 17:00–02:00 on weekdays, 14:00–23:00 at weekends\./)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(settingsSent).toEqual({ minimumAge: 18, weekdayFrom: '17:00', weekdayTo: '02:00', weekendFrom: '14:00', weekendTo: '23:00', enabled: true }));
  });

  it('switching the limit off sends no hours at all (any time)', async () => {
    useSession.setState({ business: business({ ageRestrictedSales: { minimumAge: 21, weekdayFrom: '10:00', weekdayTo: '23:00', weekendFrom: null, weekendTo: null, enabled: true } }) });
    renderWithProviders(<AgeRestrictedSalesCard />);
    await userEvent.click(screen.getByRole('switch', { name: /Limit the hours/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(settingsSent).toEqual({ minimumAge: 21, weekdayFrom: null, weekdayTo: null, weekendFrom: null, weekendTo: null, enabled: true }));
  });

  it('a liquor store can switch the whole feature off, keeping its age and hours for later', async () => {
    useSession.setState({ business: business({ ageRestrictedSales: { minimumAge: 21, weekdayFrom: '17:00', weekdayTo: '23:00', weekendFrom: null, weekendTo: null, enabled: true } }) });
    renderWithProviders(<AgeRestrictedSalesCard />);
    await userEvent.click(screen.getByRole('switch', { name: 'Use age-restricted sales' }));
    expect(screen.getByText(/Off: no age check at the till or on deliveries/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Minimum age/)).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /Limit the hours/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(settingsSent).toEqual({ minimumAge: 21, weekdayFrom: '17:00', weekdayTo: '23:00', weekendFrom: null, weekendTo: null, enabled: false }));
  });

  it('offers the switch only to a liquor store', () => {
    useSession.setState({ business: business({ sector: BusinessSector.Minimart }) });
    useBusiness(BusinessSector.Minimart, ['sales', 'catalog']);
    renderWithProviders(<AgeRestrictedSalesCard />);
    expect(screen.queryByRole('switch', { name: 'Use age-restricted sales' })).not.toBeInTheDocument();
  });

  it('shows each refusal under its field, the API’s too', async () => {
    renderWithProviders(<AgeRestrictedSalesCard />);
    fireEvent.change(screen.getByLabelText(/^Minimum age/), { target: { value: '16' } });
    await userEvent.click(screen.getByRole('switch', { name: /Limit the hours/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('The minimum age is a whole number from 18 to 25.')).toBeInTheDocument();
    expect(screen.getByText('When do weekday sales start?')).toBeInTheDocument();
    expect(settingsSent).toBeNull();

    server.use(http.put(`${API}/businesses/current/age-restricted-sales`, () =>
      fail(400, 'VALIDATION_FAILED', 'Validation failed.', { weekdayTo: ['The weekday hours end when they start: leave both out for any time.'] })));
    fireEvent.change(screen.getByLabelText(/^Minimum age/), { target: { value: '18' } });
    fireEvent.change(screen.getByLabelText(/^From/), { target: { value: '09:00' } });
    fireEvent.change(screen.getByLabelText(/^To/), { target: { value: '10:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const message = await screen.findByText('The weekday hours end when they start: leave both out for any time.');
    expect(screen.getByLabelText(/^To/)).toHaveAttribute('aria-describedby', message.id);
  });
});

describe('the till', () => {
  beforeEach(() => {
    signIn(['Sales.Create', 'Sales.View']);
    useBusiness(BusinessSector.Liquor, LIQUOR);
  });

  it('marks the beer 18+, asks for the age check before payment and sends the answer', async () => {
    setCart('beer', 'soda');
    renderWithProviders(<PosPage />);
    expect(await screen.findByText('18+')).toBeInTheDocument();
    // Only the beer.
    expect(screen.getAllByText('18+')).toHaveLength(1);

    const charge = screen.getByRole('button', { name: /Charge/ });
    await waitFor(() => expect(charge).toBeEnabled());
    await userEvent.click(charge);
    expect(await screen.findByText('Is the customer 18 or over?')).toBeInTheDocument();
    // Nothing is pre-selected and nothing is typed.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText('Take payment')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'National ID' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Exact' }));
    await userEvent.click(screen.getByRole('button', { name: /Complete sale/ }));
    await waitFor(() => expect(sales).toHaveLength(1));
    expect(sales[0].ageCheck).toBe(AgeCheckMethod.NationalId);
  });

  it('asks again for the next sale: the last answer is never remembered', async () => {
    setCart('beer');
    renderWithProviders(<PosPage />);
    const charge = await screen.findByRole('button', { name: /Charge/ });
    await waitFor(() => expect(charge).toBeEnabled());
    await userEvent.click(charge);
    await userEvent.click(await screen.findByRole('button', { name: 'Passport' }));
    // Back to the cart, then Pay again.
    await userEvent.click(await screen.findByRole('button', { name: 'Back' }));
    await userEvent.click(screen.getByRole('button', { name: /Charge/ }));
    expect(await screen.findByText('Is the customer 18 or over?')).toBeInTheDocument();
  });

  it('sells the soda alone without an age check', async () => {
    setCart('soda');
    renderWithProviders(<PosPage />);
    const charge = await screen.findByRole('button', { name: /Charge/ });
    await waitFor(() => expect(charge).toBeEnabled());
    await userEvent.click(charge);
    expect(await screen.findByText('Take payment')).toBeInTheDocument();
    expect(screen.queryByText(/Is the customer/)).not.toBeInTheDocument();
    expect(screen.queryByText('18+')).not.toBeInTheDocument();
  });

  it('outside the selling hours, shows the red banner and keeps Pay disabled until the 18+ items are removed', async () => {
    withinHours = false;
    setCart('beer', 'soda');
    renderWithProviders(<PosPage />);
    expect(await screen.findByText('Alcohol and cigarettes can be sold 17:00-23:00 every day. Remove the 18+ items to finish this sale.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Charge/ })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Remove Tusker Lager 500ml' }));
    await waitFor(() => expect(screen.queryByText(/Remove the 18\+ items/)).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: /Charge/ })).toBeEnabled());
  });
});

describe('payment refused for the age check or the hours', () => {
  const preview = previewOf({ customerId: null, paymentMethod: PaymentMethod.Cash, notes: null, lines: [{ productId: 'soda', unitOfMeasureId: 'btl', quantity: 1 }],
    amountTendered: null, mpesaPhoneNumber: null, mpesaTransactionId: null });
  const cart = { ...emptyCart(), lines: [line('beer')] };
  beforeEach(() => signIn(['Sales.Create']));

  it('asks for the age check when an older preview missed it, then resends the sale with it', async () => {
    let calls = 0;
    server.use(http.post(`${API}/sales`, async ({ request }) => {
      const body = (await request.json()) as CreateSaleRequestDto;
      sales.push(body);
      return ++calls === 1
        ? fail(422, 'AGE_CHECK_REQUIRED', "This sale includes age-restricted products: 'Tusker Lager 500ml'.")
        : HttpResponse.json(ok(saleDto(body)));
    }));
    const onCompleted = vi.fn();
    renderWithProviders(<PaymentDialog open onOpenChange={vi.fn()} cart={cart} preview={preview} includePrescription={false}
      onOverrideCreditLimit={vi.fn()} onCompleted={onCompleted} onAbandoned={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Exact' }));
    await userEvent.click(screen.getByRole('button', { name: /Complete sale/ }));

    await userEvent.click(await screen.findByRole('button', { name: /Driving licence/ }));
    await waitFor(() => expect(onCompleted).toHaveBeenCalled());
    expect(sales.map((s) => s.ageCheck)).toEqual([null, AgeCheckMethod.DrivingLicence]);
    // The cash typed before is kept.
    expect(sales[1].amountTendered).toBe(80);
  });

  it('shows the hours message and keeps the cart', async () => {
    server.use(http.post(`${API}/sales`, () => fail(422, 'OUTSIDE_SELLING_HOURS', "'Tusker Lager 500ml' may be sold only 17:00-23:00 every day; it is 14:05 now.")));
    const onCompleted = vi.fn();
    renderWithProviders(<PaymentDialog open onOpenChange={vi.fn()} cart={cart} preview={preview} includePrescription={false} ageCheck={AgeCheckMethod.NationalId}
      onOverrideCreditLimit={vi.fn()} onCompleted={onCompleted} onAbandoned={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Exact' }));
    await userEvent.click(screen.getByRole('button', { name: /Complete sale/ }));
    expect(await screen.findByText(/may be sold only 17:00-23:00 every day/)).toBeInTheDocument();
    expect(onCompleted).not.toHaveBeenCalled();
  });
});

describe('recording a delivery with beer on it', () => {
  const order: DeliveryOrderDto = {
    deliveryOrderId: 'd1', orderNumber: 'DEL-000007', status: DeliveryOrderStatus.OutForDelivery, customerId: 'c1', customerName: 'Achieng',
    deliveryAddress: 'Kilimani', contactPhone: null, notes: null, estimatedTotal: 250, riderName: 'Kamau', dispatchedAt: '2026-11-04T18:00:00Z',
    saleId: null, saleNumber: null, saleTotal: null, paymentMethod: null, paymentDueDate: null, deliveredAt: null, cancelledAt: null, cancelReason: null,
    createdAt: '2026-11-04T17:30:00Z', createdBy: null, branchId: HEAD_OFFICE.branchId, kraBranchId: '00', branchName: 'Head Office',
    lines: [{ deliveryOrderLineId: 'l1', productId: 'beer', productName: 'Tusker Lager 500ml', sku: 'beer', unitOfMeasureId: 'btl', unitSymbol: 'btl', quantity: 1, quantityInBaseUnits: 1 }],
  };
  let delivered: { ageCheck?: AgeCheckMethod | null } | null = null;
  beforeEach(() => {
    delivered = null;
    // Past the hours now: the goods left in time, so recording it is not refused.
    withinHours = false;
    signIn(['DeliveryOrders.Deliver', 'Sales.View']);
    server.use(http.post(`${API}/delivery-orders/d1/deliver`, async ({ request }) => {
      delivered = (await request.json()) as typeof delivered;
      return HttpResponse.json(ok({ ...order, status: DeliveryOrderStatus.Delivered, saleNumber: 'INV-000124' }));
    }));
  });

  it('asks how the rider checked the customer’s age at the door, and sends it', async () => {
    renderWithProviders(<RecordDeliveryDialog order={order} open onOpenChange={vi.fn()} />);
    expect(await screen.findByText('How did the rider check the customer’s age at the door?')).toBeInTheDocument();
    expect(screen.getAllByRole('radio', { checked: true }).map((r) => r.textContent)).toEqual(['Cash']);

    await userEvent.type(screen.getByLabelText('Cash handed in'), '250');
    await userEvent.click(await screen.findByRole('button', { name: /Complete sale · / }));
    expect(await screen.findByText('How did the rider check the customer’s age? Choose one.')).toBeInTheDocument();
    expect(delivered).toBeNull();

    await userEvent.click(screen.getByRole('radio', { name: 'National ID' }));
    await userEvent.click(screen.getByRole('button', { name: /Complete sale · / }));
    await waitFor(() => expect(delivered).not.toBeNull());
    expect(delivered!.ageCheck).toBe(AgeCheckMethod.NationalId);
  });
});

describe('the product form', () => {
  const restricted: ProductDto = {
    productId: 'p1', sku: 'BER-FG-000001', name: 'Tusker Lager 500ml', description: null, categoryId: 'c1', categoryName: 'Beer',
    itemType: ItemType.FinishedGood, taxClassification: TaxClassification.Standard, baseUnitOfMeasureId: 'btl', baseUnitSymbol: 'btl', reorderLevel: 0,
    barcode: null, isBatchTracked: false, requiresPrescription: false, genericName: null, strength: null, dosageForm: null, manufacturer: null,
    isActive: true, brandId: null, brandName: null, isAgeRestricted: true,
  };
  const toggle = () => screen.queryByRole('switch', { name: 'Age-restricted (18+)' });

  it('starts a liquor store’s new product age-restricted', () => {
    signIn(['Products.View', 'Products.Create']);
    useBusiness(BusinessSector.Liquor, LIQUOR);
    renderWithProviders(<ProductFormDialog open onOpenChange={vi.fn()} />);
    expect(toggle()).toBeChecked();
    expect(toggle()).toBeEnabled();
  });

  it('offers no 18+ toggle on a new product once a liquor store has switched age-restricted sales off', () => {
    signIn(['Products.View', 'Products.Create']);
    useBusiness(BusinessSector.Liquor, ['sales', 'catalog']);
    renderWithProviders(<ProductFormDialog open onOpenChange={vi.fn()} />);
    expect(toggle()).not.toBeInTheDocument();
  });

  it('shows the 18+ chip only while age-restricted sales are on', () => {
    signIn(['Products.View']);
    useBusiness(BusinessSector.Liquor, LIQUOR);
    const { rerender } = render(<ProductFlags isAgeRestricted />);
    expect(screen.getByText('18+')).toBeInTheDocument();
    useBusiness(BusinessSector.Liquor, ['sales', 'catalog']);
    rerender(<ProductFlags isAgeRestricted />);
    expect(screen.queryByText('18+')).not.toBeInTheDocument();
  });

  it('offers no 18+ toggle in a pharmacy', () => {
    signIn(['Products.View', 'Products.Create']);
    useBusiness(BusinessSector.Pharmacy, ['sales', 'catalog', 'batches', 'prescriptions']);
    renderWithProviders(<ProductFormDialog open onOpenChange={vi.fn()} />);
    expect(toggle()).not.toBeInTheDocument();
  });

  it('shows an age-restricted product read-only where the module is hidden', () => {
    signIn(['Products.View', 'Products.Update']);
    useBusiness(BusinessSector.Pharmacy, ['sales', 'catalog']);
    renderWithProviders(<ProductFormDialog open onOpenChange={vi.fn()} product={restricted} />);
    expect(toggle()).toBeChecked();
    expect(toggle()).toBeDisabled();
  });
});

describe('the receipt', () => {
  const sale = {
    saleId: 's1', saleNumber: 'INV-000123', customerId: null, paymentMethod: PaymentMethod.Cash, status: SaleStatus.Completed, totalAmount: 250,
    amountTendered: 250, changeDue: 0, notes: null, createdAt: '2026-11-04T17:42:10Z', lines: [], customerName: null, createdBy: null, createdByName: null,
    subtotal: 250, discountTotal: 0, taxTotal: 0, returnedAmount: 0, prescription: null,
  } as SaleDto;

  it('prints how the age was checked, and nothing on a sale without alcohol or tobacco', () => {
    const { rerender } = render(<Receipt sale={{ ...sale, ageCheck: AgeCheckMethod.NationalId }} paper="80mm" />);
    expect(screen.getByText('Age checked: National ID')).toBeInTheDocument();
    rerender(<Receipt sale={{ ...sale, ageCheck: AgeCheckMethod.KnownCustomer }} paper="a4" />);
    expect(screen.getByText('Age checked: Regular: ID seen before')).toBeInTheDocument();
    rerender(<Receipt sale={{ ...sale, ageCheck: null }} paper="80mm" />);
    expect(screen.queryByText(/Age checked/)).not.toBeInTheDocument();
  });
});
