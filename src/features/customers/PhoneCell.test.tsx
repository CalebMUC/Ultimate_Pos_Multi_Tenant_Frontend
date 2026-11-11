import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PriceType } from '@/api/enums';
import { API, ok, renderWithProviders, signIn } from '@/test/render';
import type { CustomerDto } from '@/api/dto/business';
import CustomersPage from '@/app/(app)/customers/page';

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
  usePathname: () => '/customers',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

const base: CustomerDto = {
  customerId: '', businessId: 'b1', customerName: '', kraPin: null, contactPerson: 'Jane', phoneNumber: null,
  email: 'shop@example.com', physicalAddress: 'Ruiru', isActive: true, priceType: PriceType.Wholesale, creditLimit: 5000,
};
let customers: CustomerDto[] = [];
let puts: { id: string; body: Record<string, unknown> }[] = [];
let refuse: string | null = null;

const server = setupServer(
  http.get(`${API}/customers`, () => HttpResponse.json(ok(customers))),
  http.put(`${API}/customers/:id`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    puts.push({ id: String(params.id), body });
    if (refuse) {
      return HttpResponse.json({ success: false, data: null, error: { code: 'VALIDATION_FAILED', message: 'Invalid', details: { phoneNumber: [refuse] } }, meta: null }, { status: 400 });
    }
    customers = customers.map((c) => (c.customerId === params.id ? { ...c, phoneNumber: (body.phoneNumber as string | null) } : c));
    return HttpResponse.json(ok(customers.find((c) => c.customerId === params.id)));
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  customers = [
    { ...base, customerId: 'c1', customerName: 'Wanjiku Stores', phoneNumber: '254712345678' },
    { ...base, customerId: 'c2', customerName: 'Otieno Hardware', creditLimit: null },
  ];
  puts = [];
  refuse = null;
  nav.push.mockReset();
});

const row = async (name: string) => (await screen.findByText(name)).closest('tr')!;

describe('phone in the customers list', () => {
  it('adds a missing phone in the row, sending the rest of the customer unchanged and without opening it', async () => {
    signIn(['Customers.View', 'Customers.Update']);
    renderWithProviders(<CustomersPage />);
    const r = await row('Otieno Hardware');
    await userEvent.click(within(r).getByRole('button', { name: 'Add Otieno Hardware’s phone' }));
    await userEvent.type(within(r).getByRole('textbox', { name: 'Phone for Otieno Hardware' }), '0722 000 111{Enter}');

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({
      id: 'c2',
      body: {
        customerName: 'Otieno Hardware', kraPin: null, contactPerson: 'Jane', phoneNumber: '0722 000 111', email: 'shop@example.com',
        physicalAddress: 'Ruiru', priceType: PriceType.Wholesale, creditLimit: null,
      },
    });
    expect(await within(await row('Otieno Hardware')).findByText('0722 000 111')).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('changes a phone, and Escape leaves it as it was', async () => {
    signIn(['Customers.View', 'Customers.Update']);
    renderWithProviders(<CustomersPage />);
    let r = await row('Wanjiku Stores');
    await userEvent.click(within(r).getByRole('button', { name: 'Edit Wanjiku Stores’s phone' }));
    await userEvent.type(within(r).getByRole('textbox', { name: 'Phone for Wanjiku Stores' }), '9{Escape}');
    expect(within(r).getByText('254712345678')).toBeInTheDocument();
    expect(puts).toHaveLength(0);

    await userEvent.click(within(r).getByRole('button', { name: 'Edit Wanjiku Stores’s phone' }));
    const input = within(r).getByRole('textbox', { name: 'Phone for Wanjiku Stores' });
    await userEvent.clear(input);
    await userEvent.type(input, '0733444555');
    await userEvent.click(within(r).getByRole('button', { name: 'Save phone' }));
    await waitFor(() => expect(puts[0]?.body).toMatchObject({ phoneNumber: '0733444555', creditLimit: 5000 }));
    r = await row('Wanjiku Stores');
    expect(await within(r).findByText('0733444555')).toBeInTheDocument();
  });

  it('checks the number before sending and shows what the API refuses beside it', async () => {
    signIn(['Customers.View', 'Customers.Update']);
    renderWithProviders(<CustomersPage />);
    const r = await row('Otieno Hardware');
    await userEvent.click(within(r).getByRole('button', { name: 'Add Otieno Hardware’s phone' }));
    const input = within(r).getByRole('textbox', { name: 'Phone for Otieno Hardware' });
    await userEvent.type(input, 'abc{Enter}');
    expect(within(r).getByRole('alert')).toHaveTextContent('Enter a valid phone number.');
    expect(puts).toHaveLength(0);

    refuse = 'Another customer already has this phone number.';
    await userEvent.clear(input);
    await userEvent.type(input, '0722000111{Enter}');
    expect(await within(r).findByRole('alert')).toHaveTextContent('Another customer already has this phone number.');
    expect(input).toBeInTheDocument();
  });

  it('is read-only without Customers.Update', async () => {
    signIn(['Customers.View']);
    renderWithProviders(<CustomersPage />);
    const r = await row('Wanjiku Stores');
    expect(within(r).getByText('254712345678')).toBeInTheDocument();
    expect(within(r).queryByRole('button')).not.toBeInTheDocument();
    const otieno = await row('Otieno Hardware');
    expect(within(otieno).getAllByText('—')).toHaveLength(2); // no phone, no KRA PIN
    expect(within(otieno).queryByRole('button')).not.toBeInTheDocument();
  });
});
