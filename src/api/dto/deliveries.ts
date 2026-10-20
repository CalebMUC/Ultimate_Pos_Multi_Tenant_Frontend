// Application/Deliveries/DeliveryOrders.cs
import type { DeliveryOrderStatus, PaymentMethod } from '../enums';
import type { DateOnly, DateTimeString, Guid } from './common';

/** Two 20L refills is (water, 20L, 2); a container bought with them is a line of its own. */
export interface DeliveryOrderLineRequestDto { productId: Guid; unitOfMeasureId: Guid; quantity: number }

export interface CreateDeliveryOrderRequestDto {
  /** A registered customer: register one at the phone first. */
  customerId: Guid;
  deliveryAddress: string;
  /** Defaults to the customer's phone. */
  contactPhone: string | null;
  notes: string | null;
  lines: DeliveryOrderLineRequestDto[];
}

/**
 * Recorded when the rider is back. Cash (amountTendered), MpesaTill (mpesaTransactionId) or Credit: charged to the customer's account,
 * needs DeliveryOrders.AcceptCredit. lines: what was actually handed over, when it differs from the order; left out = as ordered.
 */
export interface DeliverDeliveryOrderRequestDto {
  paymentMethod: PaymentMethod;
  amountTendered?: number | null;
  mpesaTransactionId?: Guid | null;
  overrideCreditLimit?: boolean;
  lines?: DeliveryOrderLineRequestDto[] | null;
  notes?: string | null;
}

export interface DeliveryOrderLineDto {
  deliveryOrderLineId: Guid;
  productId: Guid;
  productName: string;
  sku: string;
  unitOfMeasureId: Guid;
  unitSymbol: string | null;
  quantity: number;
  quantityInBaseUnits: number;
}

export interface DeliveryOrderDto {
  deliveryOrderId: Guid;
  orderNumber: string;
  status: DeliveryOrderStatus;
  customerId: Guid;
  customerName: string;
  deliveryAddress: string;
  contactPhone: string | null;
  notes: string | null;
  /** At the customer's prices when the order was taken. saleTotal is what was charged. */
  estimatedTotal: number;
  riderName: string | null;
  dispatchedAt: DateTimeString | null;
  saleId: Guid | null;
  saleNumber: string | null;
  saleTotal: number | null;
  paymentMethod: PaymentMethod | null;
  paymentDueDate: DateOnly | null;
  deliveredAt: DateTimeString | null;
  cancelledAt: DateTimeString | null;
  cancelReason: string | null;
  createdAt: DateTimeString;
  createdBy: Guid | null;
  branchId: Guid;
  kraBranchId: string | null;
  branchName: string | null;
  lines: DeliveryOrderLineDto[];
}

/** from/to: the local days the orders were taken. */
export interface DeliveryOrderQuery {
  page?: number;
  pageSize?: number;
  status?: DeliveryOrderStatus;
  customerId?: Guid;
  riderName?: string;
  from?: DateOnly;
  to?: DateOnly;
}

/** cashCollected is the cash the rider should hand in. outForDeliveryNow is as of now, whatever the period. */
export interface RiderSummaryDto {
  riderName: string;
  deliveredCount: number;
  deliveredTotal: number;
  cashCollected: number;
  paidByMpesaTill: number;
  onCredit: number;
  outForDeliveryNow: number;
}

export interface DeliverySummaryDto {
  from: DateOnly;
  to: DateOnly;
  deliveredCount: number;
  deliveredTotal: number;
  cashCollected: number;
  paidByMpesaTill: number;
  onCredit: number;
  cancelledCount: number;
  pendingNow: number;
  outForDeliveryNow: number;
  byRider: RiderSummaryDto[];
}
