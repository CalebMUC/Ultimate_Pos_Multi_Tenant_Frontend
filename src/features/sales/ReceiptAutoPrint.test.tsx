import { StrictMode, type ReactElement } from 'react';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/overlays';
import { EtimsSubmissionStatus, PaymentMethod, SaleStatus } from '@/api/enums';
import { API, ok, renderWithProviders, signIn } from '@/test/render';
import { usePreferences } from '@/stores/preferences';
import { useSession } from '@/stores/session';
import type { EtimsReceiptDto } from '@/api/dto/etims';
import type { SaleDto } from '@/api/dto/sales';
import { ReceiptDialog } from './Receipt';

vi.mock('@/features/etims/EtimsQr', () => ({ EtimsQr: () => <svg data-testid="qr" /> }));

const sale: SaleDto = {
  saleId: 's1', saleNumber: 'INV-000042', customerId: null, paymentMethod: PaymentMethod.Cash, status: SaleStatus.Completed, totalAmount: 200,
  amountTendered: 200, changeDue: 0, notes: null, createdAt: '2026-10-20T08:00:00Z', lines: [], customerName: null, createdBy: null, createdByName: null,
  subtotal: 200, discountTotal: 0, taxTotal: 27.59, returnedAmount: 0, prescription: null, bundles: [],
};

const signed: EtimsReceiptDto = {
  saleId: 's1', status: EtimsSubmissionStatus.Sent, invoiceNumber: 17, receiptNumber: 15, totalReceiptNumber: 15, internalData: 'INTDATA',
  receiptSignature: 'SIGN', sdcId: 'KRACU0100000012', mrcNo: 'WIS00000012', sdcDateTime: '20261020110012', verificationUrl: 'https://etims/receipt', resultMessage: null,
};
const pending: EtimsReceiptDto = { ...signed, status: EtimsSubmissionStatus.Pending, receiptSignature: null, verificationUrl: null };

let receipt: EtimsReceiptDto | 'none' = signed;
const server = setupServer(
  http.get(`${API}/etims/sales/:saleId/receipt`, () => (receipt === 'none'
    ? HttpResponse.json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'This sale is not reported to KRA.', details: null }, meta: null }, { status: 404 })
    : HttpResponse.json(ok(receipt)))),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

let print: ReturnType<typeof vi.fn>;
beforeEach(() => {
  receipt = signed;
  print = vi.fn();
  window.print = print as unknown as typeof window.print;
  usePreferences.setState({ autoPrintReceipt: true, receiptPaper: '80mm' });
});

function withModules(modules: string[]) {
  signIn(['Sales.View']);
  useSession.setState((s) => ({ businesses: s.businesses.map((b) => ({ ...b, modules })) }));
}

