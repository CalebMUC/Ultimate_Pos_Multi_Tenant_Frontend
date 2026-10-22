import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryMode, DeliveryOrderStatus, PaymentMethod, PriceType } from '@/api/enums';
import { emptyCart, emptyDelivery, useCartStore, type Cart } from '@/stores/cart';
import { API, BUSINESS_ID, HEAD_OFFICE, ok, paged, renderWithProviders, signIn } from '@/test/render';
import type { CreateSaleRequestDto, SalePreviewDto } from '@/api/dto/sales';
import type { DeliveryOrderDto } from '@/api/dto/deliveries';
import { PosPage } from './PosPage';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/pos',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

const line = {
  key: 'k1', productId: 'water', productName: 'Water (refill)', sku: 'WTR', unitOfMeasureId: '20L', quantity: 2, discountAmount: null,
  discountPercent: null, isBatchTracked: false, requiresPrescription: false, units: [{ unitOfMeasureId: '20L', symbol: '20L' }],
};
const cart = (rider: boolean): Cart => ({
  ...emptyCart(),
  customerId: 'c1',
  customerName: 'Wanjiku',
  lines: [line],
  deliveryMode: rider ? DeliveryMode.Rider : DeliveryMode.Counter,
  delivery: { ...emptyDelivery(), address: 'Ruiru, Kimbo stage, green gate', riderName: 'Peter', expectedPaymentMethod: PaymentMethod.MpesaReference },
});

function previewOf(body: CreateSaleRequestDto): SalePreviewDto {
  const lines = body.lines.map((l) => ({
    productId: l.productId, productName: 'Water (refill)', sku: 'WTR', unitOfMeasureId: l.unitOfMeasureId, quantity: l.quantity, unitPrice: 65,
    lineTotal: 65 * l.quantity, availableInBaseUnits: 500, requiredInBaseUnits: 20 * l.quantity, stockSufficient: true, discountAmount: 0, taxRate: 0,
    taxAmount: 0, requiresPrescription: false, isBatchTracked: false,
  }));
  const total = lines.reduce((a, l) => a + l.lineTotal, 0);
  return { customerId: body.customerId, priceType: PriceType.Retail, totalAmount: total, allStockSufficient: true, lines, subtotal: total, discountTotal: 0,
    taxTotal: 0, requiresPrescription: false, customerBalance: 0, creditLimit: null, creditLimitExceeded: false };
}

const created: DeliveryOrderDto = {
  deliveryOrderId: 'd10', orderNumber: 'DEL-000010', status: DeliveryOrderStatus.OutForDelivery, customerId: 'c1', customerName: 'Wanjiku',
  deliveryAddress: 'Ruiru, Kimbo stage, green gate', contactPhone: '0712345678', notes: null, estimatedTotal: 130, riderName: 'Peter',
  dispatchedAt: '2026-10-22T07:00:00Z', saleId: null, saleNumber: null, saleTotal: null, paymentMethod: null, paymentDueDate: null, deliveredAt: null,
  cancelledAt: null, cancelReason: null, createdAt: '2026-10-22T07:00:00Z', createdBy: null, branchId: HEAD_OFFICE.branchId, kraBranchId: '00',
  branchName: 'Head Office', expectedPaymentMethod: PaymentMethod.MpesaReference, deliveryTripId: 't1', tripNumber: 'TRP-000004',
  lines: [{ deliveryOrderLineId: 'l1', productId: 'water', productName: 'Water (refill)', sku: 'WTR', unitOfMeasureId: '20L', unitSymbol: '20L', quantity: 2, quantityInBaseUnits: 40 }],
};

let orderBody: unknown = null;
let salePosts = 0;
const server = setupServer(
  http.get(`${API}/products/get-products`, () => HttpResponse.json(paged([]))),
  http.post(`${API}/sales/preview`, async ({ request }) => HttpResponse.json(ok(previewOf((await request.json()) as CreateSaleRequestDto)))),
  http.get(`${API}/customers/c1`, () => HttpResponse.json(ok({ customerId: 'c1', customerName: 'Wanjiku', phoneNumber: '0712345678', physicalAddress: 'Ruiru' }))),
  http.post(`${API}/sales`, () => {
    salePosts++;
    return HttpResponse.json(ok({ saleId: 's1', status: 1 }));
  }),
  http.post(`${API}/delivery-orders`, async ({ request }) => {
    orderBody = await request.json();
    return HttpResponse.json(ok(created), { status: 201 });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  orderBody = null;
  salePosts = 0;
  signIn(['Sales.Create', 'Sales.View', 'DeliveryOrders.Create', 'DeliveryOrders.Dispatch']);
});

describe('POS delivery by rider', () => {
  it('sends a delivery order with the rider and the expected payment, never a sale', async () => {
    useCartStore.setState({ carts: { [BUSINESS_ID]: cart(true) }, held: {} });
    renderWithProviders(<PosPage />);
    const send = await screen.findByRole('button', { name: /Send with rider/ });
    await waitFor(() => expect(send).toBeEnabled());
    await userEvent.click(send);

    await waitFor(() => expect(orderBody).not.toBeNull());
    expect(orderBody).toMatchObject({
      customerId: 'c1',
      deliveryAddress: 'Ruiru, Kimbo stage, green gate',
      riderName: 'Peter',
      expectedPaymentMethod: PaymentMethod.MpesaReference,
      lines: [{ productId: 'water', unitOfMeasureId: '20L', quantity: 2 }],
    });
    expect(orderBody).not.toHaveProperty('amountTendered');
    expect(salePosts).toBe(0);
    // A delivery note for the rider, not a receipt; the cart is cleared.
    expect(await screen.findByText('DEL-000010 is out with Peter')).toBeInTheDocument();
    expect(useCartStore.getState().carts[BUSINESS_ID].lines).toHaveLength(0);
  });

  it('leaves a counter sale as it was: Charge takes payment', async () => {
    useCartStore.setState({ carts: { [BUSINESS_ID]: cart(false) }, held: {} });
    renderWithProviders(<PosPage />);
    const charge = await screen.findByRole('button', { name: /Charge/ });
    await waitFor(() => expect(charge).toBeEnabled());
    await userEvent.click(charge);

    expect(await screen.findByText('Take payment')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Send with rider/ })).not.toBeInTheDocument();
    expect(orderBody).toBeNull();
  });
});
