import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DeliveryOrderStatus, PaymentMethod, PriceType } from '@/api/enums';
import { API, HEAD_OFFICE, ok, renderWithProviders, signIn } from '@/test/render';
import type { DeliveryOrderDto } from '@/api/dto/deliveries';
import type { CreateSaleRequestDto, SalePreviewDto } from '@/api/dto/sales';
import { RecordDeliveryDialog } from './DeliveryDialogs';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

const order: DeliveryOrderDto = {
  deliveryOrderId: 'd1', orderNumber: 'DEL-000003', status: DeliveryOrderStatus.OutForDelivery, customerId: 'c1', customerName: 'Wanjiku',
  deliveryAddress: 'Kiambu Road', contactPhone: null, notes: null, estimatedTotal: 700, riderName: 'Kamau', dispatchedAt: '2026-10-20T07:00:00Z',
  saleId: null, saleNumber: null, saleTotal: null, paymentMethod: null, paymentDueDate: null, deliveredAt: null, cancelledAt: null, cancelReason: null,
  createdAt: '2026-10-20T06:00:00Z', createdBy: null, branchId: HEAD_OFFICE.branchId, kraBranchId: '00', branchName: 'Head Office',
  lines: [
    { deliveryOrderLineId: 'l1', productId: 'water', productName: 'Water (refill)', sku: 'WTR', unitOfMeasureId: '20L', unitSymbol: '20L', quantity: 1, quantityInBaseUnits: 20 },
    { deliveryOrderLineId: 'l2', productId: 'jerry', productName: '20L Container', sku: 'CTN', unitOfMeasureId: 'pcs', unitSymbol: 'pcs', quantity: 1, quantityInBaseUnits: 1 },
  ],
};
const PRICES: Record<string, number> = { water: 200, jerry: 500 };

/** Prices whatever lines are asked, like the API. */
function previewOf(body: CreateSaleRequestDto): SalePreviewDto {
  const lines = body.lines.map((l) => ({
    productId: l.productId, productName: l.productId, sku: l.productId, unitOfMeasureId: l.unitOfMeasureId, quantity: l.quantity, unitPrice: PRICES[l.productId],
    lineTotal: PRICES[l.productId] * l.quantity, availableInBaseUnits: 100, requiredInBaseUnits: l.quantity, stockSufficient: true, discountAmount: 0, taxRate: 0,
    taxAmount: 0, requiresPrescription: false, isBatchTracked: false,
  }));
  const total = lines.reduce((a, l) => a + l.lineTotal, 0);
  return { customerId: body.customerId, priceType: PriceType.Retail, totalAmount: total, allStockSufficient: true, lines, subtotal: total, discountTotal: 0,
    taxTotal: 0, requiresPrescription: false, customerBalance: 0, creditLimit: null, creditLimitExceeded: false };
}

let delivered: unknown = null;
const server = setupServer(
  http.post(`${API}/sales/preview`, async ({ request }) => HttpResponse.json(ok(previewOf((await request.json()) as CreateSaleRequestDto)))),
  http.post(`${API}/delivery-orders/d1/deliver`, async ({ request }) => {
    delivered = await request.json();
    return HttpResponse.json(ok({ ...order, status: DeliveryOrderStatus.Delivered, saleNumber: 'INV-000042' }));
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => {
  server.resetHandlers();
  delivered = null;
});

const render = (o: DeliveryOrderDto = order) => renderWithProviders(<RecordDeliveryDialog order={o} open onOpenChange={vi.fn()} />);

describe('record delivery', () => {
  it('offers paying later only to users who may accept credit', async () => {
    signIn(['DeliveryOrders.Deliver', 'Sales.View']);
    render();
    expect(await screen.findByRole('button', { name: /Complete sale · KES 700/ })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Pay later/ })).not.toBeInTheDocument();
  });

  it('puts it on the customer’s account with no date, for what was actually handed over', async () => {
    signIn(['DeliveryOrders.Deliver', 'DeliveryOrders.AcceptCredit', 'Sales.View']);
    render();
    // The customer had a container after all.
    await userEvent.click(await screen.findByRole('button', { name: 'Remove 20L Container' }));
    await userEvent.click(screen.getByRole('radio', { name: /Pay later/ }));
    expect(await screen.findByText(/Charged to/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /Complete sale · KES 200/ })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: /Complete sale · KES 200/ }));

    await waitFor(() => expect(delivered).not.toBeNull());
    expect(delivered).toMatchObject({ paymentMethod: PaymentMethod.Credit, lines: [{ productId: 'water', unitOfMeasureId: '20L', quantity: 1 }] });
    expect(delivered).not.toHaveProperty('paymentDueDate');
  });

  it('asks for the M-Pesa code the rider brought back and sends nothing without it', async () => {
    signIn(['DeliveryOrders.Deliver', 'Sales.View']);
    // The customer said they would pay by M-Pesa: preselected.
    render({ ...order, expectedPaymentMethod: PaymentMethod.MpesaReference });
    expect(await screen.findByRole('radio', { name: /M-Pesa Code/ })).toHaveAttribute('aria-checked', 'true');
    const complete = await screen.findByRole('button', { name: /Complete sale · KES 700/ });
    await waitFor(() => expect(complete).toBeEnabled());
    await userEvent.click(complete);

    expect(await screen.findByText('Enter the M-Pesa code the rider brought back.')).toBeInTheDocument();
    expect(delivered).toBeNull();

    await userEvent.type(screen.getByLabelText('M-Pesa code'), 'SJK4H7LM2P');
    await userEvent.click(complete);
    await waitFor(() => expect(delivered).not.toBeNull());
    expect(delivered).toMatchObject({ paymentMethod: PaymentMethod.MpesaReference, mpesaReference: 'SJK4H7LM2P' });
    // As ordered: neither lines nor bundles are sent.
    expect(delivered).not.toHaveProperty('lines');
    expect(delivered).not.toHaveProperty('bundles');
  });
});
