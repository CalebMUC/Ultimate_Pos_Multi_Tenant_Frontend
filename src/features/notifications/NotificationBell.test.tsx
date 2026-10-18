import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventSeverity } from '@/api/enums';
import { API, BUSINESS_ID, ok, paged, renderWithProviders, signIn } from '@/test/render';
import type { NotificationDto } from '@/api/dto/notifications';
import { NotificationBell } from './NotificationBell';
import { notificationKeys } from './useNotifications';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }));
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: (...a: unknown[]) => toastError(...a), success: vi.fn(), info: vi.fn() }) }));

const note = (over: Partial<NotificationDto> = {}): NotificationDto => ({
  notificationId: crypto.randomUUID(), eventType: 'Stock.BelowReorderLevel', severity: EventSeverity.Warning, title: 'Low stock',
  message: 'Panadol 500mg is below its reorder level.', link: '/inventory?productId=p1', isRead: false, readAt: null,
  createdAt: new Date(Date.now() - 5 * 60_000).toISOString(), businessId: BUSINESS_ID, ...over,
});

let unread = 0;
let items: NotificationDto[] = [];
let readAll: 'ok' | 'fail' = 'ok';
const reads: string[] = [];

const server = setupServer(
  http.get(`${API}/notifications/unread-count`, () => HttpResponse.json(ok({ unreadCount: unread }))),
  http.get(`${API}/notifications`, () => HttpResponse.json(paged(items, 1, 10))),
  http.post(`${API}/notifications/:id/read`, ({ params }) => {
    reads.push(String(params.id));
    unread = Math.max(0, unread - 1);
    items = items.map((n) => (n.notificationId === params.id ? { ...n, isRead: true } : n));
    return HttpResponse.json(ok({}));
  }),
  http.post(`${API}/notifications/read-all`, async () => {
    await delay(80);
    if (readAll === 'fail') return HttpResponse.json({ success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'Server error' } }, { status: 500 });
    const marked = unread;
    unread = 0;
    items = items.map((n) => ({ ...n, isRead: true }));
    return HttpResponse.json(ok({ marked }));
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  signIn([]);
  unread = 0;
  items = [];
  readAll = 'ok';
  reads.length = 0;
  push.mockReset();
  toastError.mockReset();
});

describe('notification bell badge', () => {
  it.each([
    [0, null],
    [5, '5'],
    [120, '99+'],
  ])('shows %i unread as %s', async (count, text) => {
    unread = count;
    renderWithProviders(<NotificationBell />);
    await waitFor(() => expect(screen.getByRole('button', { name: `Notifications, ${count} unread` })).toBeInTheDocument());
    if (text === null) expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
    else expect(await screen.findByTestId('notification-badge')).toHaveTextContent(text);
  });
});

describe('notification popover', () => {
  it('shows the empty state', async () => {
    renderWithProviders(<NotificationBell />);
    await userEvent.click(await screen.findByRole('button', { name: /Notifications, 0 unread/ }));
    expect(await screen.findByText('You’re all caught up.')).toBeInTheDocument();
  });

  it('marks a row read and follows its link', async () => {
    const n = note();
    items = [n];
    unread = 1;
    renderWithProviders(<NotificationBell />);
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    await userEvent.click(await screen.findByText('Low stock'));
    expect(push).toHaveBeenCalledWith('/inventory?productId=p1');
    await waitFor(() => expect(reads).toEqual([n.notificationId]));
    await waitFor(() => expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument());
  });

  it('marks all read optimistically', async () => {
    items = [note(), note()];
    unread = 2;
    renderWithProviders(<NotificationBell />);
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }));
    await userEvent.click(await screen.findByRole('button', { name: /Mark all as read/ }));
    // Before the (delayed) response arrives, the badge is already gone.
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications, 0 unread' })).toBeInTheDocument());
  });

  it('rolls the badge back when mark-all fails', async () => {
    items = [note(), note(), note()];
    unread = 3;
    readAll = 'fail';
    renderWithProviders(<NotificationBell />);
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 3 unread' }));
    // Hold the follow-up refetch back, so the badge can only return through the rollback.
    server.use(http.get(`${API}/notifications/unread-count`, async () => { await delay(5000); return HttpResponse.json(ok({ unreadCount: unread })); }));
    await userEvent.click(await screen.findByRole('button', { name: /Mark all as read/ }));
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
    expect(await screen.findByTestId('notification-badge', {}, { timeout: 1500 })).toHaveTextContent('3');
    expect(toastError).toHaveBeenCalled();
  });

  it('shows an inline error with retry', async () => {
    server.use(http.get(`${API}/notifications`, () => HttpResponse.json({ success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'boom' } }, { status: 500 })));
    renderWithProviders(<NotificationBell />);
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }));
    const popover = await screen.findByRole('dialog');
    expect(await within(popover).findByText(/Couldn’t load notifications/)).toBeInTheDocument();
    expect(within(popover).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('critical toasts', () => {
  it('toasts a new Critical notification once, not again on the next poll', async () => {
    items = [note({ title: 'Old critical', severity: EventSeverity.Critical, createdAt: new Date(Date.now() - 3600_000).toISOString() })];
    unread = 1;
    const { client } = renderWithProviders(<NotificationBell />);
    await screen.findByTestId('notification-badge');
    await waitFor(() => expect(client.getQueryData(notificationKeys.list(BUSINESS_ID, { unreadOnly: false, page: 1, pageSize: 10 }))).toBeTruthy());
    // The backlog never toasts.
    expect(toastError).not.toHaveBeenCalled();

    // A poll brings a new Critical notification.
    const fresh = note({ title: 'Out of stock', message: 'Panadol is out of stock.', severity: EventSeverity.Critical, createdAt: new Date().toISOString() });
    items = [fresh, ...items];
    unread = 2;
    await act(() => client.invalidateQueries({ queryKey: notificationKeys.unreadCount(BUSINESS_ID) }));
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastError).toHaveBeenCalledWith('Out of stock', expect.objectContaining({ description: 'Panadol is out of stock.' }));

    // The next poll returns the same notification: no second toast.
    await act(() => client.invalidateQueries({ queryKey: notificationKeys.all(BUSINESS_ID) }));
    await waitFor(() => expect(screen.getByTestId('notification-badge')).toHaveTextContent('2'));
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('does not toast Warning or Info notifications', async () => {
    unread = 0;
    const { client } = renderWithProviders(<NotificationBell />);
    await waitFor(() => expect(client.getQueryData(notificationKeys.list(BUSINESS_ID, { unreadOnly: false, page: 1, pageSize: 10 }))).toBeTruthy());
    items = [note({ createdAt: new Date().toISOString() })];
    unread = 1;
    await act(() => client.invalidateQueries({ queryKey: notificationKeys.unreadCount(BUSINESS_ID) }));
    await screen.findByTestId('notification-badge');
    expect(toastError).not.toHaveBeenCalled();
  });
});
