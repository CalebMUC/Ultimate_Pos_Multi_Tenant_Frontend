// Application/Sales/Dtos/SalesDtos.cs and Application/Payments/Dtos/MpesaDtos.cs
import type { MpesaTransactionStatus, MpesaTransactionType, PaymentMethod, PriceType, RefundMethod, SaleStatus } from '../enums';
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
  discountAmount?: number | null;
  overrideCreditLimit?: boolean;
  prescription?: SalePrescriptionRequestDto | null;
}

export interface SalePreviewLineDto {
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
