// Application/CashSessions/CashSessions.cs
import type { CashMovementType, CashSessionStatus } from '../enums';
import type { DateOnly, DateTimeString, Guid } from './common';

/** openingFloat: the cash put in the drawer for giving change. */
export interface OpenCashSessionRequestDto { openingFloat: number; notes: string | null }
/** A reason is required (e.g. banked at Equity, change for rider Peter). */
export interface RecordCashMovementRequestDto { movementType: CashMovementType; amount: number; reason: string }
/** countedCash: everything counted in the drawer at the close, the float included. */
export interface CloseCashSessionRequestDto { countedCash: number; notes: string | null }

export interface CashSessionMovementDto {
  cashSessionMovementId: Guid;
  movementType: CashMovementType;
  amount: number;
  reason: string;
  createdAt: DateTimeString;
  createdBy: Guid | null;
  createdByName: string | null;
}

/**
 * What should be in the drawer, worked out by the API: opening float + cash sales + customer payments + pay-ins − cash refunds − cash
 * expenses − supplier payments − pay-outs = expectedCash. Never recomputed here.
 */
export interface CashSessionBreakdownDto {
  openingFloat: number;
  /** Completed cash sales, delivery sales included (the cash riders handed in), net of change. */
  cashSales: number;
  cashSaleCount: number;
  customerPayments: number;
  payIns: number;
  cashRefunds: number;
  cashExpenses: number;
  supplierPayments: number;
  payOuts: number;
  expectedCash: number;
  /** What orders still out should bring back in cash. Not in the drawer yet, so not in expectedCash. 0 once closed. */
  cashStillWithRiders: number;
  ordersStillOut: number;
}

export interface CashSessionDto {
  cashSessionId: Guid;
  sessionNumber: string;
  status: CashSessionStatus;
  branchId: Guid;
  kraBranchId: string | null;
  branchName: string | null;
  openingFloat: number;
  openedAt: DateTimeString;
  openedBy: Guid | null;
  openedByName: string | null;
  openingNotes: string | null;
  countedCash: number | null;
  /** countedCash − expectedCash once closed: negative = the drawer is short. */
  variance: number | null;
  closedAt: DateTimeString | null;
  closedBy: Guid | null;
  closedByName: string | null;
  closingNotes: string | null;
  /** Live while open; fixed at the close. */
  breakdown: CashSessionBreakdownDto;
  movements: CashSessionMovementDto[];
}

/** from/to: the local days sessions were opened on. */
export interface CashSessionQuery {
  page?: number;
  pageSize?: number;
  from?: DateOnly;
  to?: DateOnly;
  status?: CashSessionStatus;
}
