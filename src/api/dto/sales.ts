// Application/Sales/Dtos/SalesDtos.cs and Application/Payments/Dtos/MpesaDtos.cs
import type { CustomerDiscountSource, DeliveryMode, MonthlyDiscountScope, MpesaTransactionStatus, MpesaTransactionType, PaymentMethod, PriceType, RefundMethod, SaleStatus } from '../enums';
import type { DateOnly, DateTimeString, Guid } from './common';

export interface CreateSaleLineRequestDto {
  productId: Guid;
  unitOfMeasureId: Guid;
  quantity: number;
  /** Give this or discountPercent, never both. Needs Sales.ApplyDiscount. */
  discountAmount?: number | null;
  discountPercent?: number | null;
}

export interface SalePrescriptionRequestDto {
  prescriptionNumber: string | null;
  prescriberName: string;
  prescriberRegistrationNumber: string | null;
  prescriberFacility: string | null;
  patientName: string;
  patientPhoneNumber: string | null;
  patientAgeYears: number | null;
  /** yyyy-MM-dd, not in the future. */
  prescriptionDate: DateOnly;
  notes: string | null;
}

export interface CreateSaleRequestDto {
  customerId: Guid | null;
  paymentMethod: PaymentMethod;
  notes: string | null;
  lines: CreateSaleLineRequestDto[];
  amountTendered: number | null;
  mpesaPhoneNumber: string | null;
  mpesaTransactionId: Guid | null;
  /** MpesaReference only: the M-Pesa confirmation code, e.g. SJK4H7LM2P. Unique per business (409 DUPLICATE_REFERENCE). */
  mpesaReference?: string | null;
  discountAmount?: number | null;
  overrideCreditLimit?: boolean;
  prescription?: SalePrescriptionRequestDto | null;
  /** Bundles rung up as one item each. A sale needs at least one line or one bundle. Each bundle once; whole quantities. */
  bundles?: CreateSaleBundleRequestDto[] | null;
}

/** A discount here covers all of this bundle's quantity, not each one. Needs Sales.ApplyDiscount. */
export interface CreateSaleBundleRequestDto {
  productBundleId: Guid;
  quantity: number;
  discountAmount?: number | null;
  discountPercent?: number | null;
}

/** Fields on a sale line (and a preview line) that belongs to a bundle. Lines sharing productBundleId are one bundle row. */
export interface BundleLineFields {
  productBundleId?: Guid | null;
  bundleName?: string | null;
  bundleQuantity?: number | null;
}

/** A bundle on a sale, as the receipt shows it: total is the sum of its lines. */
export interface SaleBundleDto { productBundleId: Guid; name: string; quantity: number; total: number; discountAmount: number }

export interface SalePreviewLineDto extends BundleLineFields {
  productId: Guid;
  productName: string;
  sku: string;
  unitOfMeasureId: Guid;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  availableInBaseUnits: number;
  requiredInBaseUnits: number;
  stockSufficient: boolean;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  requiresPrescription: boolean;
  isBatchTracked: boolean;
}

