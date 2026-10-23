// Application/Customers/CustomerInsights.cs
import type { CustomerInsightsSort, CustomerSegment, CustomerSuggestedAction, PaymentMethod } from '../enums';
import type { DateOnly, DateTimeString, Guid } from './common';
import type { CustomerMonthlySpendDto } from './sales';

/** One customer's buying in a period, ranked against the business's other customers by the API. */
export interface CustomerBuyingSummaryDto {
  customerId: Guid;
  customerName: string;
  phoneNumber: string | null;
  purchaseCount: number;
  /** Completed sales, VAT included, less returns. */
  totalSpent: number;
  averageSpend: number;
  /** Ever, not just in the period. */
  firstPurchaseAt: DateTimeString | null;
  lastPurchaseAt: DateTimeString;
  daysSinceLastPurchase: number;
  /** Null with one purchase. */
  averageDaysBetweenPurchases: number | null;
  /** The standing discount; null = none. */
  discountPercent: number | null;
  /** Standing-discount money given in the period. */
  discountGiven: number;
  segment: CustomerSegment;
  suggestedAction: CustomerSuggestedAction;
  /** 1 = spent the most in the period. */
  spendRank: number;
}

export interface CustomerMonthDto { month: string; purchaseCount: number; total: number }
/** quantityInBaseUnits: net of returns, in the product's base unit (litres of water). */
export interface CustomerProductDto { productId: Guid; productName: string; baseUnitSymbol: string | null; quantityInBaseUnits: number; total: number }
export interface CustomerPaymentMixDto { paymentMethod: PaymentMethod; purchaseCount: number; total: number }

export interface CustomerInsightsDto {
  customerId: Guid;
  customerName: string;
  phoneNumber: string | null;
  from: DateOnly;
  to: DateOnly;
  /** Null when nothing was bought in the period. */
  summary: CustomerBuyingSummaryDto | null;
  /** Every month in the period, zeros included. */
  byMonth: CustomerMonthDto[];
  topProducts: CustomerProductDto[];
  byPaymentMethod: CustomerPaymentMixDto[];
  deliveredByRider: number;
  boughtAtCounter: number;
  returnedAmount: number;
  balance: number | null;
  creditLimit: number | null;
  discountPercent: number | null;
  discountNote: string | null;
  discountSetAt: DateTimeString | null;
  /** The business's cap; null = none. */
  maxDiscountPercent: number | null;
  /** What "Regular" is measured against. */
  typicalDaysBetweenPurchases: number | null;
  /** Plain sentences behind the segment and suggestion. */
  reasons: string[];
  /** This calendar month against the monthly-spend reward; null when the business has none. */
  thisMonth?: CustomerMonthlySpendDto | null;
}

/** from/to: local days. Left out: the last 90 days. */
export interface CustomerInsightsQuery {
  page?: number;
  pageSize?: number;
  from?: DateOnly;
  to?: DateOnly;
  segment?: CustomerSegment;
  suggestedAction?: CustomerSuggestedAction;
  search?: string;
  sort?: CustomerInsightsSort;
}

/** The dashboard's customer panel: always the 90 days up to `to`. */
export interface DashboardCustomersDto {
  from: DateOnly;
  to: DateOnly;
  activeCustomers: number;
  newCustomers: number;
  regularCustomers: number;
  slippingCustomers: number;
  discountCandidates: number;
  customersWithDiscount: number;
  registeredRevenue: number;
  /** Sales with no customer: buyers that can't be rewarded or followed up. */
  walkInRevenue: number;
  topCustomers: CustomerBuyingSummaryDto[];
  candidates: CustomerBuyingSummaryDto[];
  slipping: CustomerBuyingSummaryDto[];
}
