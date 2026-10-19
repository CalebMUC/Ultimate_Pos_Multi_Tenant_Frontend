import { utcOffsetMinutes } from '@/lib/format';
import { cleanParams } from '@/lib/utils';
import { api } from '../client';
import { branchParam, type BranchScope } from '../branchScope';
import { mapStockBatch, mapStockMovement, parseExpiryStatus } from '../mappers';
import type { ItemType, PriceType, PurchaseOrderStatus } from '../enums';
import type { DateOnly, Guid, PageParams } from '../dto/common';
import type {
  SupplierBalanceDto, SupplierLedgerEntryDto, RecordSupplierPaymentRequestDto,
} from '../dto/business';
import type {
  BatchQuery, CreatePurchaseOrderRequestDto, CreateStockAdjustmentRequestDto, ExpiryReportDto, MarginRowDto, ProfitAndLossDto,
  ProfitReportDto, PurchaseOrderDto, ReceivePurchaseOrderRequestDto, RevalueStockRequestDto, StockBatchApiDto, StockLevelDto,
  StockMovementApiDto, StockValuationDto, StockValuationRowDto, SupplierDto, SupplierRequestDto,
} from '../dto/inventory';

export const stockApi = {
  /** One row per product and branch when not narrowed to a branch. */
  levels: (belowReorderOnly = false, scope?: BranchScope) =>
    api.get<StockLevelDto[]>('/stock', { ...(belowReorderOnly ? { belowReorderOnly } : {}), ...branchParam(scope) }),
  /** At the active branch, or the scope's branch. */
  level: (productId: Guid, scope?: BranchScope) => api.get<StockLevelDto>(`/stock/${productId}`, branchParam(scope)),
  movements: async (productId: Guid, scope?: BranchScope) =>
    (await api.get<StockMovementApiDto[]>(`/stock/${productId}/movements`, branchParam(scope))).map(mapStockMovement),
  adjust: (body: CreateStockAdjustmentRequestDto) => api.post<StockLevelDto>('/stock/adjustments', body),
  batches: async (query: BatchQuery & BranchScope = {}) => (await api.get<StockBatchApiDto[]>('/stock/batches', cleanParams(query))).map(mapStockBatch),
  expiryReport: async (withinDays = 90, scope?: BranchScope): Promise<ExpiryReportDto> => {
    const report = await api.get<ExpiryReportDto>('/stock/expiry-report', { withinDays, ...branchParam(scope) });
    return { ...report, items: report.items.map((i) => ({ ...i, expiryStatus: parseExpiryStatus(i.expiryStatus) })) };
  },
};

export const suppliersApi = {
  list: () => api.get<SupplierDto[]>('/suppliers'),
  get: (id: Guid) => api.get<SupplierDto>(`/suppliers/${id}`),
  create: (body: SupplierRequestDto) => api.post<SupplierDto>('/suppliers', body),
  update: (id: Guid, body: SupplierRequestDto) => api.put<SupplierDto>(`/suppliers/${id}`, body),
  activate: (id: Guid) => api.post<SupplierDto>(`/suppliers/${id}/activate`),
  deactivate: (id: Guid) => api.post<SupplierDto>(`/suppliers/${id}/deactivate`),
  /** Who the business owes, largest first. */
  balances: () => api.get<SupplierBalanceDto[]>('/suppliers/balances'),
  balance: (id: Guid) => api.get<SupplierBalanceDto>(`/suppliers/${id}/balance`),
  ledger: (id: Guid) => api.get<SupplierLedgerEntryDto[]>(`/suppliers/${id}/ledger`),
  recordPayment: (id: Guid, body: RecordSupplierPaymentRequestDto) => api.post<SupplierBalanceDto>(`/suppliers/${id}/payments`, body),
};

export const purchaseOrdersApi = {
  /** Item types the signed-in business may buy (the purchase policy). */
  purchasableItemTypes: () => api.get<ItemType[]>('/purchase-orders/purchasable-item-types'),
  list: (query: PageParams & BranchScope & { supplierId?: Guid; status?: PurchaseOrderStatus }) =>
    api.getPaged<PurchaseOrderDto>('/purchase-orders', cleanParams(query)),
  get: (id: Guid) => api.get<PurchaseOrderDto>(`/purchase-orders/${id}`),
  create: (body: CreatePurchaseOrderRequestDto) => api.post<PurchaseOrderDto>('/purchase-orders', body),
  cancel: (id: Guid) => api.post<PurchaseOrderDto>(`/purchase-orders/${id}/cancel`),
  receive: (id: Guid, body: ReceivePurchaseOrderRequestDto) => api.post<PurchaseOrderDto>(`/purchase-orders/${id}/receive`, body),
};

export const costingApi = {
  /** Narrowed to a branch: its own average costs. Otherwise one row per product, costs averaged by quantity. */
  stockValuation: (itemType?: ItemType, scope?: BranchScope) =>
    api.get<StockValuationDto>('/costing/stock-valuation', cleanParams({ itemType, ...branchParam(scope) })),
  margins: (priceType?: PriceType, scope?: BranchScope) => api.get<MarginRowDto[]>('/costing/margins', cleanParams({ priceType, ...branchParam(scope) })),
  /** from/to are DateTimeOffset: send the local day bounds with offset. */
  profit: (from: string, to: string, productId?: Guid, scope?: BranchScope) =>
    api.get<ProfitReportDto>('/costing/profit', cleanParams({ from, to, productId, ...branchParam(scope) })),
  profitAndLoss: (from: DateOnly, to: DateOnly, scope?: BranchScope) =>
    api.get<ProfitAndLossDto>('/costing/profit-and-loss', { from, to, utcOffsetMinutes: utcOffsetMinutes(), ...branchParam(scope) }),
  revalue: (body: RevalueStockRequestDto) => api.post<StockValuationRowDto>('/costing/revaluations', body),
};
