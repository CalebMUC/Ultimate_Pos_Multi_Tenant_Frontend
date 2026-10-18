import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventSeverity } from '@/api/enums';
import { addDays, todayIso } from '@/lib/format';
import { API, ok, paged, renderWithProviders, signIn } from '@/test/render';
import type { AuditLogEntryDto } from '@/api/dto/notifications';
import { AuditLogPage } from './AuditLogPage';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/admin/audit-log', useSearchParams: () => new URLSearchParams() }));

const entry: AuditLogEntryDto = {
  systemEventId: 'e1', eventType: 'Sale.Voided', severity: EventSeverity.Warning, summary: 'Sale S-0001 of 500.00 (Cash) was voided.',
  actorUserId: 'u1', actorName: 'Jane Manager', subjectUserId: null, subjectName: null, entityType: 'Sale', entityId: 's1',
  data: '{"SaleNumber":"S-0001","TotalAmount":500,"PaymentMethod":0}', occurredAt: '2026-10-18T07:30:00Z',
};

const requests: URLSearchParams[] = [];
const server = setupServer(
  http.get(`${API}/audit-log`, ({ request }) => {
    requests.push(new URL(request.url).searchParams);
    return HttpResponse.json(paged([entry], 1, 50));
  }),
  http.get(`${API}/audit-log/event-types`, () => HttpResponse.json(ok(['Sale.Returned', 'Sale.Voided', 'Stock.Adjusted']))),
  http.get(`${API}/users`, () => HttpResponse.json(ok([]))),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  requests.length = 0;
  signIn(['AuditLog.View', 'Users.View']);
});

const last = () => requests[requests.length - 1];

describe('audit log filters', () => {
  it('starts on the last 7 days, newest page first, with the local offset', async () => {
    renderWithProviders(<AuditLogPage />);
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    const q = last();
    expect(q.get('from')).toBe(addDays(todayIso(), -6));
    expect(q.get('to')).toBe(todayIso());
    expect(q.get('utcOffsetMinutes')).toBe(String(-new Date().getTimezoneOffset()));
    expect(q.get('page')).toBe('1');
    expect(q.get('pageSize')).toBe('50');
    expect(q.has('eventType')).toBe(false);
    expect(q.has('minimumSeverity')).toBe(false);
  });

  it('sends minimum severity, debounced search and an event-type area', async () => {
    renderWithProviders(<AuditLogPage />);
    await screen.findByText('Sale voided');

    await userEvent.selectOptions(screen.getByLabelText('Minimum severity'), 'Warning');
    await waitFor(() => expect(last().get('minimumSeverity')).toBe('Warning'));

    await userEvent.type(screen.getByLabelText('Search'), 'S-0001');
    await waitFor(() => expect(last().get('search')).toBe('S-0001'));
    // Debounced: no request for a partial word.
    expect(requests.some((q) => q.get('search') === 'S-')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Event type' }));
    await userEvent.click(await screen.findByText('All sale events'));
    await waitFor(() => expect(last().get('eventType')).toBe('Sale'));

    await userEvent.click(screen.getByRole('button', { name: 'Event type' }));
    await userEvent.click(await screen.findByText('Sale returned'));
    await waitFor(() => expect(last().get('eventType')).toBe('Sale.Returned'));
    expect(last().get('page')).toBe('1');
  });
});

describe('audit log rows', () => {
  it('shows readable columns and pretty-prints data when expanded', async () => {
    renderWithProviders(<AuditLogPage />);
    const row = (await screen.findByText('Sale voided')).closest('tr')!;
    expect(row).toHaveTextContent('Jane Manager');
    expect(row).toHaveTextContent('Warning');
    expect(screen.queryByTestId('audit-data')).not.toBeInTheDocument();

    await userEvent.click(row);
    const pre = await screen.findByTestId('audit-data');
    expect(pre.textContent).toBe(JSON.stringify(JSON.parse(entry.data!), null, 2));
    expect(screen.getByRole('link', { name: /Sale/ })).toHaveAttribute('href', '/sales/s1');
    expect(row).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows System when there is no actor', async () => {
    server.use(http.get(`${API}/audit-log`, () => HttpResponse.json(paged([{ ...entry, actorUserId: null, actorName: null }], 1, 50))));
    renderWithProviders(<AuditLogPage />);
    const row = (await screen.findByText('Sale voided')).closest('tr')!;
    expect(row).toHaveTextContent('System');
  });
});
