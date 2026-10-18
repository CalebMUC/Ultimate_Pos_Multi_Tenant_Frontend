import { utcOffsetMinutes } from '@/lib/format';
import { cleanParams } from '@/lib/utils';
import { api } from '../client';
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
  list: async (query: ExpenseQuery) => {
    const paged = await api.getPaged<ExpenseApiDto>('/expenses', cleanParams(query));
    return { ...paged, items: paged.items.map(mapExpense) };
  },
  get: async (id: Guid) => mapExpense(await api.get<ExpenseApiDto>(`/expenses/${id}`)),
  create: async (body: CreateExpenseRequestDto) => mapExpense(await api.post<ExpenseApiDto>('/expenses', body)),
  update: async (id: Guid, body: UpdateExpenseRequestDto) => mapExpense(await api.put<ExpenseApiDto>(`/expenses/${id}`, body)),
  void: async (id: Guid, reason: string) => mapExpense(await api.post<ExpenseApiDto>(`/expenses/${id}/void`, { reason })),
  summary: (from: DateOnly, to: DateOnly) => api.get<ExpenseSummaryDto>('/expenses/summary', { from, to }),
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
  list: (query: PageParams & { productId?: Guid }) => api.getPaged<ProductionRunDto>('/production-runs', cleanParams(query)),
  get: (id: Guid) => api.get<ProductionRunDto>(`/production-runs/${id}`),
};

export const dashboardApi = {
  summary: (from?: DateOnly, to?: DateOnly) => api.get<DashboardSummaryDto>('/dashboard/summary', cleanParams({ from, to, ...tz() })),
};

export const reportsApi = {
  sales: (from: DateOnly, to: DateOnly, top = 10) => api.get<SalesReportDto>('/reports/sales', { from, to, top, ...tz() }),
  productionCosts: (from: DateOnly, to: DateOnly, productId?: Guid) =>
    api.get<ProductionCostReportDto>('/reports/production-costs', cleanParams({ from, to, productId, ...tz() })),
  customerAging: (query: { asOf?: DateOnly; customerId?: Guid; includeInvoices?: boolean; includeSettled?: boolean } = {}) =>
    api.get<CustomerAgingReportDto>('/reports/customer-aging', cleanParams({ ...query, ...tz() })),
  stockStatus: (query: { itemType?: ItemType; categoryId?: Guid; status?: StockStatus; includeInactive?: boolean; usageDays?: number } = {}) =>
    api.get<StockStatusReportDto>('/reports/inventory/stock-status', cleanParams({ ...query, ...tz() })),
  stockMovements: (from: DateOnly, to: DateOnly, productId?: Guid) =>
    api.get<StockMovementReportDto>('/reports/inventory/movements', cleanParams({ from, to, productId, ...tz() })),
  stockAdjustments: (from: DateOnly, to: DateOnly, productId?: Guid) =>
    api.get<StockAdjustmentReportDto>('/reports/inventory/adjustments', cleanParams({ from, to, productId, ...tz() })),
  purchaseSummary: (from: DateOnly, to: DateOnly, supplierId?: Guid) =>
    api.get<PurchaseSummaryDto>('/reports/purchases/summary', cleanParams({ from, to, supplierId, ...tz() })),
  openOrders: (supplierId?: Guid) => api.get<OpenOrdersReportDto>('/reports/purchases/open-orders', cleanParams({ supplierId, ...tz() })),
  priceTrends: (from: DateOnly, to: DateOnly, productId?: Guid, supplierId?: Guid) =>
    api.get<PriceTrendsReportDto>('/reports/purchases/price-trends', cleanParams({ from, to, productId, supplierId, ...tz() })),
};
