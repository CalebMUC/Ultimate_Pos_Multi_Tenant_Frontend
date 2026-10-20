'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Ban, Boxes, Printer, RefreshCw, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DetailList, MoneyText, PageHeader, QuantityText, StatusBadge } from '@/components/shared/Display';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { salesApi } from '@/api/endpoints/sales';
import { labels, PaymentMethod, SaleStatus } from '@/api/enums';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateOnly, formatDateTime, formatMoney } from '@/lib/format';
import { ReceiptDialog } from '@/features/sales/Receipt';
import { ReturnDialog } from '@/features/sales/ReturnDialog';
import { WithActivityTab } from '@/features/audit/WithActivityTab';
import type { SaleLineDto } from '@/api/dto/sales';

function SaleDetail({ id }: { id: string }) {
  const key = useQueryKey();
  const sale = useQuery({ queryKey: key('sales', { id }), queryFn: () => salesApi.get(id) });
  const returns = useQuery({ queryKey: key('sales', { id, returns: true }), queryFn: () => salesApi.returnsForSale(id) });
  const [voiding, setVoiding] = useState(false);
  const [returning, setReturning] = useState(false);
  const [printing, setPrinting] = useState(false);
  const voidSale = useApiMutation(() => salesApi.void(id), { invalidate: ['sales', 'stock', 'customers', 'dashboard'], success: 'Sale voided', toastErrors: false });
  const reconcile = useApiMutation(() => salesApi.reconcileMpesa(id), {
    invalidate: ['sales'],
    success: (s) => (s.status === SaleStatus.Pending ? 'Still waiting for M-Pesa' : `Sale is ${labels.saleStatus[s.status].toLowerCase()}`),
  });

  if (sale.isLoading) return <LoadingState />;
  if (sale.error || !sale.data) return <ErrorState error={sale.error} onRetry={() => sale.refetch()} />;
  const s = sale.data;
  const returnable = s.status === SaleStatus.Completed && s.lines.some((l) => l.quantity - l.quantityReturned > 0);
  /** A sale line; a bundle's part is indented under its bundle row. */
  const lineRow = (l: SaleLineDto, part = false) => (
                  <TableRow key={l.saleLineId} className={part ? 'text-muted-foreground' : undefined}>
                    <TableCell className={part ? 'pl-8' : undefined}>
                      <span className={part ? undefined : 'font-medium'}>{l.productName}</span>
                      {l.sku && <span className="block text-xs text-muted-foreground">{l.sku}</span>}
                      {l.batches?.map((b) => (
                        <span key={b.stockBatchId} className="block text-xs text-muted-foreground">
                          Batch {b.batchNumber}{b.expiryDate ? ` · exp ${formatDateOnly(b.expiryDate)}` : ''} · {b.quantityInBaseUnits}
                        </span>
                      ))}
                      {l.quantityReturned > 0 && <span className="block text-xs text-warning">{l.quantityReturned} returned</span>}
                    </TableCell>
                    <TableCell className="text-right"><QuantityText value={l.quantity} unit={l.unitSymbol} /></TableCell>
                    <TableCell className="text-right"><MoneyText value={l.unitPrice} currency={false} /></TableCell>
                    <TableCell className="text-right"><MoneyText value={l.discountAmount} currency={false} /></TableCell>
                    <TableCell className="text-right"><MoneyText value={l.taxAmount} currency={false} /></TableCell>
                    <TableCell className="text-right font-medium"><MoneyText value={l.lineTotal} currency={false} /></TableCell>
                  </TableRow>
  );

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2">Sale {s.saleNumber} <StatusBadge kind="sale" value={s.status} /></span>}
        description={formatDateTime(s.createdAt)}
        actions={
          <>
            <Button variant="ghost" asChild><Link href="/sales"><ArrowLeft />Sales</Link></Button>
            <Button variant="outline" onClick={() => setPrinting(true)}><Printer />Receipt</Button>
            {s.status === SaleStatus.Pending && s.paymentMethod === PaymentMethod.MpesaStkPush && (
              <Button variant="outline" loading={reconcile.isPending} onClick={() => reconcile.mutate(undefined)}><RefreshCw />Check with M-Pesa</Button>
            )}
            {returnable && (
              <Can permission="Sales.Return"><Button variant="outline" onClick={() => setReturning(true)}><Undo2 />Return items</Button></Can>
            )}
            {s.status === SaleStatus.Completed && s.returnedAmount === 0 && (
              <Can permission="Sales.Void"><Button variant="destructive" onClick={() => setVoiding(true)}><Ban />Void</Button></Can>
            )}
          </>
        }
      />
      <WithActivityTab entityType="Sale" entityId={id}>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Items</CardTitle></CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">VAT</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.lines.filter((l) => !l.productBundleId).map((l) => lineRow(l))}
                {s.bundles?.map((b) => (
                  <Fragment key={b.productBundleId}>
                    <TableRow>
                      <TableCell><span className="flex items-center gap-1.5 font-medium"><Boxes className="size-3.5 text-muted-foreground" aria-hidden />{b.name}</span></TableCell>
                      <TableCell className="text-right"><QuantityText value={b.quantity} /></TableCell>
                      <TableCell />
                      <TableCell className="text-right"><MoneyText value={b.discountAmount} currency={false} /></TableCell>
                      <TableCell />
                      <TableCell className="text-right font-medium"><MoneyText value={b.total} currency={false} /></TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={6} className="py-1 pl-8 text-xs font-medium uppercase tracking-wide text-muted-foreground">Parts</TableCell>
                    </TableRow>
                    {s.lines.filter((l) => l.productBundleId === b.productBundleId).map((l) => lineRow(l, true))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent>
              <DetailList
                columns={1}
                items={[
                  ...(s.kraBranchId ? [{ label: 'Branch', value: `${s.kraBranchId} · ${s.branchName ?? ''}` }] : []),
                  { label: 'Customer', value: s.customerId ? <Link className="text-primary hover:underline" href={`/customers/${s.customerId}`}>{s.customerName}</Link> : 'Walk-in' },
                  { label: 'Payment', value: labels.paymentMethod[s.paymentMethod] },
                  { label: 'Cashier', value: s.createdByName },
                  { label: 'Subtotal', value: formatMoney(s.subtotal) },
                  { label: 'Discount', value: formatMoney(s.discountTotal) },
                  { label: 'VAT (included)', value: formatMoney(s.taxTotal) },
                  { label: 'Total', value: <span className="text-lg font-semibold">{formatMoney(s.totalAmount)}</span> },
                  ...(s.amountTendered !== null ? [{ label: 'Tendered / change', value: `${formatMoney(s.amountTendered)} / ${formatMoney(s.changeDue)}` }] : []),
                  ...(s.returnedAmount > 0 ? [{ label: 'Returned', value: formatMoney(s.returnedAmount) }] : []),
                  ...(s.notes ? [{ label: 'Notes', value: s.notes }] : []),
                ]}
              />
            </CardContent>
          </Card>
          {s.prescription && (
            <Card>
              <CardHeader><CardTitle>Prescription</CardTitle></CardHeader>
              <CardContent>
                <DetailList
                  columns={1}
                  items={[
                    { label: 'Patient', value: [s.prescription.patientName, s.prescription.patientAgeYears ? `${s.prescription.patientAgeYears} yrs` : null, s.prescription.patientPhoneNumber].filter(Boolean).join(' · ') },
                    { label: 'Prescriber', value: [s.prescription.prescriberName, s.prescription.prescriberRegistrationNumber, s.prescription.prescriberFacility].filter(Boolean).join(' · ') },
                    { label: 'Prescription', value: [s.prescription.prescriptionNumber, formatDateOnly(s.prescription.prescriptionDate)].filter(Boolean).join(' · ') },
                    ...(s.prescription.notes ? [{ label: 'Notes', value: s.prescription.notes }] : []),
                  ]}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {(returns.data?.length ?? 0) > 0 && (
        <Card className="mt-4">
          <CardHeader><CardTitle>Returns</CardTitle></CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Return</TableHead><TableHead>Date</TableHead><TableHead>Reason</TableHead><TableHead>Refund</TableHead><TableHead>Items</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {returns.data!.map((r) => (
                  <TableRow key={r.saleReturnId}>
                    <TableCell className="font-medium">{r.returnNumber}</TableCell>
                    <TableCell>{formatDateTime(r.createdAt)}</TableCell>
                    <TableCell>{r.reason}</TableCell>
                    <TableCell>{labels.refundMethod[r.refundMethod]}{r.refundReference ? ` · ${r.refundReference}` : ''}</TableCell>
                    <TableCell className="text-xs">{r.lines.map((l) => `${l.productName} × ${l.quantity}${l.restock ? '' : ' (not restocked)'}`).join(', ')}</TableCell>
                    <TableCell className="text-right"><MoneyText value={r.totalAmount} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      </WithActivityTab>
      <ConfirmDialog
        open={voiding}
        onOpenChange={setVoiding}
        title={`Void sale ${s.saleNumber}?`}
        description="Stock goes back on hand and, for a credit sale, the customer’s balance is reversed. This cannot be undone."
        confirmLabel="Void sale"
        destructive
        onConfirm={async () => {
          try {
            await voidSale.mutateAsync(undefined);
          } catch (e) {
            // Someone else may have voided it a moment ago: reload, and if so there is nothing left to do.
            const fresh = await sale.refetch();
            if (fresh.data?.status === SaleStatus.Voided) {
              toast.info(`Sale ${s.saleNumber} was already voided.`);
              return;
            }
            throw e;
          }
        }}
      />
      <ReturnDialog sale={s} open={returning} onOpenChange={setReturning} />
      <ReceiptDialog sale={s} open={printing} onOpenChange={setPrinting} />
    </>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <PermissionRoute permission="Sales.View"><SaleDetail id={id} /></PermissionRoute>;
}
