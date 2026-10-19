// Application/Business/Dtos/BusinessDtos.cs and Application/Accounting/Dtos/AccountingDtos.cs
import type { BusinessKind, BusinessType, CustomerLedgerEntryType, PriceType, SettlementMethod, SupplierLedgerEntryType } from '../enums';
import type { DateOnly, DateTimeString, Guid } from './common';
import type { BusinessAccessDto, BusinessLicenseDto, BusinessOwnerRequestDto } from './platform';

interface BusinessProfileFields {
  businessName: string;
  tradingName: string | null;
  businessType: BusinessType;
  registrationNumber: string | null;
  kraPin: string;
  physicalAddress: string | null;
  county: string | null;
  phoneNumber: string | null;
  email: string | null;
  logoUrl: string | null;
  backgroundImageUrl: string | null;
  isVatRegistered: boolean;
  mpesaShortCode: string | null;
  maxDiscountPercent: number | null;
}

export interface RegisterBusinessRequestDto extends BusinessProfileFields {
  kind: BusinessKind;
  /** The person who will run it: becomes its first Admin. Super users only. */
  owner?: BusinessOwnerRequestDto | null;
}
/** Full replace. Kind cannot change. */
export type UpdateBusinessRequestDto = BusinessProfileFields;

export interface BusinessDto extends BusinessProfileFields {
  businessId: Guid;
  kind: BusinessKind;
  /** False once closed by the platform. */
  isActive: boolean;
  isSuspended?: boolean;
  suspensionReason?: string | null;
  licenseEndsOn?: DateOnly | null;
  licenseMaxUsers?: number | null;
  licenseMaxBranches?: number | null;
}

/** maxBranches: open branches allowed (head office included), null = unlimited. openBranches: every open branch, whoever asks. */
export interface BusinessLicenseStatusDto { access: BusinessAccessDto; maxUsers: number | null; licenses: BusinessLicenseDto[]; maxBranches?: number | null; openBranches?: number }

export interface RegisterCustomerRequestDto {
  businessId?: Guid | null;
  customerName: string;
  kraPin: string | null;
  contactPerson: string | null;
  phoneNumber: string | null;
  email: string | null;
  physicalAddress: string | null;
  priceType: PriceType | null;
  creditLimit: number | null;
}

/** Full replace. priceType null keeps the current one; creditLimit null removes the limit. */
export type UpdateCustomerRequestDto = Omit<RegisterCustomerRequestDto, 'businessId'>;

export interface CustomerDto {
  customerId: Guid;
  businessId: Guid;
  customerName: string;
  kraPin: string | null;
  contactPerson: string | null;
  phoneNumber: string | null;
  email: string | null;
  physicalAddress: string | null;
  isActive: boolean;
  priceType: PriceType;
  creditLimit: number | null;
}

export interface CustomerBalanceDto {
  customerId: Guid;
  customerName: string;
  outstandingBalance: number;
  creditLimit: number | null;
  /** Null when the customer has no credit limit. */
  availableCredit: number | null;
}

export interface CustomerLedgerEntryDto {
  customerLedgerEntryId: Guid;
  entryType: CustomerLedgerEntryType;
  amount: number;
  referenceType: string;
  referenceId: Guid;
  notes: string | null;
  createdAt: DateTimeString;
  paymentMethod: SettlementMethod | null;
  paymentReference: string | null;
}

export interface RecordCustomerPaymentRequestDto {
  amount: number;
  notes: string | null;
  paymentMethod: SettlementMethod | null;
  paymentReference: string | null;
}

export interface SupplierBalanceDto { supplierId: Guid; supplierName: string; outstandingBalance: number }

export interface SupplierLedgerEntryDto {
  supplierLedgerEntryId: Guid;
  entryType: SupplierLedgerEntryType;
  amount: number;
  referenceType: string;
  referenceId: Guid;
  supplierInvoiceNumber: string | null;
  paymentMethod: SettlementMethod | null;
  paymentReference: string | null;
  notes: string | null;
  createdAt: DateTimeString;
}

export interface RecordSupplierPaymentRequestDto {
  amount: number;
  paymentMethod: SettlementMethod;
  paymentReference: string | null;
  notes: string | null;
}
