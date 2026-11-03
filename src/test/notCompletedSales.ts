import { DeliveryOrderStatus, PaymentMethod } from '@/api/enums';
import { HEAD_OFFICE } from '@/test/render';
import type { CustomerAgingReportDto, CustomerAgingRowDto, OpenInvoiceDto } from '@/api/dto/reports';
import type { DeliveryOrderDto } from '@/api/dto/deliveries';

const buckets = { days0To30: 0, days31To60: 0, days61To90: 0, over90: 0 };

const invoice = (over: Partial<OpenInvoiceDto>): OpenInvoiceDto => ({
  invoiceId: 's1', invoiceNumber: 'INV-000001', invoiceDate: '2026-10-20', originalAmount: 1000, outstandingAmount: 1000, ageDays: 14, bucket: '0-30', ...over,
});
const agingRow = (over: Partial<CustomerAgingRowDto>, openInvoices: OpenInvoiceDto[]): CustomerAgingRowDto => ({
  customerId: 'c1', customerName: 'Mama Wanjiru', phoneNumber: '254722000000', outstanding: 0, unappliedCredit: 0, netBalance: 0, buckets,
  openInvoiceCount: openInvoices.length, oldestOpenInvoiceDate: openInvoices[0]?.invoiceDate ?? null, oldestOpenInvoiceAgeDays: openInvoices[0]?.ageDays ?? null,
  openInvoices, ...over,
});

/** Two customers, three unpaid credit sales worth 3,500 in all; Otieno's is the oldest and his promise to pay has passed. */
export const aging: CustomerAgingReportDto = {
  asOf: '2026-11-03', customerCount: 2, totalOutstanding: 3500, totalUnappliedCredit: 0, totals: buckets,
  customers: [
    agingRow({ customerId: 'c1', customerName: 'Mama Wanjiru', outstanding: 2000 }, [
      invoice({ invoiceId: 's1', invoiceNumber: 'INV-000010', invoiceDate: '2026-10-20', outstandingAmount: 1200, originalAmount: 1500 }),
      invoice({ invoiceId: 's2', invoiceNumber: 'INV-000012', invoiceDate: '2026-10-28', outstandingAmount: 800, originalAmount: 800, ageDays: 6 }),
    ]),
    agingRow({ customerId: 'c2', customerName: 'Otieno', phoneNumber: null, outstanding: 1500 }, [
      invoice({ invoiceId: 's3', invoiceNumber: 'INV-000004', invoiceDate: '2026-09-30', outstandingAmount: 1500, originalAmount: 2000, ageDays: 34, paymentDueDate: '2026-10-15', isPromiseOverdue: true }),
    ]),
  ],
};

export const noAging: CustomerAgingReportDto = { ...aging, customerCount: 0, totalOutstanding: 0, customers: [] };

/** One rider order out, 260 to collect. */
export const riderOut: DeliveryOrderDto = {
  deliveryOrderId: 'd1', orderNumber: 'DEL-000001', status: DeliveryOrderStatus.OutForDelivery, customerId: 'c3', customerName: 'Achieng', deliveryAddress: 'Ruiru',
  contactPhone: null, notes: null, estimatedTotal: 260, riderName: 'Peter', dispatchedAt: '2026-11-03T07:00:00Z', saleId: null, saleNumber: null, saleTotal: null,
  paymentMethod: null, paymentDueDate: null, deliveredAt: null, cancelledAt: null, cancelReason: null, createdAt: '2026-11-03T06:30:00Z', createdBy: null,
  branchId: HEAD_OFFICE.branchId, kraBranchId: '00', branchName: 'Head Office', lines: [], expectedPaymentMethod: PaymentMethod.Cash,
};
