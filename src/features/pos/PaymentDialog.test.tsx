import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MpesaTransactionStatus, MpesaTransactionType, PaymentMethod, PriceType } from '@/api/enums';
import { emptyCart, type Cart } from '@/stores/cart';
import { API, renderWithProviders, signIn } from '@/test/render';
import type { MpesaTransactionDto, SalePreviewDto } from '@/api/dto/sales';
import { PaymentDialog } from './PaymentDialog';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

const preview: SalePreviewDto = {
  customerId: null, priceType: PriceType.Retail, totalAmount: 130, allStockSufficient: true, subtotal: 130, discountTotal: 0, taxTotal: 0,
  requiresPrescription: false, customerBalance: null, creditLimit: null, creditLimitExceeded: false,
  lines: [{ productId: 'water', productName: 'Water (refill)', sku: 'WTR-1', unitOfMeasureId: '20L', quantity: 2, unitPrice: 65, lineTotal: 130,
    availableInBaseUnits: 500, requiredInBaseUnits: 40, stockSufficient: true, discountAmount: 0, taxRate: 0, taxAmount: 0, requiresPrescription: false, isBatchTracked: false }],
};
const cart = (paymentMethod: PaymentMethod): Cart => ({
  ...emptyCart(),
  paymentMethod,
  lines: [{ key: 'k1', productId: 'water', productName: 'Water (refill)', sku: 'WTR-1', unitOfMeasureId: '20L', quantity: 2, discountAmount: null,
    discountPercent: null, isBatchTracked: false, requiresPrescription: false, units: [{ unitOfMeasureId: 'l', symbol: 'l' }, { unitOfMeasureId: '20L', symbol: '20L' }] }],
});
const tillPayment: MpesaTransactionDto = {
  mpesaTransactionId: 'tx1', transactionType: MpesaTransactionType.C2B, status: MpesaTransactionStatus.Received, mpesaReceiptNumber: 'SJK12AB34C',
  phoneNumber: '2547******78', amount: 130, transactionDate: '2026-10-19T07:00:00Z', saleId: null,
};
const fail = (status: number, code: string, message: string) => HttpResponse.json({ success: false, data: null, error: { code, message, details: null }, meta: null }, { status });

let unmatchedCalls = 0;
const server = setupServer(
  http.get(`${API}/mpesa/transactions/unmatched`, () => {
    unmatchedCalls++;
    return HttpResponse.json({ success: true, data: [tillPayment], error: null, meta: null });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  unmatchedCalls = 0;
  signIn(['Sales.Create']);
});

function renderDialog(method: PaymentMethod) {
  const onCompleted = vi.fn();
  const view = renderWithProviders(
    <PaymentDialog open onOpenChange={vi.fn()} cart={cart(method)} preview={preview} includePrescription={false}
      onOverrideCreditLimit={vi.fn()} onCompleted={onCompleted} onAbandoned={vi.fn()} />,
  );
  return { ...view, onCompleted, invalidate: vi.spyOn(view.client, 'invalidateQueries') };
}

describe('payment conflicts', () => {
  it('shows a stock shortfall, keeps the cart and re-prices it', async () => {
    server.use(http.post(`${API}/sales`, () => fail(409, 'INSUFFICIENT_STOCK', "Not enough stock for: 'Water (refill)' (30 available, 40 needed).")));
    const { onCompleted, invalidate } = renderDialog(PaymentMethod.Cash);
    await userEvent.type(screen.getByLabelText('Amount tendered'), '200');
    await userEvent.click(screen.getByRole('button', { name: /Complete sale/ }));

    expect(await screen.findByText(/30 available, 40 needed/)).toBeInTheDocument();
    expect(onCompleted).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sale-preview'] });
  });

  it('drops a till payment another sale just took and reloads the list', async () => {
    server.use(http.post(`${API}/sales`, () => fail(400, 'INVALID_ASSIGNMENT', 'This M-Pesa transaction has just been matched to another sale.')));
    renderDialog(PaymentMethod.MpesaTill);
    await userEvent.click(await screen.findByText('SJK12AB34C'));
    const before = unmatchedCalls;
    await userEvent.click(screen.getByRole('button', { name: /Complete sale/ }));

    expect(await screen.findByText(/just been matched to another sale/)).toBeInTheDocument();
    await waitFor(() => expect(unmatchedCalls).toBeGreaterThan(before));
    // The choice was cleared, so charging again asks for a payment first instead of resending the taken one.
    await userEvent.click(screen.getByRole('button', { name: /Complete sale/ }));
    expect(await screen.findByText('Select the customer’s M-Pesa payment.')).toBeInTheDocument();
  });
});

describe('M-Pesa code', () => {
  it('checks the code, then sends it cleaned up', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(http.post(`${API}/sales`, async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ success: true, data: { saleId: 's1', status: 1 }, error: null, meta: null });
    }));
    const { onCompleted } = renderDialog(PaymentMethod.MpesaReference);
    const input = screen.getByLabelText('M-Pesa code');
    await userEvent.type(input, 'sjk4');
    await userEvent.click(screen.getByRole('button', { name: /Complete sale/ }));
    expect(await screen.findByText(/10-character M-Pesa code/)).toBeInTheDocument();
    expect(body).toBeNull();

    await userEvent.type(input, 'h7l m2p');
    await userEvent.click(screen.getByRole('button', { name: /Complete sale/ }));
    await waitFor(() => expect(onCompleted).toHaveBeenCalled());
    expect(body).toMatchObject({ paymentMethod: PaymentMethod.MpesaReference, mpesaReference: 'SJK4H7LM2P', mpesaTransactionId: null });
  });

  it('shows a code already used on another sale', async () => {
    server.use(http.post(`${API}/sales`, () => fail(409, 'DUPLICATE_REFERENCE', 'M-Pesa code SJK4H7LM2P is already on sale INV-000041.')));
    renderDialog(PaymentMethod.MpesaReference);
    await userEvent.type(screen.getByLabelText('M-Pesa code'), 'SJK4H7LM2P');
    await userEvent.click(screen.getByRole('button', { name: /Complete sale/ }));
    expect(await screen.findByText(/already on sale INV-000041/)).toBeInTheDocument();
  });
});
