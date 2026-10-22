import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CashSessionStatus } from '@/api/enums';
import { formatMoney } from '@/lib/format';
import { API, HEAD_OFFICE, ok, renderWithProviders, signIn } from '@/test/render';
import type { CashSessionDto } from '@/api/dto/cashSessions';
import { CashSessionView } from './CashSessionViews';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

// The parts deliberately do not add up to expectedCash: the page must show the API's figure, not its own sum.
const session: CashSessionDto = {
  cashSessionId: 'cs1', sessionNumber: 'CSH-000007', status: CashSessionStatus.Open, branchId: HEAD_OFFICE.branchId, kraBranchId: '00',
  branchName: 'Head Office', openingFloat: 2000, openedAt: '2026-10-22T05:00:00Z', openedBy: 'u1', openedByName: 'Test Admin', openingNotes: null,
  countedCash: null, variance: null, closedAt: null, closedBy: null, closedByName: null, closingNotes: null,
  breakdown: {
    openingFloat: 2000, cashSales: 5400, cashSaleCount: 31, customerPayments: 0, payIns: 0, cashRefunds: 0, cashExpenses: 300,
    supplierPayments: 0, payOuts: 1000, expectedCash: 6123.45, cashStillWithRiders: 780, ordersStillOut: 3,
  },
  movements: [],
};
const closed: CashSessionDto = {
  ...session, status: CashSessionStatus.Closed, countedCash: 5973.45, variance: -150, closedAt: '2026-10-22T18:00:00Z', closedByName: 'Test Admin',
  breakdown: { ...session.breakdown, cashStillWithRiders: 0, ordersStillOut: 0 },
};

let closeBody: unknown = null;
const server = setupServer(
  http.post(`${API}/cash-sessions/cs1/close`, async ({ request }) => {
    closeBody = await request.json();
    return HttpResponse.json(ok(closed));
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  closeBody = null;
  signIn(['CashSessions.View', 'CashSessions.Close', 'CashSessions.RecordMovement']);
});

describe('cash-up', () => {
  it('shows what should be in the drawer as the API worked it out', () => {
    renderWithProviders(<CashSessionView session={session} />);
    expect(screen.getByTestId('expected-cash')).toHaveTextContent(formatMoney(6123.45));
    expect(screen.getByRole('button', { name: /Pay in/ })).toBeInTheDocument();
  });

  it('warns about cash still with riders, then shows the variance the close returned', async () => {
    renderWithProviders(<CashSessionView session={session} />);
    await userEvent.click(screen.getByRole('button', { name: /Close the day/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/is still with riders \(3 order\(s\)\)/)).toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText('Cash counted (KES)'), '5973.45');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close the day' }));

    await waitFor(() => expect(closeBody).toMatchObject({ countedCash: 5973.45 }));
    const variance = await within(dialog).findByTestId('variance');
    expect(variance).toHaveTextContent(formatMoney(-150));
    expect(variance).toHaveTextContent('short');
    expect(within(dialog).getByText('CSH-000007 closed')).toBeInTheDocument();
  });
});
