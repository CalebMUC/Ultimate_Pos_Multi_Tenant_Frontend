import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PaymentMethod, SaleStatus } from '@/api/enums';
import { addDays, formatDateOnly, formatMoney, todayIso } from '@/lib/format';
import { useSession } from '@/stores/session';
import { API, BUSINESS_ID, ok, renderWithProviders, signIn } from '@/test/render';
import type { BusinessDto, CustomerDto, InvoiceSettingsDto } from '@/api/dto/business';
import type { CustomerAgingReportDto, OpenInvoiceDto } from '@/api/dto/reports';
import type { SaleDto, SaleLineDto } from '@/api/dto/sales';
import { Receipt } from '@/features/sales/Receipt';
import { accountInvoice, accountInvoiceNumber, invoiceQty, saleInvoice } from './invoiceModel';
import { dueDateFor, sendPaymentTo } from './paymentDetails';
import { CustomerInvoiceDialog, SaleInvoiceDialog } from './InvoiceDialog';
import { InvoiceSettingsCard } from './InvoiceSettingsForm';

const line = (id: string, productName: string, quantity: number, unitPrice: number): SaleLineDto => ({
  saleLineId: id, productId: productName, productName, unitOfMeasureId: 'u', quantity, unitPrice, lineTotal: quantity * unitPrice, discountAmount: 0, taxRate: 0,
  taxAmount: 0, quantityReturned: 0, sku: null, unitSymbol: '20L', batches: null, productBundleId: null, bundleName: null, bundleQuantity: null,
});

const sale = (id: string, saleNumber: string, createdAt: string, lines: SaleLineDto[]): SaleDto => {
  const total = lines.reduce((t, l) => t + l.lineTotal, 0);
  return {
    saleId: id, saleNumber, customerId: 'c1', paymentMethod: PaymentMethod.Credit, status: SaleStatus.Completed, totalAmount: total, amountTendered: null,
    changeDue: null, notes: null, createdAt, lines, customerName: "Let's Talk Sacco", createdBy: null, createdByName: null, subtotal: total, discountTotal: 0,
    taxTotal: 0, returnedAmount: 0, prescription: null,
  };
};

const october = sale('s1', 'INV-000010', '2026-10-05T09:00:00Z', [line('l1', 'Water refill', 3, 200)]);
const november = sale('s2', 'INV-000014', '2026-11-02T09:00:00Z', [line('l2', 'Water refill', 1, 200), line('l3', '20L bottle', 1, 500)]);

const open = (invoiceId: string, invoiceDate: string, originalAmount: number, outstandingAmount: number): OpenInvoiceDto => ({
  invoiceId, invoiceNumber: null, invoiceDate, originalAmount, outstandingAmount, ageDays: 0, bucket: '0-30',
});

const customer: CustomerDto = {
  customerId: 'c1', businessId: BUSINESS_ID, customerName: "Let's Talk Sacco", kraPin: 'P051111111A', contactPerson: 'Jane', phoneNumber: '0722000111',
  email: null, physicalAddress: 'Thika Road', isActive: true, priceType: 0, creditLimit: null,
} as CustomerDto;

const NONE: InvoiceSettingsDto = {
  bankName: null, bankBranch: null, bankPaybillNumber: null, bankAccountName: null, bankAccountNumber: null, tillNumber: null, sendMoneyPhoneNumber: null,
  dueDays: null, note: null,
};

/** Every detail set. */
const equity: InvoiceSettingsDto = {
  bankName: 'Equity Bank', bankBranch: 'Ruiru', bankPaybillNumber: '247247', bankAccountName: 'Jirani Minimart', bankAccountNumber: '0123456789',
  tillNumber: '5123456', sendMoneyPhoneNumber: '254712345678', dueDays: 14, note: 'Thank you for your business.',
};

/**
 * A station with no invoice details saved yet. Its M-Pesa till and paybill route payments into the POS: they are never printed as where to
 * send an invoice's money.
 */
