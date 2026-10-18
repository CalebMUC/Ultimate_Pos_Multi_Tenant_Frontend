// Application/Reports/Dtos/ReportsDtos.cs and Application/Dashboard/Dtos/DashboardDtos.cs.
// Report DTOs carry enum-like values (payment method, status, item type) as pre-formatted strings.
import type { DateOnly, DateTimeString, Guid } from './common';

export interface SalesByDayDto { date: DateOnly; saleCount: number; revenue: number }
export interface SalesByPaymentMethodDto { paymentMethod: string; saleCount: number; total: number; percentOfRevenue: number }
export interface SalesByCustomerDto { customerId: Guid | null; customerName: string; saleCount: number; total: number }
export interface SalesByProductDto { productId: Guid; productName: string; sku: string; quantitySoldInBaseUnits: number; revenue: number; percentOfRevenue: number }
export interface SalesReportDto {
  from: DateOnly; to: DateOnly; saleCount: number; revenue: number; averageSaleValue: number;
  voidedCount: number; voidedAmount: number; pendingCount: number; pendingAmount: number;
  byDay: SalesByDayDto[]; byPaymentMethod: SalesByPaymentMethodDto[]; topCustomers: SalesByCustomerDto[]; topProducts: SalesByProductDto[];
}

export interface ProductionCostByProductDto {
  productId: Guid; productName: string; sku: string; unitOfMeasureId: Guid; unitSymbol: string;
  runCount: number; quantityPlanned: number; quantityProduced: number; yieldPercent: number;
  materialCost: number; additionalCost: number; totalCost: number;
  averageCostPerUnit: number; lowestCostPerUnit: number; highestCostPerUnit: number; latestCostPerUnit: number; latestRunAt: DateTimeString;
}
export interface ProductionCostByTypeDto { costType: string; amount: number; percentOfAdditionalCost: number }
export interface ProductionIngredientCostDto {
  ingredientProductId: Guid; ingredientName: string; ingredientSku: string; baseUnitSymbol: string;
  quantityInBaseUnits: number; totalCost: number; percentOfMaterialCost: number;
}
export interface ProductionCostReportDto {
  from: DateOnly; to: DateOnly; runCount: number; materialCost: number; additionalCost: number; totalCost: number;
  byProduct: ProductionCostByProductDto[]; additionalCostsByType: ProductionCostByTypeDto[]; topIngredients: ProductionIngredientCostDto[];
}

export interface AgingBucketsDto { days0To30: number; days31To60: number; days61To90: number; over90: number }
export interface OpenInvoiceDto {
  invoiceId: Guid; invoiceNumber: string | null; invoiceDate: DateOnly; originalAmount: number; outstandingAmount: number; ageDays: number; bucket: string;
}
export interface CustomerAgingRowDto {
  customerId: Guid; customerName: string; phoneNumber: string | null; outstanding: number; unappliedCredit: number; netBalance: number;
  buckets: AgingBucketsDto; openInvoiceCount: number; oldestOpenInvoiceDate: DateOnly | null; oldestOpenInvoiceAgeDays: number | null;
  openInvoices: OpenInvoiceDto[] | null;
}
export interface CustomerAgingReportDto {
  asOf: DateOnly; customerCount: number; totalOutstanding: number; totalUnappliedCredit: number; totals: AgingBucketsDto;
  customers: CustomerAgingRowDto[];
}

export interface StockStatusItemDto {
  productId: Guid; productName: string; sku: string; itemType: string; category: string; baseUnitSymbol: string;
  quantityOnHand: number; reorderLevel: number; status: string; shortfall: number; averageDailyUsage: number; daysOfCover: number | null;
  averageUnitCost: number | null; stockValue: number | null; costMissing: boolean | null;
}
export interface StockStatusByItemTypeDto { itemType: string; productCount: number; lowStockCount: number; outOfStockCount: number; stockValue: number | null }
export interface StockStatusReportDto {
  usageDays: number; usageFrom: DateOnly; usageTo: DateOnly; productCount: number; inStockCount: number; lowStockCount: number;
  outOfStockCount: number; totalStockValue: number | null; productsMissingCost: number | null;
  byItemType: StockStatusByItemTypeDto[]; items: StockStatusItemDto[];
}

export interface StockMovementReportRowDto {
  productId: Guid; productName: string; sku: string; baseUnitSymbol: string;
  opening: number; received: number; produced: number; sold: number; consumed: number; adjustedIn: number; adjustedOut: number;
  closing: number; movementCount: number;
  receivedValue: number | null; soldCost: number | null; consumedCost: number | null; adjustmentNetValue: number | null;
}
export interface StockMovementReportDto {
  from: DateOnly; to: DateOnly; productCount: number;
  totalReceivedValue: number | null; totalSoldCost: number | null; totalConsumedCost: number | null; totalAdjustmentNetValue: number | null;
  items: StockMovementReportRowDto[];
}

