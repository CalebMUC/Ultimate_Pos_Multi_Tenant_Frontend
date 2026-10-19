import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { StockTransferStatus } from '@/api/enums';
import { API, HEAD_OFFICE, ok, renderWithProviders, signIn, WESTLANDS } from '@/test/render';
import type { StockTransferDto } from '@/api/dto/branches';
import TransferPage from '@/app/(app)/stock-transfers/[id]/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/stock-transfers/t1',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 't1' }),
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

const base: StockTransferDto = {
  stockTransferId: 't1', transferNumber: 'TRF-000007', fromBranchId: HEAD_OFFICE.branchId, fromBranchName: 'Head Office', fromKraBranchId: '00',
  toBranchId: WESTLANDS.branchId, toBranchName: 'Westlands', toKraBranchId: '01', status: StockTransferStatus.Draft, notes: null,
  createdAt: '2026-10-19T06:00:00Z', createdBy: null, dispatchedAt: null, receivedAt: null, receiveNotes: null, dispatchedValue: 4200, shortageValue: null,
  lines: [{ stockTransferLineId: 'l1', productId: 'p1', productName: 'Panadol 500mg', sku: 'MED-1', unitOfMeasureId: 'box', unitSymbol: 'box', quantity: 10,
    quantityInBaseUnits: 100, quantityReceivedInBaseUnits: null, shortageInBaseUnits: 0, unitCost: 4.2, batches: [] }],
};
let current = base;
const server = setupServer(http.get(`${API}/stock-transfers/t1`, () => HttpResponse.json(ok(current))));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
const ALL = ['StockTransfers.View', 'StockTransfers.Create', 'StockTransfers.Dispatch', 'StockTransfers.Receive'];
beforeEach(() => { current = base; });

describe('transfer actions follow the branch', () => {
  it('offers Dispatch and Cancel at the source branch', async () => {
    signIn(ALL, { branches: [HEAD_OFFICE] });
    renderWithProviders(<TransferPage />);
    expect(await screen.findByRole('button', { name: /Dispatch/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel draft/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Transfer progress')).toHaveTextContent('1. Draft');
  });

  it('hides Dispatch from staff who don’t work at the source', async () => {
    signIn(ALL, { branches: [WESTLANDS] });
    renderWithProviders(<TransferPage />);
    await screen.findByText('Panadol 500mg');
    expect(screen.queryByRole('button', { name: /Dispatch/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel draft/ })).not.toBeInTheDocument();
  });

  it('offers Receive only at the destination', async () => {
    current = { ...base, status: StockTransferStatus.Dispatched, dispatchedAt: '2026-10-19T07:00:00Z' };
    signIn(ALL, { branches: [HEAD_OFFICE] });
    const first = renderWithProviders(<TransferPage />);
    await screen.findByText('Panadol 500mg');
    expect(screen.queryByRole('button', { name: /Receive/ })).not.toBeInTheDocument();
    expect(screen.getByText(/It is received by staff at 01 · Westlands/)).toBeInTheDocument();
    first.unmount();

    signIn(ALL, { branches: [WESTLANDS] });
    renderWithProviders(<TransferPage />);
    expect(await screen.findByRole('button', { name: /Receive/ })).toBeInTheDocument();
  });

  it('shows costs only with Costing.View', async () => {
    signIn(ALL, { branches: [HEAD_OFFICE] });
    const first = renderWithProviders(<TransferPage />);
    await screen.findByText('Panadol 500mg');
    expect(screen.queryByText('Value dispatched')).not.toBeInTheDocument();
    first.unmount();

    signIn([...ALL, 'Costing.View'], { branches: [HEAD_OFFICE] });
    renderWithProviders(<TransferPage />);
    expect(await screen.findByText('Value dispatched')).toBeInTheDocument();
  });
});
