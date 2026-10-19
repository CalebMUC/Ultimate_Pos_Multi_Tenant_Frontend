'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Ban, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DetailList, MoneyText, PageHeader, ProductFlags, QuantityText, StatusBadge } from '@/components/shared/Display';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { purchaseOrdersApi } from '@/api/endpoints/inventory';
import { PurchaseOrderStatus } from '@/api/enums';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDate } from '@/lib/format';
import { ReceiveDialog } from '@/features/purchasing/ReceiveDialog';
import { WithActivityTab } from '@/features/audit/WithActivityTab';
import { orderValue } from '@/features/purchasing/orderValue';
import { useCanSeeBranch } from '@/features/branches/branches';

function PurchaseOrderDetail({ id }: { id: string }) {
  const key = useQueryKey();
  const canSee = useCanSeeBranch();
  const order = useQuery({ queryKey: key('purchase-orders', { id }), queryFn: () => purchaseOrdersApi.get(id) });
  const [cancelling, setCancelling] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const cancel = useApiMutation(() => purchaseOrdersApi.cancel(id), { invalidate: ['purchase-orders'], success: 'Order cancelled', toastErrors: false });

  if (order.isLoading) return <LoadingState />;
  if (order.error || !order.data) return <ErrorState error={order.error} onRetry={() => order.refetch()} />;
  const po = order.data;
  // Goods are received into the delivery branch's stock: only its staff (and managers) can receive.
  const canReceiveHere = !po.branchId || canSee(po.branchId);
  const open = po.status === PurchaseOrderStatus.Ordered || po.status === PurchaseOrderStatus.PartiallyReceived || po.status === PurchaseOrderStatus.Draft;
  const cancellable = po.status === PurchaseOrderStatus.Ordered || po.status === PurchaseOrderStatus.Draft;

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2">Order {po.orderNumber} <StatusBadge kind="purchaseOrder" value={po.status} /></span>}
        description={po.supplierName ?? undefined}
        actions={
          <>
            <Button variant="ghost" asChild><Link href="/purchase-orders"><ArrowLeft />Purchase orders</Link></Button>
            {open && canReceiveHere && <Can permission="PurchaseOrders.Receive"><Button onClick={() => setReceiving(true)}><PackageCheck />Receive</Button></Can>}
            {cancellable && <Can permission="PurchaseOrders.Cancel"><Button variant="destructive" onClick={() => setCancelling(true)}><Ban />Cancel order</Button></Can>}
          </>
        }
      />
      <WithActivityTab entityType="PurchaseOrder" entityId={id}>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.lines.map((l) => (
                <TableRow key={l.purchaseOrderLineId}>
                  <TableCell>
                    <span className="flex items-center gap-2 font-medium">{l.productName}<ProductFlags isBatchTracked={l.isBatchTracked} /></span>
                    <span className="text-xs text-muted-foreground">{l.sku}</span>
                  </TableCell>
                  <TableCell className="text-right"><QuantityText value={l.quantityOrdered} unit={l.unitSymbol} /></TableCell>
                  <TableCell className={`text-right ${l.quantityReceived >= l.quantityOrdered ? 'text-success' : l.quantityReceived > 0 ? 'text-warning' : ''}`}>
                    <QuantityText value={l.quantityReceived} unit={l.unitSymbol} />
                  </TableCell>
                  <TableCell className="text-right"><MoneyText value={l.unitCost} currency={false} /></TableCell>
                  <TableCell className="text-right"><MoneyText value={l.quantityOrdered * l.unitCost} currency={false} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow><TableCell colSpan={4} className="text-right">Total</TableCell><TableCell className="text-right"><MoneyText value={orderValue(po)} /></TableCell></TableRow>
            </TableFooter>
          </Table>
        </Card>
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent>
            <DetailList
              columns={1}
              items={[
                ...(po.kraBranchId ? [{ label: 'Deliver to', value: `${po.kraBranchId} · ${po.branchName ?? ''}` }] : []),
                { label: 'Supplier', value: <Link className="text-primary hover:underline" href={`/suppliers/${po.supplierId}`}>{po.supplierName}</Link> },
                { label: 'Order date', value: formatDate(po.orderDate) },
                { label: 'Expected delivery', value: formatDate(po.expectedDeliveryDate) },
                { label: 'Notes', value: po.notes },
              ]}
            />
          </CardContent>
        </Card>
      </div>
      </WithActivityTab>
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Cancel order ${po.orderNumber}?`}
        description="The order can’t be received after this."
        confirmLabel="Cancel order"
        destructive
        onConfirm={() => cancel.mutateAsync(undefined)}
      />
      <ReceiveDialog order={po} open={receiving} onOpenChange={setReceiving} />
    </>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <PermissionRoute permission="PurchaseOrders.View"><PurchaseOrderDetail id={id} /></PermissionRoute>;
}
