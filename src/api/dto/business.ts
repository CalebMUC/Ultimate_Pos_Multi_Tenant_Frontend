// Application/Business/Dtos/BusinessDtos.cs and Application/Accounting/Dtos/AccountingDtos.cs
import type { BusinessKind, BusinessSector, BusinessType, CustomerLedgerEntryType, MonthlyDiscountScope, PriceType, SettlementMethod, SupplierLedgerEntryType } from '../enums';
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
  /** The short code C2B (till) payments are routed by. Newer APIs derive it from the till, else the paybill. */
  mpesaShortCode: string | null;
  /** Missing on older APIs. */
  mpesaTillNumber?: string | null;
  mpesaPaybillNumber?: string | null;
  maxDiscountPercent: number | null;
  /** The monthly-spend reward: both null = off. Applied by the API; the cashier's cap does not limit it. Missing on older APIs. */
  monthlyDiscountThreshold?: number | null;
  monthlyDiscountPercent?: number | null;
  monthlyDiscountScope?: MonthlyDiscountScope;
  /** False: a sale needing more stock than is held is refused (409 INSUFFICIENT_STOCK). Null on update keeps the current value. */
  allowNegativeStock?: boolean | null;
}

export interface RegisterBusinessRequestDto extends BusinessProfileFields {
  /** Null when the sector suggests one (BusinessDefaults.Sectors); required for General and Agrovet. */
  kind: BusinessKind | null;
  /** Defaults to General. */
  sector?: BusinessSector | null;
  /** The person who will run it: becomes its first Admin. Super users only. */
  owner?: BusinessOwnerRequestDto | null;
  /** Reports to KRA eTIMS. Defaults to false. Chosen here and changed later only by the platform (PUT /platform/businesses/{id}/etims). */
  etimsEnabled?: boolean;
  /** Where invoices tell customers to pay. Null or left out when the owner has no details yet: they add them later in Settings. */
  invoice?: InvoiceSettingsDto | null;
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
  /** Older APIs leave it out: treat missing as true (the API's default). */
  allowNegativeStock?: boolean;
  sector?: BusinessSector;
  /** The app areas it uses (module keys), from sector and kind. Missing on older APIs. */
  modules?: string[] | null;
  /** Reports to KRA eTIMS ("etims" is then in modules). Set by the platform only. Missing on older APIs. */
  etimsEnabled?: boolean;
  /** What invoices print under "Send payment to", and their terms. Missing on older APIs. */
  invoice?: InvoiceSettingsDto | null;
}

/**
 * Where customers send the money for an invoice, and its terms: PUT /businesses/current/invoice-settings (Businesses.Update), a full
 * replace where null clears, and optional on register. Printed only: these are not the M-Pesa till and paybill that route payments into
 * the POS, and neither set is ever filled from the other.
 */
export interface InvoiceSettingsDto {
  /** At most 100 characters. */
  bankName: string | null;
  bankBranch: string | null;
  /** The bank's M-Pesa paybill, 5-10 digits. */
  bankPaybillNumber: string | null;
  /** The name the account is held in, at most 100 characters. */
  bankAccountName: string | null;
  /** At most 50 characters, kept as typed (leading zeros matter). Also the "Account" for the bank's paybill. */
  bankAccountNumber: string | null;
  /** A Buy Goods till for invoices, 5-7 digits. */
  tillNumber: string | null;
  /** A mobile number customers may send M-Pesa to. The API stores it as 2547XXXXXXXX or 2541XXXXXXXX. */
  sendMoneyPhoneNumber: string | null;
  /** Days to pay, 0-365. Null: no due date unless the customer promised one. */
  dueDays: number | null;
  /** Printed with the payment details, at most 500 characters. */
  note: string | null;
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
  /** The standing discount, applied by the API to every sale to them. Null = none. Set only through PUT /customers/{id}/discount. */
  discountPercent?: number | null;
  discountNote?: string | null;
  discountSetAt?: DateTimeString | null;
}

/** Both values, or both null (off). Needs Businesses.Update. */
export interface UpdateMonthlyDiscountRequestDto { threshold: number | null; percent: number | null; scope: MonthlyDiscountScope }

/** Gives or changes (a note is required) the standing discount; null or 0 removes it. Needs Customers.ManageDiscount. */
export interface SetCustomerDiscountRequestDto { discountPercent: number | null; note: string | null }

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
