// Mirrors UltimatePos.Domain.Enums. Request and response bodies carry these as integers.
export enum ItemType { RawMaterial = 0, Packaging = 1, FinishedGood = 2 }
export enum TaxClassification { Standard = 0, ZeroRated = 1, Exempt = 2 }
export enum PriceType { Wholesale = 0, Retail = 1 }
export enum PurchaseOrderStatus { Draft = 0, Ordered = 1, PartiallyReceived = 2, Received = 3, Cancelled = 4 }
export enum SaleStatus { Pending = 0, Completed = 1, Voided = 2, Failed = 3 }
export enum CustomerLedgerEntryType { Invoice = 0, Payment = 1, Reversal = 2, Return = 3 }
export enum PaymentMethod { Cash = 0, Credit = 1, MpesaTill = 2, MpesaStkPush = 3 }
export enum MpesaTransactionType { C2B = 0, StkPush = 1 }
export enum MpesaTransactionStatus { Received = 0, Matched = 1, Pending = 2, Confirmed = 3, Failed = 4 }
export enum ProductionCostType { Labour = 0, Packaging = 1, Utilities = 2, Transport = 3, Overhead = 4, Other = 5 }
export enum ExpensePaymentMethod { Cash = 0, Mpesa = 1, BankTransfer = 2, Cheque = 3 }
export enum ExpenseStatus { Posted = 0, Voided = 1 }
export enum StockMovementType {
  PurchaseReceipt = 0, Sale = 1, Adjustment = 2, ProductionConsumption = 3, ProductionOutput = 4, SaleVoid = 5, Revaluation = 6, SaleReturn = 7,
}
/** Customer and supplier payments. */
export enum SettlementMethod { Cash = 0, Mpesa = 1, BankTransfer = 2, Cheque = 3 }
export enum SupplierLedgerEntryType { Bill = 0, Payment = 1, Reversal = 2 }
export enum RefundMethod { Cash = 0, Mpesa = 1, CreditNote = 2 }
export enum BusinessType { Wholesaler = 0, Retailer = 1 }
export enum BusinessKind { Manufacturer = 0, Trader = 1 }

export type ExpiryStatus = 'Expired' | 'NearExpiry' | 'Ok' | 'NoExpiry';
export type StockStatus = 'InStock' | 'LowStock' | 'OutOfStock';

/** Human labels, used by selects, badges and CSV export. */
export const labels = {
  itemType: { [ItemType.RawMaterial]: 'Raw material', [ItemType.Packaging]: 'Packaging', [ItemType.FinishedGood]: 'Finished good' },
  taxClassification: {
    [TaxClassification.Standard]: 'Standard (16%)', [TaxClassification.ZeroRated]: 'Zero-rated', [TaxClassification.Exempt]: 'Exempt',
  },
  priceType: { [PriceType.Wholesale]: 'Wholesale', [PriceType.Retail]: 'Retail' },
  purchaseOrderStatus: {
    [PurchaseOrderStatus.Draft]: 'Draft', [PurchaseOrderStatus.Ordered]: 'Ordered', [PurchaseOrderStatus.PartiallyReceived]: 'Partially received',
    [PurchaseOrderStatus.Received]: 'Received', [PurchaseOrderStatus.Cancelled]: 'Cancelled',
  },
  saleStatus: { [SaleStatus.Pending]: 'Pending', [SaleStatus.Completed]: 'Completed', [SaleStatus.Voided]: 'Voided', [SaleStatus.Failed]: 'Failed' },
  customerLedgerEntryType: {
    [CustomerLedgerEntryType.Invoice]: 'Invoice', [CustomerLedgerEntryType.Payment]: 'Payment',
    [CustomerLedgerEntryType.Reversal]: 'Reversal', [CustomerLedgerEntryType.Return]: 'Credit note',
  },
  paymentMethod: {
    [PaymentMethod.Cash]: 'Cash', [PaymentMethod.Credit]: 'Credit', [PaymentMethod.MpesaTill]: 'M-Pesa Till', [PaymentMethod.MpesaStkPush]: 'M-Pesa STK',
  },
  mpesaTransactionType: { [MpesaTransactionType.C2B]: 'Till (C2B)', [MpesaTransactionType.StkPush]: 'STK push' },
  mpesaTransactionStatus: {
    [MpesaTransactionStatus.Received]: 'Received', [MpesaTransactionStatus.Matched]: 'Matched', [MpesaTransactionStatus.Pending]: 'Pending',
    [MpesaTransactionStatus.Confirmed]: 'Confirmed', [MpesaTransactionStatus.Failed]: 'Failed',
  },
  productionCostType: {
    [ProductionCostType.Labour]: 'Labour', [ProductionCostType.Packaging]: 'Packaging', [ProductionCostType.Utilities]: 'Utilities',
    [ProductionCostType.Transport]: 'Transport', [ProductionCostType.Overhead]: 'Overhead', [ProductionCostType.Other]: 'Other',
  },
  expensePaymentMethod: {
    [ExpensePaymentMethod.Cash]: 'Cash', [ExpensePaymentMethod.Mpesa]: 'M-Pesa', [ExpensePaymentMethod.BankTransfer]: 'Bank transfer',
    [ExpensePaymentMethod.Cheque]: 'Cheque',
  },
  expenseStatus: { [ExpenseStatus.Posted]: 'Posted', [ExpenseStatus.Voided]: 'Voided' },
  settlementMethod: {
    [SettlementMethod.Cash]: 'Cash', [SettlementMethod.Mpesa]: 'M-Pesa', [SettlementMethod.BankTransfer]: 'Bank transfer',
    [SettlementMethod.Cheque]: 'Cheque',
  },
  supplierLedgerEntryType: {
    [SupplierLedgerEntryType.Bill]: 'Bill', [SupplierLedgerEntryType.Payment]: 'Payment', [SupplierLedgerEntryType.Reversal]: 'Reversal',
  },
  refundMethod: { [RefundMethod.Cash]: 'Cash', [RefundMethod.Mpesa]: 'M-Pesa', [RefundMethod.CreditNote]: 'Credit note' },
  businessType: { [BusinessType.Wholesaler]: 'Wholesaler', [BusinessType.Retailer]: 'Retailer' },
  businessKind: { [BusinessKind.Manufacturer]: 'Manufacturer', [BusinessKind.Trader]: 'Trader' },
  expiryStatus: { Expired: 'Expired', NearExpiry: 'Near expiry', Ok: 'OK', NoExpiry: 'No expiry' } as Record<ExpiryStatus, string>,
} as const;

/** Options for a select built from a numeric enum's label map. */
export function enumOptions<T extends number>(map: Record<T, string>): { value: T; label: string }[] {
  return Object.keys(map).map((k) => ({ value: Number(k) as T, label: map[Number(k) as T] }));
}