const business = {
  businessId: BUSINESS_ID, businessName: 'Aqua Hub Ltd', tradingName: 'Aqua Hub', kraPin: 'P000000001Z', logoUrl: 'https://cdn.test/logo.png',
  phoneNumber: '254711000000', physicalAddress: 'Juja', email: null, isVatRegistered: false, mpesaShortCode: '222111', mpesaPaybillNumber: '222111',
  mpesaTillNumber: '789123', invoice: NONE,
} as unknown as BusinessDto;

describe('invoice model', () => {
  it('bills every unpaid sale oldest first, less what is already paid', () => {
    // Paid 100 on October's sale; November's untouched.
    const inv = accountInvoice({
      customerId: 'c1a2b3c4-0000', customer: { name: 'Sacco' }, issuedOn: '2026-11-04', dueDays: 14,
      invoices: [open('s2', '2026-11-02', 700, 700), open('s1', '2026-10-05', 600, 500)],
      sales: [november, october],
    });
    expect(inv.number).toBe('ACC-261104-C1A2');
    expect(inv.dueOn).toBe('2026-11-18');
    expect(inv.items.map((i) => [i.reference, i.description])).toEqual([
      ['INV-000010', 'Water refill'], ['INV-000014', 'Water refill'], [null, '20L bottle'],
    ]);
    expect(inv).toMatchObject({ total: 1300, paid: 100, balanceDue: 1200, bySale: true });
  });

  it('counts pack sizes as "4 × 20L" and measures as "2.5 kg"', () => {
    expect(invoiceQty(4, '20L')).toBe('4 × 20L');
    expect(invoiceQty(2.5, 'kg')).toBe('2.5 kg');
  });

  it('names an account invoice the same way all day, so a reprint matches', () => {
    expect(accountInvoiceNumber('abcd-ef', '2026-11-04')).toBe(accountInvoiceNumber('abcd-ef', '2026-11-04'));
  });

  it('shows a sale as paid once the aging report no longer lists it, and the whole total when it is not known', () => {
    expect(saleInvoice({ sale: october, customer: { name: 'Sacco' }, open: null, dueDays: null })).toMatchObject({ paid: 600, balanceDue: 0 });
    expect(saleInvoice({ sale: october, customer: { name: 'Sacco' }, open: undefined, dueDays: null })).toMatchObject({ paid: null, balanceDue: 600 });
  });

  it("dates it from the sale's promise to pay, then the business's days to pay, else not at all", () => {
    const promisedSale = { ...october, paymentDueDate: '2026-10-31' };
    expect(saleInvoice({ sale: promisedSale, customer: { name: 'Sacco' }, open: open('s1', '2026-10-05', 600, 600), dueDays: 7 }).dueOn).toBe('2026-10-31');
    expect(saleInvoice({ sale: october, customer: { name: 'Sacco' }, open: open('s1', '2026-10-05', 600, 600), dueDays: 7 }).dueOn).toBe('2026-10-12');
    expect(saleInvoice({ sale: october, customer: { name: 'Sacco' }, open: open('s1', '2026-10-05', 600, 600), dueDays: null }).dueOn).toBeNull();
    expect(dueDateFor('2026-10-05T09:00:00Z', null, 0)).toBe('2026-10-05');
  });
});

describe('Send payment to', () => {
  it('prints every line that is set, in order, with the paybill account and the phone in local form', () => {
    expect(sendPaymentTo(equity, '2026-11-18')).toEqual({
      lines: [
        { label: 'Bank', value: 'Equity Bank, Ruiru branch' },
        { label: 'Account name', value: 'Jirani Minimart' },
        { label: 'Account no.', value: '0123456789' },
        { label: 'M-Pesa Paybill', value: '247247, Account 0123456789' },
        { label: 'Buy Goods Till', value: '5123456' },
        { label: 'Send Money', value: '0712 345 678' },
      ],
      due: `Due by ${formatDateOnly('2026-11-18')}`,
      note: 'Thank you for your business.',
    });
  });

  it('prints a paybill alone without an account number, and only the lines that are set', () => {
    const block = sendPaymentTo({ ...NONE, bankPaybillNumber: '247247', sendMoneyPhoneNumber: '254112345678' }, null);
    expect(block).toEqual({ lines: [{ label: 'M-Pesa Paybill', value: '247247' }, { label: 'Send Money', value: '0112 345 678' }], due: null, note: null });
  });

  it('is left off without a bank, till or phone, even with days to pay and a note', () => {
    expect(sendPaymentTo(null, '2026-11-18')).toBeNull();
    expect(sendPaymentTo(undefined, null)).toBeNull();
    expect(sendPaymentTo({ ...NONE, dueDays: 14, note: 'Thanks', bankBranch: ' ' }, '2026-11-18')).toBeNull();
  });
});

