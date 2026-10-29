import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { API, ok, renderWithProviders, signIn } from '@/test/render';
import { useSession } from '@/stores/session';
import type { EtimsCodeDto, EtimsDeviceDto, EtimsProductProfileDto } from '@/api/dto/etims';
import { ProductEtimsTab } from './ProductEtimsTab';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

const device = {
  etimsDeviceId: 'd1', branchId: 'br0', branchName: 'Head Office', tin: 'P052446551J', bhfId: '00', deviceSerialNumber: 'UPOSP052446551J001',
  cmcKeyHint: '233...851', sdcId: 'KRACU0100000012', mrcNo: 'WIS00000012', taxpayerName: 'Duka Bora', kraBranchName: 'HQ', defaultItemClassCode: '1010160100',
  receiptTopMessage: null, receiptBottomMessage: null, isActive: true, activatedAt: '2026-10-01T00:00:00Z', sweptUntil: '2026-10-27T00:00:00Z',
  lastInvoiceNumber: 16, lastStockAdjustmentNumber: 24, lastItemSequence: 14, openingStockQueuedAt: '2026-10-01T00:00:00Z', lastCodeSyncAt: '2026-10-02T00:00:00Z',
  submissionCounts: { Sent: 40, Pending: 0, Failed: 0, Rejected: 0 },
} satisfies EtimsDeviceDto;

const code = (codeClass: string, c: string, name: string): EtimsCodeDto => ({ codeClass, codeClassName: '', code: c, name, useYn: 'Y' });
const codes: Record<string, EtimsCodeDto[]> = {
  10: [code('10', 'KG', 'Kilogram'), code('10', 'U', 'Pieces/item'), code('10', 'BX', 'Box'), code('10', 'LTR', 'Litre'), code('10', 'NO', 'Number')],
  17: [code('17', 'NT', 'Net'), code('17', 'BG', 'Bag'), code('17', 'BXA', 'Box (aluminium)')],
};

let profile: EtimsProductProfileDto;
let saved: unknown = null;
const server = setupServer(
  http.get(`${API}/etims/products/p1`, () => HttpResponse.json(ok(profile))),
  http.put(`${API}/etims/products/p1`, async ({ request }) => {
    saved = await request.json();
    return HttpResponse.json(ok(profile));
  }),
  http.get(`${API}/etims/devices`, () => HttpResponse.json(ok([device]))),
  http.get(`${API}/etims/devices/d1/codes`, ({ request }) => HttpResponse.json(ok(codes[new URL(request.url).searchParams.get('codeClass') ?? ''] ?? []))),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  saved = null;
  profile = {
    productId: 'p1', itemCode: null, itemClassCode: null, effectiveItemClassCode: '5020230500', packagingUnitCode: 'NT', quantityUnitCode: 'KG',
    originCountryCode: 'KE', isRegistered: false,
  };
  signIn(['Products.View', 'Etims.View', 'Etims.Manage']);
  useSession.setState((s) => ({ businesses: s.businesses.map((b) => ({ ...b, modules: ['catalog', 'etims'] })) }));
});

describe('product KRA eTIMS tab', () => {
  it('is read-only once KRA has registered the item, and shows its code', async () => {
    profile = { ...profile, itemCode: 'KE2NTKG0000014', itemClassCode: '5020230500', isRegistered: true };
    renderWithProviders(<ProductEtimsTab productId="p1" categoryName="Cereals" />);
    expect(await screen.findByText('KE2NTKG0000014')).toBeInTheDocument();
    expect(screen.getByText('KRA registers an item once and does not allow changes.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
  });

  it('says where the classification comes from before it is registered', async () => {
    renderWithProviders(<ProductEtimsTab productId="p1" categoryName="Cereals" />);
    expect(await screen.findByText('Not registered with KRA yet')).toBeInTheDocument();
    expect(screen.getByText('From category Cereals: 5020230500')).toBeInTheDocument();
  });

  it('offers only two-letter units, and saves them', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductEtimsTab productId="p1" />);
    await user.click(await screen.findByRole('button', { name: /Edit/ }));
    const quantity = await screen.findByLabelText(/^Quantity unit/);
    await waitFor(() => expect(within(quantity).getAllByRole('option')).toHaveLength(3));
    expect(within(quantity).getAllByRole('option').map((o) => (o as HTMLOptionElement).value)).toEqual(['KG', 'BX', 'NO']);
    expect(quantity).toHaveValue('KG');
    expect(screen.getByText(/Pieces, litres and grams are reported as NO/)).toBeInTheDocument();
    const packaging = screen.getByLabelText(/^Packaging unit/);
    await waitFor(() => expect(within(packaging).getAllByRole('option').map((o) => (o as HTMLOptionElement).value)).toEqual(['NT', 'BG']));

    await user.selectOptions(quantity, 'BX');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saved).toEqual({ itemClassCode: null, quantityUnitCode: 'BX', packagingUnitCode: 'NT', originCountryCode: null }));
  });
});