export interface StockAdjustmentItemDto {
  stockMovementId: Guid; createdAt: DateTimeString; date: DateOnly; productId: Guid; productName: string; sku: string; baseUnitSymbol: string;
  quantityChange: number; direction: string; unitCost: number | null; value: number | null; reason: string | null;
  adjustedById: Guid | null; adjustedBy: string | null;
}
export interface StockAdjustmentReportDto {
  from: DateOnly; to: DateOnly; adjustmentCount: number; increaseCount: number; decreaseCount: number;
  increaseValue: number | null; decreaseValue: number | null; netValue: number | null; uncostedCount: number | null; truncated: boolean;
  items: StockAdjustmentItemDto[];
}

export interface PurchaseByStatusDto { status: string; orderCount: number; orderedValue: number }
export interface PurchaseBySupplierDto {
  supplierId: Guid; supplierName: string; orderCount: number; orderedValue: number; receivedValue: number; outstandingValue: number; percentOfOrdered: number;
}
export interface PurchaseByProductDto {
  productId: Guid; productName: string; sku: string; unitOfMeasureId: Guid; unitSymbol: string;
  quantityOrdered: number; quantityReceived: number; orderedValue: number; averageUnitCost: number; percentOfOrdered: number;
}
export interface PurchaseSummaryDto {
  from: DateOnly; to: DateOnly; orderCount: number; cancelledCount: number; cancelledValue: number;
  orderedValue: number; receivedValue: number; outstandingValue: number; unpricedLineCount: number;
  byStatus: PurchaseByStatusDto[]; bySupplier: PurchaseBySupplierDto[]; topProducts: PurchaseByProductDto[];
}

export interface OpenOrderLineDto {
  productId: Guid; productName: string; sku: string; unitSymbol: string; quantityOrdered: number; quantityReceived: number;
  quantityOutstanding: number; unitCost: number; outstandingValue: number;
}
export interface OpenOrderDto {
  purchaseOrderId: Guid; orderNumber: string; supplierId: Guid; supplierName: string; status: string; orderDate: DateOnly; ageDays: number;
  expectedDeliveryDate: DateOnly | null; isOverdue: boolean; daysOverdue: number; outstandingValue: number; lines: OpenOrderLineDto[];
}
export interface OpenOrdersReportDto {
  asOf: DateOnly; orderCount: number; overdueCount: number; outstandingValue: number; overdueValue: number; orders: OpenOrderDto[];
}

export interface PricePointDto { date: DateOnly; orderNumber: string; supplierId: Guid; supplierName: string; quantity: number; unitCost: number }
export interface PriceTrendDto {
  productId: Guid; productName: string; sku: string; unitOfMeasureId: Guid; unitSymbol: string;
  purchaseCount: number; supplierCount: number; quantityOrdered: number; averageUnitCost: number;
  firstUnitCost: number; latestUnitCost: number; latestDate: DateOnly; latestSupplier: string;
  lowestUnitCost: number; lowestSupplier: string; highestUnitCost: number; highestSupplier: string;
  changePercent: number | null; points: PricePointDto[] | null;
}
export interface PriceTrendsReportDto { from: DateOnly; to: DateOnly; productCount: number; items: PriceTrendDto[] }

// ---- Dashboard ----
export interface DashboardSalesDto {
  from: DateOnly; to: DateOnly; saleCount: number; revenue: number; averageSaleValue: number;
  creditSalesAmount: number; voidedCount: number; pendingCount: number;
}
export interface DashboardProfitDto {
  from: DateOnly; to: DateOnly; revenue: number; costOfGoodsSold: number; grossProfit: number; grossMarginPercent: number | null;
  operatingExpenses: number; netProfit: number; netMarginPercent: number | null; uncostedRevenue: number; isComplete: boolean;
}
export interface DashboardReceivablesDto { totalOutstanding: number; customersOwing: number; totalCustomerCredit: number; customersInCredit: number }
export interface DashboardStockDto { lowStockCount: number; outOfStockCount: number; totalStockValue: number | null; productsMissingCost: number | null }
export interface DashboardProductionDto { from: DateOnly; to: DateOnly; runCount: number; totalCost: number }
export interface DashboardSummaryDto {
  from: DateOnly; to: DateOnly; sections: string[]; hiddenSections: string[];
  sales: DashboardSalesDto | null; profit: DashboardProfitDto | null; receivables: DashboardReceivablesDto | null;
  stock: DashboardStockDto | null; production: DashboardProductionDto | null;
}