let agingData: CustomerAgingReportDto;
let saved: InvoiceSettingsDto | null = null;
let refuse: Record<string, string[]> | null = null;
const server = setupServer(
  http.put(`${API}/businesses/current/invoice-settings`, async ({ request }) => {
    const body = (await request.json()) as InvoiceSettingsDto;
    if (refuse) {
      return HttpResponse.json({ success: false, data: null, error: { code: 'VALIDATION_FAILED', message: 'Invalid', details: refuse }, meta: null }, { status: 400 });
    }
    // The API stores the phone as 2547XXXXXXXX.
    saved = { ...body, sendMoneyPhoneNumber: body.sendMoneyPhoneNumber ? `254${body.sendMoneyPhoneNumber.replace(/\D/g, '').slice(1)}` : null };
    return HttpResponse.json(ok({ ...business, invoice: saved }));
  }),
  http.get(`${API}/businesses/current`, () => HttpResponse.json(ok({ ...business, invoice: saved ?? NONE }))),
  http.get(`${API}/reports/customer-aging`, () => HttpResponse.json(ok(agingData))),
  http.get(`${API}/customers/c1`, () => HttpResponse.json(ok(customer))),
  http.get(`${API}/sales/:id`, ({ params }) => HttpResponse.json(ok([october, november].find((s) => s.saleId === params.id)))),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  signIn(['Sales.View', 'Customers.View', 'CustomerReports.View', 'Businesses.View', 'Businesses.Update']);
  useSession.setState({ business });
  saved = null;
  refuse = null;
  agingData = {
    asOf: '2026-11-04', customerCount: 1, totalOutstanding: 1200, totalUnappliedCredit: 0, totals: { days0To30: 0, days31To60: 0, days61To90: 0, over90: 0 },
    customers: [{
      customerId: 'c1', customerName: "Let's Talk Sacco", phoneNumber: null, outstanding: 1200, unappliedCredit: 0, netBalance: 1200,
      buckets: { days0To30: 0, days31To60: 0, days61To90: 0, over90: 0 }, openInvoiceCount: 2, oldestOpenInvoiceDate: '2026-10-05', oldestOpenInvoiceAgeDays: 30,
      openInvoices: [open('s1', '2026-10-05', 600, 500), open('s2', '2026-11-02', 700, 700)],
    }],
  };
});

