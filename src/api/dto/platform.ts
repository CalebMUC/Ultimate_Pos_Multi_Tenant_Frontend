// Application/Platform/PlatformDtos.cs and Application/Licensing/LicensePolicy.cs
import type { BusinessKind, BusinessType, LicenseKind, LicenseState, SettlementMethod } from '../enums';
import type { BusinessDto } from './business';
import type { DateOnly, DateTimeString, Guid } from './common';
import type { UserDto } from './identity';

/** Strings, unlike body enums. */
export type AccessStatus = 'Active' | 'ExpiringSoon' | 'GracePeriod' | 'Expired' | 'Unlicensed' | 'Suspended' | 'Closed';
/** The 403 codes that refuse a whole business. */
export type AccessCode = 'BUSINESS_SUSPENDED' | 'BUSINESS_CLOSED' | 'LICENSE_EXPIRED' | 'UNLICENSED';

export interface BusinessAccessDto {
  status: AccessStatus;
  allowed: boolean;
  code: AccessCode | null;
  message: string | null;
  licenseEndsOn: DateOnly | null;
  daysRemaining: number | null;
}

/** The person who will run a business. An existing account (matched by email) is attached; otherwise one is created. */
export interface BusinessOwnerRequestDto {
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  /** For a new account. Leave out to have a temporary password generated and returned once. */
  password?: string | null;
}

export interface BusinessOwnerResultDto {
  userId: Guid;
  email: string;
  fullName: string;
  /** False: an existing account was added, and no password is returned. */
  created: boolean;
  /** Only when the account was created without a password. Shown once. */
  temporaryPassword: string | null;
}

export interface BusinessLicenseDto {
  businessLicenseId: Guid;
  businessId: Guid;
  licenseNumber: string;
  kind: LicenseKind;
  planName: string;
  maxUsers: number | null;
  startsOn: DateOnly;
  endsOn: DateOnly;
  amount: number;
  currency: string;
  paymentMethod: SettlementMethod | null;
  paymentReference: string | null;
  notes: string | null;
  state: LicenseState;
  createdAt: DateTimeString;
  createdBy: Guid | null;
  cancelledAt: DateTimeString | null;
  cancelReason: string | null;
}

export interface RegisterBusinessResultDto { business: BusinessDto; owner: BusinessOwnerResultDto; trialLicense: BusinessLicenseDto | null }

/** Give months (1–36) or endsOn. Without startsOn a renewal continues the day after the current licence ends. */
export interface IssueLicenseRequestDto {
  kind: LicenseKind;
  planName: string;
  months?: number | null;
  startsOn?: DateOnly | null;
  endsOn?: DateOnly | null;
  maxUsers?: number | null;
  amount: number;
  paymentMethod?: SettlementMethod | null;
  paymentReference?: string | null;
  notes?: string | null;
}

export interface BusinessSummaryDto { business: BusinessDto; access: BusinessAccessDto; activeUsers: number; createdAt: DateTimeString }

export interface BusinessPerformanceDto {
  businessId: Guid;
  businessName: string;
  kind: BusinessKind;
  businessType: BusinessType;
  accessStatus: AccessStatus;
  licenseEndsOn: DateOnly | null;
  activeUsers: number;
  activeProducts: number;
  saleCount: number;
  /** Completed sales, VAT included, less returns. */
  revenue: number;
  averageSale: number;
  lastSaleAt: DateTimeString | null;
  lastSignInAt: DateTimeString | null;
  createdAt: DateTimeString;
}

export interface PlatformDashboardDto {
  from: DateOnly;
  to: DateOnly;
  businessCount: number;
  activeCount: number;
  expiringSoonCount: number;
  gracePeriodCount: number;
  expiredCount: number;
  unlicensedCount: number;
  suspendedCount: number;
  closedCount: number;
  saleCount: number;
  revenue: number;
  licenseIncome: number;
  businesses: BusinessPerformanceDto[];
}

export interface BusinessDetailDto {
  summary: BusinessSummaryDto;
  licenses: BusinessLicenseDto[];
  members: UserDto[];
  last30Days: BusinessPerformanceDto;
}

export interface CreateSuperUserRequestDto { fullName: string; email: string; phoneNumber?: string | null; password?: string | null }
export interface CreatedAccountDto { user: UserDto; temporaryPassword: string | null }
