import { renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EtimsDocumentType, EtimsSubmissionStatus } from '@/api/enums';
import { API, ok, renderWithProviders, signIn } from '@/test/render';
import { useSession } from '@/stores/session';
import { useVisibleNavigation } from '@/components/layout/Sidebar';
import PlatformEtimsPage from '@/app/platform/etims/page';
import PlatformEtimsBusinessPage from '@/app/platform/etims/[businessId]/page';
import type { EtimsDeviceDto, PlatformEtimsBusinessDto, PlatformEtimsBusinessRowDto, PlatformEtimsOverviewDto } from '@/api/dto/etims';
import { sortByProblem } from './platform';

const BUSINESS = 'b0000000-0000-0000-0000-0000000000e1';
// The page's tab and filters come from the URL.
const url = vi.hoisted(() => ({ search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/platform/etims',
  useSearchParams: () => new URLSearchParams(url.search),
  useParams: () => ({ businessId: 'b0000000-0000-0000-0000-0000000000e1' }),
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

const row = (over: Partial<PlatformEtimsBusinessRowDto>): PlatformEtimsBusinessRowDto => ({
  businessId: BUSINESS, businessName: 'Duka Bora', kraPin: 'P051234567X', etimsEnabled: true, businessActive: true, businessSuspended: false,
  deviceCount: 0, activeDeviceCount: 0, pending: 0, failed: 0, rejected: 0, sent: 0, lastSentAt: null, oldestProblemAt: null, ...over,
});
const overview: PlatformEtimsOverviewDto = {
  businessCount: 1, deviceCount: 0, activeDeviceCount: 0, pending: 0, failed: 0, rejected: 0, businesses: [row({})],
};
const business: PlatformEtimsBusinessDto = {
  businessId: BUSINESS, businessName: 'Duka Bora', kraPin: 'P051234567X', etimsEnabled: true, etimsEnabledAt: '2026-10-28T08:00:00Z',
  branches: [{ branchId: 'br1', name: 'Head Office', kraBranchId: '00', isActive: true, device: null }],
};

let submissionParams: URLSearchParams | null = null;
let registered: { businessId: string; body: Record<string, unknown> } | null = null;
const server = setupServer(
  http.get(`${API}/platform/etims`, () => HttpResponse.json(ok(overview))),
  http.get(`${API}/platform/etims/submissions`, ({ request }) => {
    submissionParams = new URL(request.url).searchParams;
    return HttpResponse.json(ok([{
      businessId: BUSINESS, businessName: 'Duka Bora', branchName: 'Head Office', tin: 'P051234567X', bhfId: '00',
      submission: {
        etimsSubmissionId: 's1', etimsDeviceId: 'd1', branchId: 'br1', documentType: EtimsDocumentType.Item, sourceType: 'Product', sourceId: 'p1',
        documentNumber: null, endpoint: '/saveItem', status: EtimsSubmissionStatus.Rejected, attempts: 5, nextAttemptAt: '2026-10-29T08:00:00Z',
        lastAttemptAt: '2026-10-29T07:00:00Z', sentAt: null, resultCode: '910', resultMessage: 'Request parameter error', receiptNumber: null,
        createdAt: '2026-10-29T06:00:00Z',
      },
    }], { page: 1, pageSize: 25, totalCount: 1, totalPages: 1 }));
  }),
  http.get(`${API}/platform/etims/businesses/:id`, () => HttpResponse.json(ok(business))),
  http.post(`${API}/platform/etims/businesses/:id/devices`, async ({ params, request }) => {
    registered = { businessId: params.id as string, body: (await request.json()) as Record<string, unknown> };
    return HttpResponse.json(ok({ branchName: 'Head Office', sdcId: 'KRACU0100000001', mrcNo: 'WIS01000001' } as Partial<EtimsDeviceDto>));
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

/** A super user: platform permissions, no business. */
function superUser(permissions: string[]) {
  signIn(permissions);
  useSession.setState({ activeBusinessId: null, businesses: [], business: null });
}

beforeEach(() => {
  url.search = '';
  submissionParams = null;
  registered = null;
});

describe('the platform menu', () => {
  const menu = () => {
    const client = new QueryClient();
    const { result } = renderHook(() => useVisibleNavigation('platform'), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
    return result.current.map((g) => g.label);
  };

  it('shows KRA eTIMS with Platform.Etims.View', () => {
    superUser(['Businesses.ViewAll', 'Platform.Etims.View']);
    expect(menu()).toContain('KRA eTIMS');
  });

  it('hides it without', () => {
    superUser(['Businesses.ViewAll']);
    expect(menu()).not.toContain('KRA eTIMS');
  });
});

describe('the overview', () => {
  it('flags a business with eTIMS on and no device', async () => {
    superUser(['Platform.Etims.View']);
    renderWithProviders(<PlatformEtimsPage />);
    expect(await screen.findByText('Not reporting: no device registered.')).toBeInTheDocument();
  });

  it('puts the oldest problem first, then businesses without problems', () => {
    const sorted = sortByProblem([
      row({ businessId: 'a', businessName: 'Alpha' }),
      row({ businessId: 'b', businessName: 'Beta', oldestProblemAt: '2026-10-29T06:00:00Z' }),
      row({ businessId: 'c', businessName: 'Gamma', oldestProblemAt: '2026-10-20T06:00:00Z' }),
    ]);
    expect(sorted.map((r) => r.businessName)).toEqual(['Gamma', 'Beta', 'Alpha']);
  });
});

describe('needs attention', () => {
  it('asks for no status by default, so the API lists Failed and Rejected', async () => {
    superUser(['Platform.Etims.View', 'Platform.Etims.Manage']);
    url.search = 'tab=submissions';
    renderWithProviders(<PlatformEtimsPage />);
    expect(await screen.findByText('Request parameter error')).toBeInTheDocument();
    expect(submissionParams).not.toBeNull();
    expect(submissionParams!.has('status')).toBe(false);
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
  });

  it('starts filtered to the business and status a count link names', async () => {
    superUser(['Platform.Etims.View']);
    url.search = `tab=submissions&businessId=${BUSINESS}&status=${EtimsSubmissionStatus.Rejected}`;
    renderWithProviders(<PlatformEtimsPage />);
    await waitFor(() => expect(submissionParams?.get('status')).toBe(String(EtimsSubmissionStatus.Rejected)));
    expect(submissionParams!.get('businessId')).toBe(BUSINESS);
  });
});

describe('onboarding a business', () => {
  it('registers a branch device through the platform route, with the business’s PIN shown', async () => {
    superUser(['Platform.Etims.View', 'Platform.Etims.Manage']);
    const user = userEvent.setup();
    renderWithProviders(<PlatformEtimsBusinessPage />);
    await user.click(await screen.findByRole('button', { name: /Register device/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByDisplayValue('P051234567X')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/^Device serial number/), 'UPOSP052446551J001');
    await user.type(within(dialog).getByLabelText(/^Default item classification/), '1010160100');
    await user.click(within(dialog).getByRole('button', { name: 'Register device' }));
    await waitFor(() => expect(registered).not.toBeNull());
    expect(registered).toEqual({
      businessId: BUSINESS,
      body: expect.objectContaining({ branchId: 'br1', deviceSerialNumber: 'UPOSP052446551J001', defaultItemClassCode: '1010160100' }),
    });
  });

  it('offers no device actions without Platform.Etims.Manage', async () => {
    superUser(['Platform.Etims.View']);
    renderWithProviders(<PlatformEtimsBusinessPage />);
    expect(await screen.findByText('Not reporting to KRA')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Register device/ })).not.toBeInTheDocument();
  });
});