describe('customer invoice', () => {
  it("prints the business's logo and name over every unpaid sale and the balance due", async () => {
    useSession.setState({ business: { ...business, invoice: equity } });
    renderWithProviders(<CustomerInvoiceDialog customer={customer} open onOpenChange={() => {}} />);
    const doc = await screen.findByRole('article', { name: /^Invoice ACC-/ });
    expect(within(doc).getByText('Aqua Hub')).toBeInTheDocument();
    expect(doc.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/logo.png');
    expect(within(within(doc).getByRole('region', { name: 'Invoice to' })).getByText("Let's Talk Sacco")).toBeInTheDocument();
    const pay = within(doc).getByRole('region', { name: 'Send payment to' });
    expect(pay).toHaveTextContent('Bank:Equity Bank, Ruiru branch');
    expect(pay).toHaveTextContent('Thank you for your business.');

    const rows = within(doc).getAllByRole('row').filter((r) => r.closest('table')?.getAttribute('aria-label') !== 'Totals').slice(1);
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('INV-000010Water refill3 × 20L'),
      expect.stringContaining('INV-000014Water refill1 × 20L'),
      expect.stringContaining('20L bottle'),
    ]);
    const totals = within(doc).getByRole('table', { name: 'Totals' });
    expect(within(totals).getByRole('row', { name: /Paid/ })).toHaveTextContent(`−${formatMoney(100)}`);
    expect(within(totals).getByRole('row', { name: /Balance due/ })).toHaveTextContent(formatMoney(1200));
    expect(screen.getByRole('button', { name: /Print invoice/ })).toBeEnabled();
  });

  it("leaves the block off without payment details, and never prints the till's M-Pesa numbers", async () => {
    renderWithProviders(<CustomerInvoiceDialog customer={customer} open onOpenChange={() => {}} />);
    const doc = await screen.findByRole('article', { name: /^Invoice ACC-/ });
    expect(within(doc).queryByRole('region', { name: 'Send payment to' })).not.toBeInTheDocument();
    expect(doc).not.toHaveTextContent('789123');
    expect(doc).not.toHaveTextContent('222111');
  });

  it('says so when the customer owes nothing', async () => {
    agingData = { ...agingData, customers: [] };
    renderWithProviders(<CustomerInvoiceDialog customer={customer} open onOpenChange={() => {}} />);
    expect(await screen.findByText('Nothing owed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Print invoice/ })).toBeDisabled();
  });

  it('saves payment details from the invoice and prints them at once', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomerInvoiceDialog customer={customer} open onOpenChange={() => {}} />);
    await screen.findByRole('article', { name: /^Invoice ACC-/ });
    await user.click(screen.getByRole('button', { name: /Payment details/ }));
    const form = screen.getByRole('form', { name: 'Invoice payment details' });
    await user.type(within(form).getByLabelText('Bank name'), 'Family Bank');
    await user.type(within(form).getByLabelText('Bank paybill'), '222111');
    await user.type(within(form).getByLabelText('Account number'), '789123');
    await user.type(within(form).getByLabelText('Send-money phone'), '0712 345 678');
    await user.type(within(form).getByLabelText('Days to pay'), '14');
    await user.click(within(form).getByRole('button', { name: 'Save details' }));

    await waitFor(() => expect(screen.queryByRole('form', { name: 'Invoice payment details' })).not.toBeInTheDocument());
    expect(saved).toEqual({ ...NONE, bankName: 'Family Bank', bankPaybillNumber: '222111', bankAccountNumber: '789123', sendMoneyPhoneNumber: '254712345678', dueDays: 14 });
    const pay = screen.getByRole('region', { name: 'Send payment to' });
    expect(pay).toHaveTextContent('Bank:Family Bank');
    expect(pay).toHaveTextContent('M-Pesa Paybill:222111, Account 789123');
    expect(pay).toHaveTextContent('Send Money:0712 345 678');
    expect(pay).toHaveTextContent(`Due by ${formatDateOnly(addDays(todayIso(), 14))}`);
  }, 15_000);

  it('leaves payment details to those who may change the business', async () => {
    signIn(['Sales.View', 'Customers.View', 'CustomerReports.View']);
    useSession.setState({ business: { ...business, invoice: equity } });
    renderWithProviders(<CustomerInvoiceDialog customer={customer} open onOpenChange={() => {}} />);
    await screen.findByRole('article', { name: /^Invoice ACC-/ });
    expect(screen.queryByRole('button', { name: /Payment details/ })).not.toBeInTheDocument();
  });
});

