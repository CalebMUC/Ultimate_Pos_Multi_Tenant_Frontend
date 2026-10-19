import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BRANCH_FORBIDDEN_EVENT } from '@/api/client';
import { branchParam } from '@/api/branchScope';
import { movementName } from '@/api/mappers';
import { tokenStorage } from '@/api/tokenStorage';
import { StockTransferStatus } from '@/api/enums';
import { queryClient } from '@/lib/queryClient';
import { useCartStore } from '@/stores/cart';
import { useSession } from '@/stores/session';
import { API, BUSINESS_ID, HEAD_OFFICE, ok, renderWithProviders, signIn, WESTLANDS } from '@/test/render';
import { landingPath } from '@/features/auth/AuthGuard';
import { switchBranch } from '@/features/auth/sessionActions';
import { accessScreen } from '@/features/access/access';
import { BlockedScreen } from '@/features/access/BlockedScreen';
import { ReceiveTransferDialog } from '@/features/transfers/ReceiveTransferDialog';
import type { StockTransferDto } from '@/api/dto/branches';
import type { LoginResponseDto } from '@/api/dto/identity';
import { BranchSwitcher } from './BranchSwitcher';
import { branchLabel, useBranchFilter } from './branches';

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/sales',
  useSearchParams: () => search,
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

let switchBody: Record<string, unknown> | null = null;
let receiveBody: Record<string, unknown> | null = null;

function loginResponse(activeBranchId: string, token: string): LoginResponseDto {
  return {
    token,
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    refreshToken: `refresh-for-${token}`,
    refreshTokenExpiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    user: { id: 'u1', email: 'admin@test.ke', fullName: 'Test Admin', phoneNumber: null, isActive: true, isLocked: false, roles: ['Admin'], permissions: [] },
    activeBusinessId: BUSINESS_ID,
    businesses: [],
    activeBranchId,
    branches: [HEAD_OFFICE, WESTLANDS],
  };
}

const transfer: StockTransferDto = {
  stockTransferId: 't1', transferNumber: 'TRF-000007', fromBranchId: HEAD_OFFICE.branchId, fromBranchName: 'Head Office', fromKraBranchId: '00',
  toBranchId: WESTLANDS.branchId, toBranchName: 'Westlands', toKraBranchId: '01', status: StockTransferStatus.Dispatched, notes: null,
  createdAt: '2026-10-19T06:00:00Z', createdBy: null, dispatchedAt: '2026-10-19T07:00:00Z', receivedAt: null, receiveNotes: null,
  dispatchedValue: 4200, shortageValue: null,
  lines: [
    { stockTransferLineId: 'l1', productId: 'p1', productName: 'Panadol 500mg', sku: 'MED-1', unitOfMeasureId: 'box', unitSymbol: 'box', quantity: 10,
      quantityInBaseUnits: 100, quantityReceivedInBaseUnits: null, shortageInBaseUnits: 0, unitCost: 4.2,
      batches: [{ batchNumber: 'B-221', expiryDate: '2027-03-31', quantityInBaseUnits: 100, quantityReceivedInBaseUnits: null }] },
    { stockTransferLineId: 'l2', productId: 'p2', productName: 'ORS sachet', sku: 'MED-2', unitOfMeasureId: 'pcs', unitSymbol: 'pcs', quantity: 50,
      quantityInBaseUnits: 50, quantityReceivedInBaseUnits: null, shortageInBaseUnits: 0, unitCost: 10, batches: [] },
  ],
};

