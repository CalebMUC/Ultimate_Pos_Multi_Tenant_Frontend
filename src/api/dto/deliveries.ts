// Application/Deliveries/DeliveryOrders.cs
import type { DeliveryOrderStatus, PaymentMethod } from '../enums';
import type { DateOnly, DateTimeString, Guid } from './common';

/** Two 20L refills is (water, 20L, 2); a container bought with them is a line of its own. */
export interface DeliveryOrderLineRequestDto { productId: Guid; unitOfMeasureId: Guid; quantity: number }
/** A bundle ordered as one item, priced as the bundle. Whole bundles only. */
export interface DeliveryOrderBundleRequestDto { productBundleId: Guid; quantity: number }

export interface CreateDeliveryOrderRequestDto {
  /** A registered customer: register one at the phone first. */
  customerId: Guid;
  deliveryAddress: string;
  /** Defaults to the customer's phone. */
  contactPhone: string | null;
  notes: string | null;
  /** An order needs at least one line or one bundle. */
  lines: DeliveryOrderLineRequestDto[];
  bundles?: DeliveryOrderBundleRequestDto[] | null;
  /** How the customer will pay: Cash, MpesaReference, MpesaTill or Credit. A guide for the rider, not a payment. Defaults to Cash. */
  expectedPaymentMethod?: PaymentMethod | null;
  /** Given when the rider leaves at once (checkout by rider): the order goes straight out, which also needs DeliveryOrders.Dispatch. */
  riderName?: string | null;
  /** A trip still out with the same rider to add this order to. */
  deliveryTripId?: Guid | null;
}

/**
 * Recorded when the rider is back: completes the sale. Cash (amountTendered), MpesaTill (mpesaTransactionId), MpesaReference (mpesaReference,
 * required) or Credit (needs DeliveryOrders.AcceptCredit). lines/bundles: what was actually handed over; leave both out to keep the order.
 */
export interface DeliverDeliveryOrderRequestDto {
  paymentMethod: PaymentMethod;
  amountTendered?: number | null;
  mpesaTransactionId?: Guid | null;
  mpesaReference?: string | null;
  overrideCreditLimit?: boolean;
  lines?: DeliveryOrderLineRequestDto[] | null;
  bundles?: DeliveryOrderBundleRequestDto[] | null;
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
  /** Set on the lines of a bundle: one line per part, sharing it. bundleQuantity is how many bundles. */
  productBundleId?: Guid | null;
  bundleName?: string | null;
  bundleQuantity?: number | null;
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
  /** At the customer's prices when the order was taken. While the order is open, what the rider should come back with. */
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
  /** How the customer said they will pay. Null on orders taken before it was asked. */
  expectedPaymentMethod?: PaymentMethod | null;
  deliveryTripId?: Guid | null;
  tripNumber?: string | null;
  returnedAt?: DateTimeString | null;
  returnReason?: string | null;
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
  deliveryTripId?: Guid;
}

/**
 * cashCollected is the cash the rider should hand in. outForDeliveryNow is as of now, whatever the period, and cashExpectedNow is what the
 * orders they have out now should bring back in cash.
 */
export interface RiderSummaryDto {
  riderName: string;
  deliveredCount: number;
  deliveredTotal: number;
  cashCollected: number;
  paidByMpesaTill: number;
  onCredit: number;
  outForDeliveryNow: number;
  returnedCount: number;
  tripCount: number;
  cashExpectedNow: number;
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
  returnedCount: number;
  tripCount: number;
}

/** Several pending orders out with one rider: one trip (or added to deliveryTripId while it is still out). */
export interface DispatchTripRequestDto { riderName: string | null; deliveryOrderIds: Guid[]; deliveryTripId?: Guid | null }

export interface DeliveryTripOrderDto {
  deliveryOrderId: Guid;
  orderNumber: string;
  status: DeliveryOrderStatus;
  customerName: string;
  deliveryAddress: string;
  estimatedTotal: number;
  saleNumber: string | null;
  saleTotal: number | null;
}

export interface DeliveryTripDto {
  deliveryTripId: Guid;
  tripNumber: string;
  riderName: string;
  dispatchedAt: DateTimeString;
  branchId: Guid;
  orderCount: number;
  deliveredCount: number;
  returnedCount: number;
  outCount: number;
  deliveredTotal: number;
  /** Every order on it is delivered, returned or cancelled. */
  isBack: boolean;
  /** Back, and nothing on it was delivered: the fuel bought nothing. */
  isWasted: boolean;
  orders: DeliveryTripOrderDto[];
}

/** One rider's trips against the fuel paid for them (expenses tagged with the rider). */
export interface RiderFuelDto {
  riderName: string;
  tripCount: number;
  ordersCarried: number;
  deliveredCount: number;
  returnedCount: number;
  /** Trips that came back with nothing delivered. */
  wastedTrips: number;
  /** Trips that carried one order: could have been combined. */
  singleOrderTrips: number;
  fuelSpent: number;
  fuelExpenseCount: number;
  fuelPerTrip: number | null;
  expectedFuel: number | null;
  /** fuelSpent − expectedFuel: positive = more fuel than the trips account for. */
  fuelVariance: number | null;
  fuelAccountedFor: boolean;
  /** Fuel per trip is more than 20% above the business's average for the period. */
  aboveAverage: boolean;
}

export interface DeliveryFuelReportDto {
  from: DateOnly;
  to: DateOnly;
  expenseCategoryId: Guid | null;
  expectedFuelPerTrip: number | null;
  tripCount: number;
  wastedTrips: number;
  fuelSpent: number;
  averageFuelPerTrip: number | null;
  expectedFuel: number | null;
  fuelVariance: number | null;
  byRider: RiderFuelDto[];
}
