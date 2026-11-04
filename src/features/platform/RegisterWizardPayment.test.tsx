import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessSector } from '@/api/enums';
import { API, ok, renderWithProviders, signIn } from '@/test/render';
import { RegisterBusinessWizard } from './RegisterBusinessWizard';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/platform', useSearchParams: () => new URLSearchParams() }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

let registerBody: Record<string, unknown> | null = null;
let refuse: Record<string, string[]> | null = null;
const server = setupServer(
  http.post(`${API}/businesses`, async ({ request }) => {
    registerBody = (await request.json()) as Record<string, unknown>;
    if (refuse) {
      const message = Object.values(refuse)[0][0];
      return HttpResponse.json({ success: false, data: null, error: { code: 'VALIDATION_FAILED', message, details: refuse }, meta: null }, { status: 400 });
    }
    return HttpResponse.json(ok({
      business: { businessId: 'nb1', businessName: 'Jirani Minimart', tradingName: null, kind: 1, businessType: 1, kraPin: 'P051234567X', isActive: true, sector: 0 },
      owner: { userId: 'o1', email: 'amina@example.co.ke', fullName: 'Amina Yusuf', created: true, temporaryPassword: 'Tmp-1' },
      trialLicense: { endsOn: '2026-12-01' },
    }));
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
beforeEach(() => {
  signIn(['Businesses.View', 'Businesses.Register']);
  registerBody = null;
  refuse = null;
});

type User = ReturnType<typeof userEvent.setup>;

/** A refill station (its sector suggests the kind), up to the payment step. */
async function toPaymentStep(user: User) {
  renderWithProviders(<RegisterBusinessWizard />);
  await user.type(screen.getByLabelText(/Registered name/), 'Jirani Minimart');
  await user.type(screen.getByLabelText(/KRA PIN/), 'P051234567X');
  await user.selectOptions(screen.getByLabelText(/^Sector/), String(BusinessSector.WaterRefill));
  await user.click(screen.getByRole('button', { name: /Next/ }));
  await screen.findByText('Payment details (for invoices)');
}

async function ownerAndReview(user: User) {
  await user.type(await screen.findByLabelText(/Full name/), 'Amina Yusuf');
  await user.type(screen.getByLabelText(/^Email/), 'amina@example.co.ke');
  await user.click(screen.getByRole('button', { name: /Next/ }));
}

describe('register wizard: payment details', () => {
  it('sends the nine fields, blanks as null, and lists them under Send payment to on the review', async () => {
    const user = userEvent.setup();
    await toPaymentStep(user);
    // Nothing is filled in from the M-Pesa till and paybill.
    expect(screen.getByLabelText('Till number (Buy Goods)')).toHaveValue('');
    await user.type(screen.getByLabelText('Bank name'), 'Equity Bank');
    await user.type(screen.getByLabelText('Branch'), 'Ruiru');
    await user.type(screen.getByLabelText('Account name'), 'Jirani Minimart');
    await user.type(screen.getByLabelText('Account number'), '0123456789');
    await user.type(screen.getByLabelText('Bank paybill'), '247247');
    await user.type(screen.getByLabelText('Days to pay'), '7');
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await ownerAndReview(user);

    const review = screen.getByRole('region', { name: 'Send payment to' });
    expect(review).toHaveTextContent('Bank:Equity Bank, Ruiru branch');
    expect(review).toHaveTextContent('M-Pesa Paybill:247247, Account 0123456789');
    expect(screen.getByText('Days to pay: 7')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Register business' }));
    await screen.findByText(/is registered/);
    expect(registerBody?.invoice).toEqual({
      bankName: 'Equity Bank', bankBranch: 'Ruiru', bankPaybillNumber: '247247', bankAccountName: 'Jirani Minimart', bankAccountNumber: '0123456789',
      tillNumber: null, sendMoneyPhoneNumber: null, dueDays: 7, note: null,
    });
  }, 20_000);

  it("shows the API's refusal under its field, back on the payment step", async () => {
    const user = userEvent.setup();
    await toPaymentStep(user);
    await user.type(screen.getByLabelText('Till number (Buy Goods)'), '51234');
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await ownerAndReview(user);
    refuse = { tillNumber: ['That till belongs to another business.'] };
    await user.click(screen.getByRole('button', { name: 'Register business' }));

    expect(await screen.findByText('That till belongs to another business.')).toBeInTheDocument();
    expect(screen.getByText('Payment details (for invoices)')).toBeInTheDocument();
    expect(screen.getByLabelText('Till number (Buy Goods)')).toHaveAttribute('aria-invalid', 'true');
  }, 20_000);

  it('checks the numbers before moving on', async () => {
    const user = userEvent.setup();
    await toPaymentStep(user);
    await user.type(screen.getByLabelText('Send-money phone'), '020 123 4567');
    await user.type(screen.getByLabelText('Days to pay'), '400');
    await user.click(screen.getByRole('button', { name: /Next/ }));
    const step = screen.getByText('Payment details (for invoices)').closest('div')!.parentElement!;
    expect(within(step).getByText('Give a Kenyan mobile number, e.g. 0712 345 678.')).toBeInTheDocument();
    expect(within(step).getByText('Days to pay is a whole number from 0 to 365.')).toBeInTheDocument();
  }, 20_000);
});