export interface SalePreviewDto {
  customerId: Guid | null;
  priceType: PriceType;
  /** VAT included. */
  totalAmount: number;
  allStockSufficient: boolean;
  lines: SalePreviewLineDto[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  requiresPrescription: boolean;
  customerBalance: number | null;
  creditLimit: number | null;
  creditLimitExceeded: boolean;
  /** Null when the sale has none. */
  bundles?: SaleBundleDto[] | null;
  /** The customer's standing discount. Already inside discountTotal and the lines' discountAmount: never subtract it again. */
  customerDiscountPercent?: number | null;
  customerDiscountTotal?: number;
  /** Which discount customerDiscountTotal is: the standing one or the monthly reward (the larger of the two, never both). */
  customerDiscountSource?: CustomerDiscountSource | null;
  /** The customer's month against the reward. Null for walk-ins or when the business has no reward. */
  customerMonth?: CustomerMonthlySpendDto | null;
}

/**
 * A registered customer's calendar month (East Africa Time, every branch) against the monthly-spend reward. spent is before this sale;
 * qualifies: this sale gets the reward. Worked out by the API only.
 */
export interface CustomerMonthlySpendDto {
  month: string;
  spent: number;
  threshold: number;
  percent: number;
  scope: MonthlyDiscountScope;
  remainingToThreshold: number;
  qualifies: boolean;
}

export interface SaleLineBatchDto {
  stockBatchId: Guid;
  batchNumber: string;
  expiryDate: DateOnly | null;
  quantityInBaseUnits: number;
  quantityReturnedInBaseUnits: number;
}

export interface SaleLineDto {
  saleLineId: Guid;
  productId: Guid;
  productName: string;
  unitOfMeasureId: Guid;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  quantityReturned: number;
  sku: string | null;
  unitSymbol: string | null;
  batches: SaleLineBatchDto[] | null;
  productBundleId?: Guid | null;
  bundleName?: string | null;
  bundleQuantity?: number | null;
}

export interface SalePrescriptionDto extends SalePrescriptionRequestDto {
  dispensedBy: Guid | null;
}

export interface SaleDto {
  saleId: Guid;
  saleNumber: string;
  customerId: Guid | null;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  totalAmount: number;
  amountTendered: number | null;
  changeDue: number | null;
  /** The confirmation code typed for an MpesaReference sale. Missing on older APIs. */
  mpesaReference?: string | null;
  notes: string | null;
  createdAt: DateTimeString;
  lines: SaleLineDto[];
  customerName: string | null;
  createdBy: Guid | null;
  createdByName: string | null;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  returnedAmount: number;
  prescription: SalePrescriptionDto | null;
  /** Where it was sold: printed on receipts, also when reprinting at another branch. */
  branchId?: Guid;
  kraBranchId?: string | null;
  branchName?: string | null;
  /** Null when the sale has none. */
  bundles?: SaleBundleDto[] | null;
  /** Rider: completed from a delivery order once the rider was back. Missing on older APIs (= Counter). */
  deliveryMode?: DeliveryMode;
  /** The customer's standing discount on this sale. Already inside discountTotal. */
  customerDiscountPercent?: number | null;
  customerDiscountAmount?: number;
  customerDiscountSource?: CustomerDiscountSource | null;
}

export interface SaleQuery {
  page?: number;
  pageSize?: number;
  customerId?: Guid;
  status?: SaleStatus;
  from?: DateOnly;
  to?: DateOnly;
  createdBy?: Guid;
  paymentMethod?: PaymentMethod;
  search?: string;
  deliveryMode?: DeliveryMode;
}

export interface CreateSaleReturnLineRequestDto { saleLineId: Guid; quantity: number; restock: boolean }
export interface CreateSaleReturnRequestDto {
  reason: string;
  refundMethod: RefundMethod;
  refundReference: string | null;
  lines: CreateSaleReturnLineRequestDto[];
}

export interface SaleReturnLineDto {
  saleReturnLineId: Guid;
  saleLineId: Guid;
  productId: Guid;
  productName: string;
  quantity: number;
  quantityInBaseUnits: number;
  amount: number;
  taxAmount: number;
  restock: boolean;
}

export interface SaleReturnDto {
  saleReturnId: Guid;
  returnNumber: string;
  saleId: Guid;
  saleNumber: string;
  reason: string;
  refundMethod: RefundMethod;
  refundReference: string | null;
  totalAmount: number;
  taxAmount: number;
  createdAt: DateTimeString;
  createdBy: Guid | null;
  lines: SaleReturnLineDto[];
}

export interface PrescriptionRegisterLineDto {
  productId: Guid;
  productName: string;
  genericName: string | null;
  strength: string | null;
  quantity: number;
  unitSymbol: string | null;
  batchNumbers: string[];
}

export interface PrescriptionRegisterEntryDto {
  saleId: Guid;
  saleNumber: string;
  dispensedAt: DateTimeString;
  saleStatus: SaleStatus;
  dispensedByName: string | null;
  prescription: SalePrescriptionDto;
  lines: PrescriptionRegisterLineDto[];
}

export interface MpesaTransactionDto {
  mpesaTransactionId: Guid;
  transactionType: MpesaTransactionType;
  status: MpesaTransactionStatus;
  mpesaReceiptNumber: string | null;
  phoneNumber: string;
  amount: number;
  transactionDate: DateTimeString | null;
  saleId: Guid | null;
  /** Paid to a branch's own till. All null for the business short code: any branch may match it. */
  branchId?: Guid | null;
  kraBranchId?: string | null;
  branchName?: string | null;
}