const dialog = (props: { live?: boolean; s?: SaleDto } = {}) => (
  <ReceiptDialog sale={props.s ?? sale} open onOpenChange={() => undefined} live={props.live ?? true} />
);
/** rerender replaces the whole tree, so the providers renderWithProviders added must come again. */
const withClient = (client: QueryClient, ui: ReactElement) => (
  <QueryClientProvider client={client}><TooltipProvider>{ui}</TooltipProvider></QueryClientProvider>
);
/** Lets the frame auto-print waits for go by. */
const nextFrames = () => act(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

describe('auto-printing the receipt', () => {
  it('does not print with the preference off', async () => {
    withModules(['sales']);
    usePreferences.setState({ autoPrintReceipt: false });
    renderWithProviders(dialog());
    await screen.findByText('Thank you for your business!');
    await nextFrames();
    expect(print).not.toHaveBeenCalled();
  });

  it('prints a sale just made once, even after re-renders and under StrictMode', async () => {
    withModules(['sales']);
    const { rerender, client } = renderWithProviders(<StrictMode>{dialog()}</StrictMode>);
    await waitFor(() => expect(print).toHaveBeenCalledOnce());
    // The page was sized for the 80 mm roll.
    expect(document.getElementById('receipt-page')?.textContent).toMatch(/size: 80mm \d+mm/);
    rerender(withClient(client, <StrictMode>{dialog({ s: { ...sale } })}</StrictMode>));
    await nextFrames();
    expect(print).toHaveBeenCalledOnce();
  });

  it('closes once the automatic print has gone to the printer, but not after a print from the button', async () => {
    withModules(['sales']);
    const onOpenChange = vi.fn();
    renderWithProviders(<ReceiptDialog sale={sale} open onOpenChange={onOpenChange} live />);
    await waitFor(() => expect(print).toHaveBeenCalledOnce());
    expect(onOpenChange).not.toHaveBeenCalled();
    act(() => { window.dispatchEvent(new Event('afterprint')); });
    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);

    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    act(() => { window.dispatchEvent(new Event('afterprint')); });
    expect(print).toHaveBeenCalledTimes(2);
    expect(onOpenChange).toHaveBeenCalledOnce();
  });

  it('stays open while it waits to print', async () => {
    withModules(['sales', 'etims']);
    receipt = pending;
    const onOpenChange = vi.fn();
    renderWithProviders(<ReceiptDialog sale={sale} open onOpenChange={onOpenChange} live />);
    await screen.findByText('KRA signature pending — reprint shortly');
    act(() => { window.dispatchEvent(new Event('afterprint')); });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('does not print the same sale again when the cashier switches the paper', async () => {
    withModules(['sales']);
    renderWithProviders(dialog());
    await waitFor(() => expect(print).toHaveBeenCalledOnce());
    await userEvent.click(screen.getByRole('button', { name: 'A4' }));
    await nextFrames();
    expect(print).toHaveBeenCalledOnce();
  });

  it('prints the next sale too', async () => {
    withModules(['sales']);
    const { rerender, client } = renderWithProviders(dialog());
    await waitFor(() => expect(print).toHaveBeenCalledOnce());
    rerender(withClient(client, dialog({ s: { ...sale, saleId: 's2', saleNumber: 'INV-000043' } })));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(2));
  });

  it('never prints a reprint from the sale’s page by itself', async () => {
    withModules(['sales']);
    renderWithProviders(dialog({ live: false }));
    await screen.findByText('Thank you for your business!');
    await nextFrames();
    expect(print).not.toHaveBeenCalled();
  });

  it('does not print a sale that is not completed', async () => {
    withModules(['sales']);
    renderWithProviders(dialog({ s: { ...sale, status: SaleStatus.Pending } }));
    await screen.findByText('Thank you for your business!');
    await nextFrames();
    expect(print).not.toHaveBeenCalled();
  });

  describe('with eTIMS', () => {
    it('waits while KRA’s signature is pending, and prints once it is signed', async () => {
      withModules(['sales', 'etims']);
      receipt = pending;
      const { client } = renderWithProviders(dialog());
      await screen.findByText('KRA signature pending — reprint shortly');
      await nextFrames();
      expect(print).not.toHaveBeenCalled();

      receipt = signed;
      await act(() => client.refetchQueries({ queryKey: ['etims-receipt', 's1'] }));
      await waitFor(() => expect(print).toHaveBeenCalledOnce());
      expect(screen.getByText('KRACU0100000012')).toBeInTheDocument();
    });

    it('prints when the sale will never be reported (404)', async () => {
      withModules(['sales', 'etims']);
      receipt = 'none';
      renderWithProviders(dialog());
      await waitFor(() => expect(print).toHaveBeenCalledOnce());
    });

    it('does not print a sale KRA rejected', async () => {
      withModules(['sales', 'etims']);
      receipt = { ...pending, status: EtimsSubmissionStatus.Rejected, resultMessage: 'Invalid item classification code' };
      renderWithProviders(dialog());
      await screen.findByText('KRA signature pending — reprint shortly');
      await nextFrames();
      expect(print).not.toHaveBeenCalled();
    });
  });
});
