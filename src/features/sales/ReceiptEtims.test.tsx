import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EtimsSubmissionStatus, PaymentMethod, SaleStatus } from '@/api/enums';
import { API, ok, renderWithProviders, signIn } from '@/test/render';
import { useSession } from '@/stores/session';
import type { EtimsReceiptDto } from '@/api/dto/etims';
import type { SaleDto } from '@/api/dto/sales';
import { Receipt } from './Receipt';

// The QR code itself is qrcode.react's; what matters here is what it is asked to encode.
vi.mock('@/features/etims/EtimsQr', () => ({ EtimsQr: ({ value }: { value: string }) => <svg data-testid="qr" data-value={value} /> }));

const sale: SaleDto = {
  saleId: 's1', saleNumber: 'INV-000042', customerId: null, paymentMethod: PaymentMethod.Cash, status: SaleStatus.Completed, totalAmount: 200,
  amountTendered: 200, changeDue: 0, notes: null, createdAt: '2026-10-20T08:00:00Z', lines: [], customerName: null, createdBy: null, createdByName: null,
  subtotal: 200, discountTotal: 0, taxTotal: 27.59, returnedAmount: 0, prescription: null, bundles: [],
};

const signed: EtimsReceiptDto = {
  saleId: 's1', status: EtimsSubmissionStatus.Sent, invoiceNumber: 17, receiptNumber: 15, totalReceiptNumber: 15, internalData: 'TESTVSDCINTDATA4RRSJ5UHIKPYC4',
  receiptSignature: 'BV5HYE7LQ3SUPXQS', sdcId: 'KRACU0100000012', mrcNo: 'WIS00000012', sdcDateTime: '20261020110012',
  verificationUrl: 'https://etims-sbx.kra.go.ke/common/link/etims/receipt/indexEtimsReceiptData?Data=P052446551J00BV5HYE7LQ3SUPXQS', resultMessage: null,
};
const pending: EtimsReceiptDto = {
  ...signed, status: EtimsSubmissionStatus.Pending, invoiceNumber: null, receiptNumber: null, totalReceiptNumber: null, internalData: null, receiptSignature: null,
  sdcDateTime: null, verificationUrl: null, resultMessage: 'Waiting for 1 item(s) to be registered with KRA.',
};

let receipt: EtimsReceiptDto | 'none' = signed;
let calls = 0;
const server = setupServer(
  http.get(`${API}/etims/sales/:saleId/receipt`, () => {
    calls++;
    if (receipt === 'none') {
      return HttpResponse.json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'This sale is not reported to KRA.', details: null }, meta: null }, { status: 404 });
    }
    return HttpResponse.json(ok(receipt));
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  calls = 0;
  receipt = signed;
});

/** Signs in to a business whose membership lists these modules. */
function withModules(modules: string[], permissions = ['Sales.View']) {
  signIn(permissions);
  useSession.setState((s) => ({ businesses: s.businesses.map((b) => ({ ...b, modules })) }));
}

describe('the KRA block on receipts', () => {
  it('prints KRA’s signature exactly as returned, with the QR code of the verification link', async () => {
    withModules(['sales', 'etims']);
    renderWithProviders(<Receipt sale={sale} paper="80mm" />);
    expect(await screen.findByText('KRACU0100000012')).toBeInTheDocument();
    expect(screen.getByText('KRA eTIMS')).toBeInTheDocument();
    expect(screen.getByText('WIS00000012')).toBeInTheDocument();
    expect(screen.getByText('17')).toBeInTheDocument();
    expect(screen.getByText('15 / 15')).toBeInTheDocument();
    expect(screen.getByText('20261020110012')).toBeInTheDocument();
    expect(screen.getByText('TESTVSDCINTDATA4RRSJ5UHIKPYC4')).toBeInTheDocument();
    expect(screen.getByText('BV5HYE7LQ3SUPXQS')).toBeInTheDocument();
    expect(screen.getByTestId('qr')).toHaveAttribute('data-value', signed.verificationUrl);
    // The heading is the receipt's own, as before.
    expect(screen.getByText('SALES RECEIPT')).toBeInTheDocument();
  });

  it('says the signature is pending, with no QR code, until KRA has signed', async () => {
    receipt = pending;
    withModules(['sales', 'etims']);
    renderWithProviders(<Receipt sale={sale} paper="a4" />);
    expect(await screen.findByText('KRA signature pending — reprint shortly')).toBeInTheDocument();
    expect(screen.queryByTestId('qr')).not.toBeInTheDocument();
    expect(screen.queryByText('SCU ID')).not.toBeInTheDocument();
  });

  it('shows KRA’s refusal on screen, not on paper, to users who can see eTIMS', async () => {
    receipt = { ...pending, status: EtimsSubmissionStatus.Rejected, resultMessage: 'Invalid item classification code' };
    withModules(['sales', 'etims'], ['Sales.View', 'Etims.View']);
    renderWithProviders(<Receipt sale={sale} paper="80mm" />);
    const refusal = await screen.findByText(/Invalid item classification code/);
    expect(refusal).toHaveClass('no-print');
  });

  it('hides KRA’s refusal from a cashier without Etims.View', async () => {
    receipt = { ...pending, status: EtimsSubmissionStatus.Rejected, resultMessage: 'Invalid item classification code' };
    withModules(['sales', 'etims']);
    renderWithProviders(<Receipt sale={sale} paper="80mm" />);
    expect(await screen.findByText('KRA signature pending — reprint shortly')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid item classification code/)).not.toBeInTheDocument();
  });

  it('prints no KRA block when the sale will never be reported (404)', async () => {
    receipt = 'none';
    withModules(['sales', 'etims']);
    renderWithProviders(<Receipt sale={sale} paper="80mm" />);
    await waitFor(() => expect(calls).toBe(1));
    expect(screen.queryByText('KRA eTIMS')).not.toBeInTheDocument();
    expect(screen.queryByText(/KRA signature pending/)).not.toBeInTheDocument();
    expect(screen.getByText('Thank you for your business!')).toBeInTheDocument();
  });

  it('never asks the API without the etims module', async () => {
    withModules(['sales']);
    renderWithProviders(<Receipt sale={sale} paper="80mm" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toBe(0);
    expect(screen.queryByText('KRA eTIMS')).not.toBeInTheDocument();
  });
});
