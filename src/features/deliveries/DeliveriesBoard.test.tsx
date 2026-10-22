import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryOrderStatus, PaymentMethod } from '@/api/enums';
import { API, HEAD_OFFICE, ok, paged, renderWithProviders, signIn } from '@/test/render';
import type { DeliveryOrderDto } from '@/api/dto/deliveries';
import DeliveriesPage from '@/app/(app)/deliveries/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/deliveries',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

const now = new Date().toISOString();
const base: DeliveryOrderDto = {
  deliveryOrderId: '', orderNumber: '', status: DeliveryOrderStatus.Pending, customerId: 'c1', customerName: '', deliveryAddress: 'Ruiru',
  contactPhone: null, notes: null, estimatedTotal: 260, riderName: null, dispatchedAt: null, saleId: null, saleNumber: null, saleTotal: null,
  paymentMethod: null, paymentDueDate: null, deliveredAt: null, cancelledAt: null, cancelReason: null, createdAt: now, createdBy: null,
  branchId: HEAD_OFFICE.branchId, kraBranchId: '00', branchName: 'Head Office', lines: [], expectedPaymentMethod: PaymentMethod.Cash,
};
const pendingA = { ...base, deliveryOrderId: 'p1', orderNumber: 'DEL-000001', customerName: 'Wanjiku' };
const pendingB = { ...base, deliveryOrderId: 'p2', orderNumber: 'DEL-000002', customerName: 'Otieno' };
const returned: DeliveryOrderDto = {
  ...base, deliveryOrderId: 'r1', orderNumber: 'DEL-000003', customerName: 'Achieng', status: DeliveryOrderStatus.Returned, riderName: 'Peter',
  dispatchedAt: now, returnedAt: now, returnReason: 'Customer not home', tripNumber: 'TRP-000002', deliveryTripId: 't2',
};

const byStatus: Record<number, DeliveryOrderDto[]> = {
  [DeliveryOrderStatus.Pending]: [pendingA, pendingB],
  [DeliveryOrderStatus.OutForDelivery]: [],
  [DeliveryOrderStatus.Delivered]: [],
  [DeliveryOrderStatus.Returned]: [returned],
};

let tripBody: unknown = null;
const server = setupServer(
  http.get(`${API}/delivery-orders/summary`, () => HttpResponse.json(ok({ byRider: [{ riderName: 'Peter' }] }))),
  http.get(`${API}/delivery-orders`, ({ request }) => {
    const status = new URL(request.url).searchParams.get('status');
    return HttpResponse.json(paged(status === null ? [] : byStatus[Number(status)] ?? []));
  }),
  http.post(`${API}/delivery-orders/trips`, async ({ request }) => {
    tripBody = await request.json();
    return HttpResponse.json(ok({ deliveryTripId: 't9', tripNumber: 'TRP-000009', riderName: 'Peter', orderCount: 2 }));
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  tripBody = null;
  signIn(['DeliveryOrders.View', 'DeliveryOrders.Dispatch', 'DeliveryOrders.Return']);
});

describe('deliveries board', () => {
  it('shows an order the rider brought back under Returned today, with the reason', async () => {
    renderWithProviders(<DeliveriesPage />);
    const column = await screen.findByRole('region', { name: 'Returned today' });
    expect(await within(column).findByText('Achieng')).toBeInTheDocument();
    expect(within(column).getByText(/Customer not home/)).toBeInTheDocument();
    expect(within(column).getByRole('button', { name: 'TRP-000002' })).toBeInTheDocument();
  });

  it('sends the selected pending orders out together on one trip', async () => {
    renderWithProviders(<DeliveriesPage />);
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Select DEL-000001' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select DEL-000002' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send together (2)' }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Rider'), 'peter ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send together' }));

    await waitFor(() => expect(tripBody).not.toBeNull());
    // Typed loosely, sent as the rider already on the board, so Peter stays one rider.
    expect(tripBody).toMatchObject({ riderName: 'Peter', deliveryOrderIds: ['p1', 'p2'] });
  });
});
