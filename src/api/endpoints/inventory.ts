import { utcOffsetMinutes } from '@/lib/format';
import { cleanParams } from '@/lib/utils';
import { api } from '../client';
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
  levels: (belowReorderOnly = false) => api.get<StockLevelDto[]>('/stock', belowReorderOnly ? { belowReorderOnly } : undefined),
  level: (productId: Guid) => api.get<StockLevelDto>(`/stock/${productId}`),
  movements: async (productId: Guid) => (await api.get<StockMovementApiDto[]>(`/stock/${productId}/movements`)).map(mapStockMovement),
  adjust: (body: CreateStockAdjustmentRequestDto) => api.post<StockLevelDto>('/stock/adjustments', body),
  batches: async (query: BatchQuery = {}) => (await api.get<StockBatchApiDto[]>('/stock/batches', cleanParams(query))).map(mapStockBatch),
  expiryReport: async (withinDays = 90): Promise<ExpiryReportDto> => {
    const report = await api.get<ExpiryReportDto>('/stock/expiry-report', { withinDays });
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
  list: (query: PageParams & { supplierId?: Guid; status?: PurchaseOrderStatus }) =>
    api.getPaged<PurchaseOrderDto>('/purchase-orders', cleanParams(query)),
  get: (id: Guid) => api.get<PurchaseOrderDto>(`/purchase-orders/${id}`),
  create: (body: CreatePurchaseOrderRequestDto) => api.post<PurchaseOrderDto>('/purchase-orders', body),
  cancel: (id: Guid) => api.post<PurchaseOrderDto>(`/purchase-orders/${id}/cancel`),
  receive: (id: Guid, body: ReceivePurchaseOrderRequestDto) => api.post<PurchaseOrderDto>(`/purchase-orders/${id}/receive`, body),
};

export const costingApi = {
  stockValuation: (itemType?: ItemType) => api.get<StockValuationDto>('/costing/stock-valuation', cleanParams({ itemType })),
  margins: (priceType?: PriceType) => api.get<MarginRowDto[]>('/costing/margins', cleanParams({ priceType })),
  /** from/to are DateTimeOffset: send the local day bounds with offset. */
  profit: (from: string, to: string, productId?: Guid) => api.get<ProfitReportDto>('/costing/profit', cleanParams({ from, to, productId })),
  profitAndLoss: (from: DateOnly, to: DateOnly) =>
    api.get<ProfitAndLossDto>('/costing/profit-and-loss', { from, to, utcOffsetMinutes: utcOffsetMinutes() }),
  revalue: (body: RevalueStockRequestDto) => api.post<StockValuationRowDto>('/costing/revaluations', body),
};
