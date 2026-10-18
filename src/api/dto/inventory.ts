// Application/Inventory/Dtos, Application/Purchasing/Dtos and Application/Costing/Dtos
import type { ExpiryStatus, PurchaseOrderStatus, StockMovementType } from '../enums';
import type { ExpenseCategoryTotalDto } from './expenses';
import type { DateOnly, DateTimeString, Guid } from './common';

export interface StockLevelDto {
  productId: Guid;
  productName: string;
  sku: string;
  quantityOnHand: number;
  reorderLevel: number;
  belowReorderLevel: boolean;
  isBatchTracked: boolean;
  /** Batch-tracked: only unexpired lots. Otherwise the quantity on hand. */
  sellableQuantity: number | null;
  baseUnitSymbol: string | null;
}

/** Raw shape: movementType is a pre-formatted string. */
export interface StockMovementApiDto {
  stockMovementId: Guid;
  productId: Guid;
  movementType: string;
  quantityChange: number;
  referenceType: string;
  referenceId: Guid;
  batchId: Guid;
  notes: string | null;
  createdAt: DateTimeString;
  stockBatchId: Guid | null;
  batchNumber: string | null;
}
export interface StockMovementDto extends Omit<StockMovementApiDto, 'movementType'> {
  movementType: StockMovementType | null;
  movementTypeName: string;
}

export interface CreateStockAdjustmentRequestDto {
  productId: Guid;
  unitOfMeasureId: Guid;
  /** Signed, in unitOfMeasureId. */
  quantityChange: number;
  reason: string;
  unitCost?: number | null;
  stockBatchId?: Guid | null;
  batchNumber?: string | null;
  expiryDate?: DateOnly | null;
  manufactureDate?: DateOnly | null;
}

export interface StockBatchApiDto {
  stockBatchId: Guid;
  productId: Guid;
  productName: string;
  sku: string;
  batchNumber: string;
  expiryDate: DateOnly | null;
  manufactureDate: DateOnly | null;
  quantityOnHand: number;
  baseUnitSymbol: string | null;
  unitCost: number | null;
  daysToExpiry: number | null;
  expiryStatus: string;
  supplierId: Guid | null;
  purchaseOrderId: Guid | null;
  createdAt: DateTimeString;
}
export interface StockBatchDto extends Omit<StockBatchApiDto, 'expiryStatus'> { expiryStatus: ExpiryStatus }

export interface BatchQuery { productId?: Guid; expiringWithinDays?: number; includeExpired?: boolean; includeEmpty?: boolean }

export interface ExpiryReportItemDto {
  stockBatchId: Guid;
  productId: Guid;
  productName: string;
  sku: string;
  batchNumber: string;
  expiryDate: DateOnly;
  daysToExpiry: number;
  expiryStatus: ExpiryStatus;
  quantityOnHand: number;
  baseUnitSymbol: string | null;
  value: number | null;
}
export interface ExpiryReportDto {
  asOf: DateOnly;
  withinDays: number;
  expiredBatchCount: number;
  expiredValue: number | null;
  nearExpiryBatchCount: number;
  nearExpiryValue: number | null;
  items: ExpiryReportItemDto[];
}

// ---- Purchasing ----
export interface SupplierRequestDto {
  supplierName: string;
  kraPin: string | null;
  contactPerson: string | null;
  phoneNumber: string | null;
  email: string | null;
  physicalAddress: string | null;
  paymentTermDays: number | null;
}
export interface SupplierDto extends SupplierRequestDto { supplierId: Guid; businessId: Guid; isActive: boolean }

export interface CreatePurchaseOrderLineRequestDto { productId: Guid; unitOfMeasureId: Guid; quantityOrdered: number; unitCost: number }
export interface CreatePurchaseOrderRequestDto {
  supplierId: Guid;
  expectedDeliveryDate: DateTimeString | null;
  notes: string | null;
  lines: CreatePurchaseOrderLineRequestDto[];
}
export interface PurchaseOrderLineDto {
  purchaseOrderLineId: Guid;
  productId: Guid;
  unitOfMeasureId: Guid;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  productName: string | null;
  sku: string | null;
  unitSymbol: string | null;
  isBatchTracked: boolean;
}
export interface PurchaseOrderDto {
  purchaseOrderId: Guid;
  orderNumber: string;
  supplierId: Guid;
  status: PurchaseOrderStatus;
  orderDate: DateTimeString;
  expectedDeliveryDate: DateTimeString | null;
  notes: string | null;
  isActive: boolean;
  lines: PurchaseOrderLineDto[];
  supplierName: string | null;
}
export interface ReceiveLineRequestDto {
  purchaseOrderLineId: Guid;
  quantityReceived: number;
  batchNumber?: string | null;
  expiryDate?: DateOnly | null;
  manufactureDate?: DateOnly | null;
}
export interface ReceivePurchaseOrderRequestDto { lines: ReceiveLineRequestDto[]; notes: string | null; supplierInvoiceNumber: string | null }

// ---- Costing ----
export interface StockValuationRowDto {
  productId: Guid; productName: string; sku: string; itemType: string;
  quantityOnHand: number; averageUnitCost: number; stockValue: number; costMissing: boolean;
}
export interface StockValuationTotalDto { itemType: string; productCount: number; stockValue: number }
export interface StockValuationDto {
  items: StockValuationRowDto[]; totalsByItemType: StockValuationTotalDto[]; totalStockValue: number; productsMissingCost: number;
}
export interface MarginRowDto {
  productId: Guid; productName: string; sku: string; unitOfMeasureId: Guid; unitSymbol: string;
  priceType: string; price: number; unitCost: number; margin: number; marginPercent: number | null; costMissing: boolean;
}
export interface ProfitRowDto {
  productId: Guid; productName: string; sku: string; quantitySoldInBaseUnits: number;
  revenue: number; cost: number; grossProfit: number; marginPercent: number | null; uncostedRevenue: number;
}
export interface ProfitReportDto {
  from: DateTimeString; to: DateTimeString; items: ProfitRowDto[];
  totalRevenue: number; totalCost: number; grossProfit: number; marginPercent: number | null; uncostedRevenue: number;
}
export interface ProfitAndLossDto {
  from: DateOnly; to: DateOnly; revenue: number; costOfGoodsSold: number; grossProfit: number; grossMarginPercent: number | null;
  uncostedRevenue: number; operatingExpenses: ExpenseCategoryTotalDto[]; totalOperatingExpenses: number;
  netProfit: number; netMarginPercent: number | null; isComplete: boolean;
}
export interface RevalueStockRequestDto { productId: Guid; unitOfMeasureId: Guid; unitCost: number; reason: string }
