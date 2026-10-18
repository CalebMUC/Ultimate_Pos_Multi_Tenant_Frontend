import { sum } from '@/lib/utils';
import type { PurchaseOrderDto } from '@/api/dto/inventory';

/** Ordered quantity × unit cost over all lines. The API doesn't return an order total. */
export const orderValue = (po: PurchaseOrderDto) => sum(po.lines, (l) => l.quantityOrdered * l.unitCost);
