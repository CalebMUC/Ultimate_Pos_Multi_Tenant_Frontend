// Application/Expenses/Dtos/ExpenseDtos.cs
import type { ExpensePaymentMethod, ExpenseStatus } from '../enums';
import type { DateOnly, DateTimeString, Guid } from './common';

export interface ExpenseCategoryDto { expenseCategoryId: Guid; code: string; name: string; description: string | null; isActive: boolean }
export interface CreateExpenseCategoryRequestDto { code: string; name: string; description: string | null }
export interface UpdateExpenseCategoryRequestDto { name: string; description: string | null }

export interface CreateExpenseRequestDto {
  expenseDate: DateOnly;
  expenseCategoryId: Guid;
  description: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  paymentReference: string | null;
  supplierId: Guid | null;
  payeeName: string | null;
  supplierInvoiceNumber: string | null;
  etimsControlNumber: string | null;
  receiptUrl: string | null;
  notes: string | null;
  /** Defaults to the active branch. */
  branchId?: Guid | null;
  /** A cost of no one branch (head-office rent). Needs Branches.AccessAll; leave branchId out. */
  businessWide?: boolean;
  /** The rider the cost was for (their fuel), as named on delivery trips. Only tagged expenses count as a rider's fuel. */
  riderName?: string | null;
}
/** Date, amount, payment method and branch are locked after posting. riderName: null keeps the tag, "" removes it. */
export type UpdateExpenseRequestDto = Omit<CreateExpenseRequestDto, 'expenseDate' | 'amount' | 'paymentMethod' | 'branchId' | 'businessWide'>;

/** Raw shape: paymentMethod and status are pre-formatted strings. */
export interface ExpenseApiDto {
  expenseId: Guid;
  expenseNumber: string;
  expenseDate: DateOnly;
  expenseCategoryId: Guid;
  categoryCode: string;
  categoryName: string;
  description: string;
  amount: number;
  paymentMethod: string;
  paymentReference: string | null;
  supplierId: Guid | null;
  supplierName: string | null;
  payeeName: string | null;
  supplierInvoiceNumber: string | null;
  etimsControlNumber: string | null;
  receiptUrl: string | null;
  notes: string | null;
  status: string;
  createdAt: DateTimeString;
  voidedAt: DateTimeString | null;
  voidReason: string | null;
  /** Null = business-wide. */
  branchId?: Guid | null;
  riderName?: string | null;
}
export interface ExpenseDto extends Omit<ExpenseApiDto, 'paymentMethod' | 'status'> {
  paymentMethod: ExpensePaymentMethod;
  status: ExpenseStatus;
}

export interface ExpenseQuery {
  page?: number;
  pageSize?: number;
  from?: DateOnly;
  to?: DateOnly;
  categoryId?: Guid;
  supplierId?: Guid;
  paymentMethod?: ExpensePaymentMethod;
  status?: ExpenseStatus;
  search?: string;
  missingEtims?: boolean;
  riderName?: string;
}

export interface ExpenseCategoryTotalDto {
  expenseCategoryId: Guid; code: string; name: string; expenseCount: number; total: number; percentOfTotal: number;
}
export interface ExpensePaymentMethodTotalDto { paymentMethod: string; expenseCount: number; total: number }
export interface ExpenseSummaryDto {
  from: DateOnly; to: DateOnly; totalExpenses: number; expenseCount: number;
  byCategory: ExpenseCategoryTotalDto[]; byPaymentMethod: ExpensePaymentMethodTotalDto[];
  expensesMissingEtimsCount: number; expensesMissingEtimsAmount: number;
}