describe('Settings: Send payment to', () => {
  it('saves all nine fields, blanks as null, and previews only the lines that are set', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InvoiceSettingsCard />);
    const preview = screen.getByRole('complementary', { name: 'Preview' });
    expect(preview).toHaveTextContent(/Nothing yet/);

    await user.type(screen.getByLabelText('Bank name'), 'Equity Bank');
    await user.type(screen.getByLabelText('Bank paybill'), '247247');
    expect(within(preview).getByRole('region', { name: 'Send payment to' })).toHaveTextContent('Bank:Equity BankM-Pesa Paybill:247247');
    expect(preview).not.toHaveTextContent('Account name');
    expect(preview).not.toHaveTextContent('Buy Goods');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saved).toEqual({ ...NONE, bankName: 'Equity Bank', bankPaybillNumber: '247247' }));
  }, 15_000);

  it('shows the refusal under its field', async () => {
    const user = userEvent.setup();
    refuse = { tillNumber: ['That till is not a Buy Goods till.'] };
    renderWithProviders(<InvoiceSettingsCard />);
    await user.type(screen.getByLabelText('Till number (Buy Goods)'), '51234');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('That till is not a Buy Goods till.')).toBeInTheDocument();
    expect(screen.getByLabelText('Till number (Buy Goods)')).toHaveAttribute('aria-invalid', 'true');
  });

  it('clears every field after asking', async () => {
    const user = userEvent.setup();
    useSession.setState({ business: { ...business, invoice: equity } });
    renderWithProviders(<InvoiceSettingsCard />);
    expect(screen.getByLabelText('Account number')).toHaveValue('0123456789');
    expect(screen.getByLabelText('Send-money phone')).toHaveValue('0712 345 678');
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Clear all' }));
    await waitFor(() => expect(saved).toEqual(NONE));
  });

  it('is read-only without Businesses.Update', () => {
    signIn(['Businesses.View']);
    useSession.setState({ business: { ...business, invoice: equity } });
    renderWithProviders(<InvoiceSettingsCard />);
    expect(screen.getByLabelText('Bank name')).toBeDisabled();
    expect(screen.getByLabelText('Bank name')).toHaveValue('Equity Bank');
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Preview' })).toHaveTextContent('Account name:Jirani Minimart');
  });

  it('says when the API cannot keep them', () => {
    useSession.setState({ business: { ...business, invoice: undefined } });
    renderWithProviders(<InvoiceSettingsCard />);
    expect(screen.getByText(/does not keep invoice payment details yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
});

describe('receipt', () => {
  it('tells a credit customer where to pay, on 80 mm too, but never on a paid sale', () => {
    useSession.setState({ business: { ...business, invoice: equity } });
    const { rerender } = renderWithProviders(<Receipt sale={{ ...october, paymentDueDate: '2026-10-20' }} paper="80mm" />);
    const pay = screen.getByRole('region', { name: 'Send payment to' });
    expect(pay).toHaveTextContent('Account nameJirani Minimart');
    expect(pay).toHaveTextContent(`Due by ${formatDateOnly('2026-10-20')}`);

    rerender(<Receipt sale={{ ...october, paymentMethod: PaymentMethod.Cash }} paper="80mm" />);
    expect(screen.queryByRole('region', { name: 'Send payment to' })).not.toBeInTheDocument();
  });
});

describe('sale invoice', () => {
  it('bills one credit sale under its own number, less what was paid on it', async () => {
    renderWithProviders(<SaleInvoiceDialog sale={october} open onOpenChange={() => {}} />);
    const doc = await screen.findByRole('article', { name: 'Invoice INV-000010' });
    await waitFor(() => expect(within(doc).getByText('Attn: Jane')).toBeInTheDocument());
    const totals = within(doc).getByRole('table', { name: 'Totals' });
    expect(within(totals).getByRole('row', { name: /Balance due/ })).toHaveTextContent(formatMoney(500));
    expect(within(doc).queryByText('PAID')).not.toBeInTheDocument();
  });

  it('stamps it paid once nothing is owed on it', async () => {
    agingData = { ...agingData, customers: [{ ...agingData.customers[0], openInvoices: [open('s2', '2026-11-02', 700, 700)] }] };
    renderWithProviders(<SaleInvoiceDialog sale={october} open onOpenChange={() => {}} />);
    const doc = await screen.findByRole('article', { name: 'Invoice INV-000010' });
    expect(within(doc).getByText('PAID')).toBeInTheDocument();
    expect(within(within(doc).getByRole('table', { name: 'Totals' })).getByRole('row', { name: /Balance due/ })).toHaveTextContent(formatMoney(0));
  });
});
