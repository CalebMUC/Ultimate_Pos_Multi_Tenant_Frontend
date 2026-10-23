import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CustomerDiscountSource, PaymentMethod, SaleStatus } from '@/api/enums';
import { formatMoney } from '@/lib/format';
import type { SaleDto, SaleLineDto } from '@/api/dto/sales';
import { Receipt } from './Receipt';

const line = (id: string, productName: string, lineTotal: number, bundle?: string): SaleLineDto => ({
  saleLineId: id, productId: productName, productName, unitOfMeasureId: 'u', quantity: 1, unitPrice: lineTotal, lineTotal, discountAmount: 0, taxRate: 0,
  taxAmount: 0, quantityReturned: 0, sku: null, unitSymbol: '20L', batches: null,
  productBundleId: bundle ?? null, bundleName: bundle ? '20L Heavy-duty bottle + water' : null, bundleQuantity: bundle ? 1 : null,
});

const sale: SaleDto = {
  saleId: 's1', saleNumber: 'INV-000042', customerId: null, paymentMethod: PaymentMethod.Cash, status: SaleStatus.Completed, totalAmount: 1700,
  amountTendered: 5000, changeDue: 3300, notes: null, createdAt: '2026-10-20T08:00:00Z',
  lines: [line('l1', 'Purified Water', 200, 'hd20'), line('l2', '20L Heavy-duty bottle', 1300, 'hd20'), line('l3', 'Purified Water', 200)],
  customerName: null, createdBy: null, createdByName: null, subtotal: 1700, discountTotal: 0, taxTotal: 0, returnedAmount: 0, prescription: null,
  bundles: [{ productBundleId: 'hd20', name: '20L Heavy-duty bottle + water', quantity: 1, total: 1500, discountAmount: 0 }],
};

describe('receipt', () => {
  it('prints a bundle as one row and leaves its parts off', () => {
    render(<Receipt sale={sale} paper="a4" />);
    const rows = screen.getAllByRole('row').slice(1); // after the header
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Purified Water');
    expect(rows[1]).toHaveTextContent('20L Heavy-duty bottle + water');
    expect(rows[1]).toHaveTextContent('1,500.00');
    expect(screen.queryByText('20L Heavy-duty bottle')).not.toBeInTheDocument();
  });

  it('labels the customer discount by where it came from', () => {
    const discounted = { ...sale, discountTotal: 340, customerDiscountPercent: 20, customerDiscountAmount: 340 };
    const { rerender } = render(<Receipt sale={{ ...discounted, customerDiscountSource: CustomerDiscountSource.MonthlySpend }} paper="80mm" />);
    expect(screen.getByText('Monthly reward (20%)')).toBeInTheDocument();
    expect(screen.getByText(`−${formatMoney(340)}`)).toBeInTheDocument();
    // All of discountTotal is the customer's: no second "Discount" line.
    expect(screen.queryByText('Discount')).not.toBeInTheDocument();

    rerender(<Receipt sale={{ ...discounted, customerDiscountPercent: 10, customerDiscountSource: CustomerDiscountSource.Standing }} paper="80mm" />);
    expect(screen.getByText('Customer discount (10%)')).toBeInTheDocument();
    expect(screen.queryByText(/Monthly reward/)).not.toBeInTheDocument();
  });
});
