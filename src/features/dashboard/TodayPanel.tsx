'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Package, PackageCheck, TrendingUp, Truck, Wallet } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { StatCard } from '@/components/shared/Display';
import { expensesApi, reportsApi } from '@/api/endpoints/other';
import { stockApi, suppliersApi } from '@/api/endpoints/inventory';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { formatMoney, formatQty, todayIso } from '@/lib/format';
import type { BranchFilter } from '@/features/branches/branches';

/**
 * Today at a glance, whatever period the dashboard shows: takings, supplies received, expenses, what is owed to suppliers, and for the
 * day's best sellers how much was sold against what is left (litres of water for a refill station). Every card comes from an existing
 * endpoint and shows only when the user holds the permission that endpoint needs.
 */
export function TodayPanel({ branch }: { branch: BranchFilter }) {
  const key = useQueryKey();
  const today = todayIso();
  const canSales = usePermission('SalesReports.View');
  const canPurchases = usePermission('PurchaseReports.View');
  const canExpenses = usePermission('Expenses.View');
  const canPayables = usePermission('Suppliers.ViewLedger');
  const canStock = usePermission('Stock.View');

  const scope = { branchId: branch.branchId };
  const sales = useQuery({ queryKey: key('dashboard', { today: 'sales', day: today, ...scope }), queryFn: () => reportsApi.sales(today, today, 5, branch.scope), enabled: canSales });
  const purchases = useQuery({ queryKey: key('dashboard', { today: 'purchases', day: today, ...scope }), queryFn: () => reportsApi.purchaseSummary(today, today, undefined, branch.scope), enabled: canPurchases });
  const expenses = useQuery({ queryKey: key('dashboard', { today: 'expenses', day: today, ...scope }), queryFn: () => expensesApi.summary(today, today, branch.scope), enabled: canExpenses });
  const payables = useQuery({ queryKey: key('suppliers', { balances: true }), queryFn: () => suppliersApi.balances(), enabled: canPayables });
  const stock = useQuery({ queryKey: key('stock', { list: true, ...scope }), queryFn: () => stockApi.levels(false, branch.scope), enabled: canStock && canSales });

  if (!canSales && !canPurchases && !canExpenses && !canPayables) return null;

  const owed = payables.data?.reduce((sum, s) => sum + Math.max(0, s.outstandingBalance), 0);
  const suppliersOwed = payables.data?.filter((s) => s.outstandingBalance > 0).length ?? 0;
  // Not narrowed to a branch, /stock returns a row per product and branch: add them up.
  const sellers = (sales.data?.topProducts ?? []).map((p) => {
    const rows = stock.data?.filter((s) => s.productId === p.productId) ?? [];
    const level = rows.length
      ? {
          baseUnitSymbol: rows[0].baseUnitSymbol,
          quantityOnHand: rows.reduce((a, r) => a + r.quantityOnHand, 0),
          reserved: rows.reduce((a, r) => a + (r.reservedQuantity ?? 0), 0),
          belowReorderLevel: rows.some((r) => r.belowReorderLevel),
        }
      : null;
    return { ...p, level };
  });

  return (
    <section className="space-y-3" aria-labelledby="today-heading">
      <h2 id="today-heading" className="font-semibold">Today</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {canSales && <StatCard label="Today’s sales" value={sales.data ? formatMoney(sales.data.revenue) : '—'} hint={sales.data ? `${sales.data.saleCount} sale(s), excl. VAT` : undefined} icon={<TrendingUp />} />}
        {canPurchases && <StatCard label="Supplies received today" value={purchases.data ? formatMoney(purchases.data.receivedValue) : '—'} hint="At order cost" icon={<Truck />} />}
        {canExpenses && <StatCard label="Expenses today" value={expenses.data ? formatMoney(expenses.data.totalExpenses) : '—'} hint={expenses.data ? `${expenses.data.expenseCount} expense(s)` : undefined} icon={<Wallet />} />}
        {canPayables && (
          <StatCard
            label="Owed to suppliers"
            value={owed !== undefined ? formatMoney(owed) : '—'}
            hint={payables.data ? `${suppliersOwed} supplier(s), all branches` : undefined}
            icon={<PackageCheck />}
            tone={owed ? 'warning' : 'default'}
          />
        )}
      </div>
      {canSales && sellers.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Sold today and left in stock</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {sellers.map((p) => {
                const unit = p.level?.baseUnitSymbol ?? null;
                return (
                  <li key={p.productId} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                    <Package className="size-4 text-muted-foreground" aria-hidden />
                    <Link href={`/products/${p.productId}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{p.productName}</Link>
                    <span className="tabular">Sold <span className="font-semibold">{formatQty(p.quantitySoldInBaseUnits, unit)}</span></span>
                    {p.level && (
                      <span className="tabular">
                        In stock <span className="font-semibold">{formatQty(p.level.quantityOnHand, unit)}</span>
                        {p.level.reserved > 0 && <span className="text-muted-foreground"> ({formatQty(p.level.reserved, unit)} on delivery orders)</span>}
                        {p.level.quantityOnHand <= 0 ? <Badge variant="destructive" className="ml-2">Out</Badge> : p.level.belowReorderLevel && <Badge variant="warning" className="ml-2">Reorder</Badge>}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