const server = setupServer(
  http.post(`${API}/auth/switch-branch`, async ({ request }) => {
    switchBody = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(ok(loginResponse(String(switchBody.branchId), 'westlands-token')));
  }),
  http.post(`${API}/stock-transfers/t1/receive`, async ({ request }) => {
    receiveBody = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(ok({ ...transfer, status: StockTransferStatus.Received }));
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  switchBody = null;
  receiveBody = null;
  search = new URLSearchParams();
  replace.mockReset();
  queryClient.clear();
  signIn([], { branches: [HEAD_OFFICE, WESTLANDS] });
});

describe('labels and parameters', () => {
  it('labels a branch with its KRA number', () => {
    expect(branchLabel({ kraBranchId: '01', name: 'Westlands' })).toBe('01 · Westlands');
    expect(branchLabel({ kraBranchId: '00', branchName: 'Head Office' })).toBe('00 · Head Office');
    expect(branchLabel(null)).toBe('—');
  });

  it('sends ?branchId only when narrowed', () => {
    expect(branchParam({ branchId: 'x' })).toEqual({ branchId: 'x' });
    expect(branchParam({})).toEqual({});
    expect(branchParam(undefined)).toEqual({});
  });

  it('names transfer movements from their notes', () => {
    expect(movementName('TransferOut', 'TRF-000001 to 02 Kisumu')).toBe('Transfer to 02 Kisumu');
    expect(movementName('TransferIn', 'TRF-000001 from 01 Westlands')).toBe('Transfer from 01 Westlands');
    expect(movementName('TransferOut', null)).toBe('Transfer out');
    expect(movementName('SaleReturn', null)).toBe('Sale Return');
  });

  it('has a blocking screen for NO_BRANCH', () => {
    expect(accessScreen('NO_BRANCH')).toMatchObject({ title: 'You haven’t been assigned to a branch yet', description: 'Ask your administrator.' });
  });
});

describe('sign-in order', () => {
  const cashier = { permissions: ['Sales.Create'], activeBusinessId: BUSINESS_ID, mustChangePassword: false };

  it('asks for a branch when there are several', () => {
    expect(landingPath(cashier, null, false, true)).toBe(`/select-branch?returnTo=${encodeURIComponent('/pos')}`);
    expect(landingPath(cashier, '/sales', false, true)).toBe(`/select-branch?returnTo=${encodeURIComponent('/sales')}`);
    expect(landingPath(cashier, null, false, false)).toBe('/pos');
  });

  it('puts the password change first and the business picker before the branch picker', () => {
    expect(landingPath({ ...cashier, mustChangePassword: true }, null, false, true)).toBe(`/change-password?returnTo=${encodeURIComponent(`/select-branch?returnTo=${encodeURIComponent('/pos')}`)}`);
    expect(landingPath(cashier, null, true, true)).toBe('/select-business');
  });
});

describe('switching branch', () => {
  it('replaces both tokens and drops the old branch’s data, cart included', async () => {
    tokenStorage.setRefreshToken('old-refresh');
    queryClient.setQueryData(['sales', BUSINESS_ID, null], { items: ['a sale at head office'] });
    useCartStore.getState().update(BUSINESS_ID, (c) => ({ ...c, notes: 'half-built sale' }));

    await switchBranch(WESTLANDS.branchId);

    expect(switchBody).toEqual({ branchId: WESTLANDS.branchId, refreshToken: 'old-refresh' });
    const session = useSession.getState();
    expect(session.activeBranchId).toBe(WESTLANDS.branchId);
    expect(session.accessToken).toBe('westlands-token');
    expect(tokenStorage.getRefreshToken()).toBe('refresh-for-westlands-token');
    expect(tokenStorage.getLastBranchId(BUSINESS_ID)).toBe(WESTLANDS.branchId);
    expect(queryClient.getQueryData(['sales', BUSINESS_ID, null])).toBeUndefined();
    expect(useCartStore.getState().carts[BUSINESS_ID]).toBeUndefined();
  });
});

describe('header switcher', () => {
  it('is a plain label for a single branch', () => {
    signIn([], { branches: [HEAD_OFFICE] });
    renderWithProviders(<BranchSwitcher />);
    expect(screen.getByTestId('branch-label')).toHaveTextContent('00 Head Office');
    expect(screen.queryByRole('button', { name: /Switch branch/ })).not.toBeInTheDocument();
  });

  it('lists the branches and switches', async () => {
    renderWithProviders(<BranchSwitcher />);
    await userEvent.click(screen.getByRole('button', { name: 'Branch: 00 · Head Office. Switch branch' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Westlands/ }));
    await waitFor(() => expect(useSession.getState().activeBranchId).toBe(WESTLANDS.branchId));
  });
});

function FilterProbe() {
  const f = useBranchFilter();
  return <p data-testid="filter">{JSON.stringify({ visible: f.visible, branchId: f.branchId, scope: f.scope })}</p>;
}
const probe = () => JSON.parse(screen.getByTestId('filter').textContent ?? '{}');

describe('branch filter', () => {
  it('is hidden for users who see one branch', () => {
    signIn([], { branches: [HEAD_OFFICE] });
    search = new URLSearchParams(`branchId=${HEAD_OFFICE.branchId}`);
    renderWithProviders(<FilterProbe />);
    expect(probe()).toEqual({ visible: false, branchId: null, scope: {} });
  });

  it('reads the branch from the URL and narrows the reads', () => {
    search = new URLSearchParams(`branchId=${WESTLANDS.branchId}&page=2`);
    renderWithProviders(<FilterProbe />);
    expect(probe()).toEqual({ visible: true, branchId: WESTLANDS.branchId, scope: { branchId: WESTLANDS.branchId } });
  });

  it('ignores a branch the user can’t see', () => {
    search = new URLSearchParams('branchId=someone-elses-branch');
    renderWithProviders(<FilterProbe />);
    expect(probe().branchId).toBeNull();
  });

  it('resets to all branches on BRANCH_FORBIDDEN, keeping other parameters', async () => {
    search = new URLSearchParams(`branchId=${WESTLANDS.branchId}&status=1`);
    renderWithProviders(<FilterProbe />);
    act(() => { window.dispatchEvent(new Event(BRANCH_FORBIDDEN_EVENT)); });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/sales?status=1', { scroll: false }));
  });
});

describe('NO_BRANCH', () => {
  it('blocks with a screen that points to the administrator', () => {
    renderWithProviders(<BlockedScreen code="NO_BRANCH" />);
    expect(screen.getByRole('heading', { name: 'You haven’t been assigned to a branch yet' })).toBeInTheDocument();
    expect(screen.getByText('Ask your administrator.')).toBeInTheDocument();
    expect(screen.queryByText(/Contact the Ultimate POS team/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign out/ })).toBeInTheDocument();
  });
});

describe('receiving a transfer', () => {
  it('starts every line at the full quantity and sends only the short ones', async () => {
    const user = userEvent.setup();
    const onReceived = vi.fn();
    renderWithProviders(<ReceiveTransferDialog transfer={transfer} open onOpenChange={() => undefined} onReceived={onReceived} />);
    const panadol = screen.getByLabelText('Received of Panadol 500mg');
    expect(panadol).toHaveValue(10);
    expect(screen.getByLabelText('Received of ORS sachet')).toHaveValue(50);
    expect(screen.getByText('B-221')).toBeInTheDocument();

    await user.clear(panadol);
    await user.type(panadol, '8');
    expect(screen.getByText('Short 2 box')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Receive with 1 short line' }));

    await waitFor(() => expect(onReceived).toHaveBeenCalled());
    expect(receiveBody).toEqual({ lines: [{ stockTransferLineId: 'l1', quantityReceived: 8 }], notes: null });
  });

  it('sends no lines when everything arrived', async () => {
    renderWithProviders(<ReceiveTransferDialog transfer={transfer} open onOpenChange={() => undefined} onReceived={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'Receive everything' }));
    await waitFor(() => expect(receiveBody).toEqual({ lines: null, notes: null }));
  });
});
