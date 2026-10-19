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
}
/** Date, amount, payment method and branch are locked after posting. */
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
