import { utcOffsetMinutes } from '@/lib/format';
import { cleanParams } from '@/lib/utils';
import { api } from '../client';
import { branchParam, type BranchScope } from '../branchScope';
import { mapExpense } from '../mappers';
import type { ItemType, StockStatus } from '../enums';
import type { DateOnly, Guid, PageParams } from '../dto/common';
import type {
  CreateExpenseCategoryRequestDto, CreateExpenseRequestDto, ExpenseApiDto, ExpenseCategoryDto, ExpenseQuery, ExpenseSummaryDto,
  UpdateExpenseCategoryRequestDto, UpdateExpenseRequestDto,
} from '../dto/expenses';
import type {
  CreateFormulaRequestDto, CreateProductionRunRequestDto, FormulaDto, ProductionPreviewDto, ProductionRunDto,
} from '../dto/production';
import type {
  CustomerAgingReportDto, DashboardSummaryDto, OpenOrdersReportDto, PriceTrendsReportDto, ProductionCostReportDto, PurchaseSummaryDto,
  SalesReportDto, StockAdjustmentReportDto, StockMovementReportDto, StockStatusReportDto,
} from '../dto/reports';

const tz = () => ({ utcOffsetMinutes: utcOffsetMinutes() });

export const expenseCategoriesApi = {
  list: (activeOnly = false) => api.get<ExpenseCategoryDto[]>('/expense-categories', activeOnly ? { activeOnly } : undefined),
  create: (body: CreateExpenseCategoryRequestDto) => api.post<ExpenseCategoryDto>('/expense-categories', body),
  update: (id: Guid, body: UpdateExpenseCategoryRequestDto) => api.put<ExpenseCategoryDto>(`/expense-categories/${id}`, body),
  activate: (id: Guid) => api.post<ExpenseCategoryDto>(`/expense-categories/${id}/activate`),
  deactivate: (id: Guid) => api.post<ExpenseCategoryDto>(`/expense-categories/${id}/deactivate`),
};

export const expensesApi = {
  list: async (query: ExpenseQuery & BranchScope) => {
    const paged = await api.getPaged<ExpenseApiDto>('/expenses', cleanParams(query));
    return { ...paged, items: paged.items.map(mapExpense) };
  },
  get: async (id: Guid) => mapExpense(await api.get<ExpenseApiDto>(`/expenses/${id}`)),
  create: async (body: CreateExpenseRequestDto) => mapExpense(await api.post<ExpenseApiDto>('/expenses', body)),
  update: async (id: Guid, body: UpdateExpenseRequestDto) => mapExpense(await api.put<ExpenseApiDto>(`/expenses/${id}`, body)),
  void: async (id: Guid, reason: string) => mapExpense(await api.post<ExpenseApiDto>(`/expenses/${id}/void`, { reason })),
  summary: (from: DateOnly, to: DateOnly, scope?: BranchScope) => api.get<ExpenseSummaryDto>('/expenses/summary', { from, to, ...branchParam(scope) }),
};

export const formulasApi = {
  list: (query: { productId?: Guid; activeOnly?: boolean } = {}) => api.get<FormulaDto[]>('/formulas', cleanParams(query)),
  get: (id: Guid) => api.get<FormulaDto>(`/formulas/${id}`),
  /** Creating a formula for a product that already has one makes a new version. */
  create: (body: CreateFormulaRequestDto) => api.post<FormulaDto>('/formulas', body),
  deactivate: (id: Guid) => api.post<FormulaDto>(`/formulas/${id}/deactivate`),
};

export const productionApi = {
  preview: (body: CreateProductionRunRequestDto) => api.post<ProductionPreviewDto>('/production-runs/preview', body),
  record: (body: CreateProductionRunRequestDto) => api.post<ProductionRunDto>('/production-runs', body),
  list: (query: PageParams & BranchScope & { productId?: Guid }) => api.getPaged<ProductionRunDto>('/production-runs', cleanParams(query)),
  get: (id: Guid) => api.get<ProductionRunDto>(`/production-runs/${id}`),
};

export const dashboardApi = {
  summary: (from?: DateOnly, to?: DateOnly, scope?: BranchScope) =>
    api.get<DashboardSummaryDto>('/dashboard/summary', cleanParams({ from, to, ...tz(), ...branchParam(scope) })),
};

export const reportsApi = {
  sales: (from: DateOnly, to: DateOnly, top = 10, scope?: BranchScope) =>
    api.get<SalesReportDto>('/reports/sales', { from, to, top, ...tz(), ...branchParam(scope) }),
  productionCosts: (from: DateOnly, to: DateOnly, productId?: Guid, scope?: BranchScope) =>
    api.get<ProductionCostReportDto>('/reports/production-costs', cleanParams({ from, to, productId, ...tz(), ...branchParam(scope) })),
  customerAging: (query: BranchScope & { asOf?: DateOnly; customerId?: Guid; includeInvoices?: boolean; includeSettled?: boolean } = {}) =>
    api.get<CustomerAgingReportDto>('/reports/customer-aging', cleanParams({ ...query, ...tz() })),
  stockStatus: (query: BranchScope & { itemType?: ItemType; categoryId?: Guid; status?: StockStatus; includeInactive?: boolean; usageDays?: number } = {}) =>
    api.get<StockStatusReportDto>('/reports/inventory/stock-status', cleanParams({ ...query, ...tz() })),
  stockMovements: (from: DateOnly, to: DateOnly, productId?: Guid, scope?: BranchScope) =>
    api.get<StockMovementReportDto>('/reports/inventory/movements', cleanParams({ from, to, productId, ...tz(), ...branchParam(scope) })),
  stockAdjustments: (from: DateOnly, to: DateOnly, productId?: Guid, scope?: BranchScope) =>
    api.get<StockAdjustmentReportDto>('/reports/inventory/adjustments', cleanParams({ from, to, productId, ...tz(), ...branchParam(scope) })),
  purchaseSummary: (from: DateOnly, to: DateOnly, supplierId?: Guid, scope?: BranchScope) =>
    api.get<PurchaseSummaryDto>('/reports/purchases/summary', cleanParams({ from, to, supplierId, ...tz(), ...branchParam(scope) })),
  openOrders: (supplierId?: Guid, scope?: BranchScope) =>
    api.get<OpenOrdersReportDto>('/reports/purchases/open-orders', cleanParams({ supplierId, ...tz(), ...branchParam(scope) })),
  priceTrends: (from: DateOnly, to: DateOnly, productId?: Guid, supplierId?: Guid, scope?: BranchScope) =>
    api.get<PriceTrendsReportDto>('/reports/purchases/price-trends', cleanParams({ from, to, productId, supplierId, ...tz(), ...branchParam(scope) })),
};
