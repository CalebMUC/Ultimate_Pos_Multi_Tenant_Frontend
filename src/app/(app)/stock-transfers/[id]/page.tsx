'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Ban, PackageCheck, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DetailList, MoneyText, PageHeader } from '@/components/shared/Display';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { stockTransfersApi } from '@/api/endpoints/branches';
import { StockTransferStatus } from '@/api/enums';
import { usePermissions, useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateOnly, formatDateTime, formatQty } from '@/lib/format';
import { useCanSeeBranch } from '@/features/branches/branches';
import { ActivityTimeline } from '@/features/audit/ActivityTimeline';
import { ReceiveTransferDialog } from '@/features/transfers/ReceiveTransferDialog';
import { TransferRoute, TransferStatusBadge, TransferStatusBar } from '@/features/transfers/TransferParts';

function TransferDetail({ id }: { id: string }) {
  const key = useQueryKey();
  const qc = useQueryClient();
  const can = usePermissions();
  const canSee = useCanSeeBranch();
  const transfer = useQuery({ queryKey: key('stock-transfers', { id }), queryFn: () => stockTransfersApi.get(id) });
  const [confirm, setConfirm] = useState<'dispatch' | 'cancel' | null>(null);
  const [receiving, setReceiving] = useState(false);

  if (transfer.isLoading) return <LoadingState />;
  if (transfer.error || !transfer.data) return <ErrorState error={transfer.error} onRetry={() => transfer.refetch()} />;
  const t = transfer.data;
  const showCost = can('Costing.View');
  // Acting needs the permission and the branch: dispatch from a branch you work at, receive at one you work at.
  const canDispatch = t.status === StockTransferStatus.Draft && can('StockTransfers.Dispatch') && canSee(t.fromBranchId);
  const canCancel = t.status === StockTransferStatus.Draft && can('StockTransfers.Create') && canSee(t.fromBranchId);
  const canReceive = t.status === StockTransferStatus.Dispatched && can('StockTransfers.Receive') && canSee(t.toBranchId);
  const received = t.status === StockTransferStatus.Received;
  const shortLines = t.lines.filter((l) => l.shortageInBaseUnits > 0);
  const refresh = () => Promise.all(['stock-transfers', 'stock', 'dashboard'].map((r) => qc.invalidateQueries({ queryKey: [r] })));

  return (
    <>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-2">{t.transferNumber} <TransferStatusBadge status={t.status} /></span>}
        description={<TransferRoute t={t} />}
        actions={
          <>
            <Button variant="ghost" asChild><Link href="/stock-transfers"><ArrowLeft />Transfers</Link></Button>
            {canCancel && <Button variant="outline" onClick={() => setConfirm('cancel')}><Ban />Cancel draft</Button>}
            {canDispatch && <Button onClick={() => setConfirm('dispatch')}><Truck />Dispatch</Button>}
            {canReceive && <Button onClick={() => setReceiving(true)}><PackageCheck />Receive</Button>}
          </>
        }
      />
      <div className="space-y-4">
        <TransferStatusBar t={t} />
        {t.status === StockTransferStatus.Dispatched && !canReceive && (
          <Alert variant="info"><AlertDescription>In transit. It is received by staff at {t.toKraBranchId} · {t.toBranchName}.</AlertDescription></Alert>
        )}
        {received && shortLines.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              {shortLines.length} line{shortLines.length === 1 ? '' : 's'} arrived short{showCost && t.shortageValue != null ? <>, worth <MoneyText value={t.shortageValue} /></> : ''}.{t.receiveNotes ? ` Note: ${t.receiveNotes}` : ''}
            </AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="overflow-hidden lg:col-span-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  {received && <TableHead className="text-right">Short</TableHead>}
                  {showCost && <TableHead className="text-right">Unit cost</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {t.lines.map((l) => (
                  <Fragment key={l.stockTransferLineId}>
                    <TableRow className={l.shortageInBaseUnits > 0 ? 'bg-destructive/5' : undefined}>
                      <TableCell><span className="font-medium">{l.productName}</span><span className="block text-xs text-muted-foreground">{l.sku}</span></TableCell>
                      <TableCell className="text-right tabular">{formatQty(l.quantity, l.unitSymbol)}<span className="block text-xs text-muted-foreground">{formatQty(l.quantityInBaseUnits)} base</span></TableCell>
                      <TableCell className="text-right tabular">{l.quantityReceivedInBaseUnits == null ? '—' : formatQty(l.quantityReceivedInBaseUnits)}</TableCell>
                      {received && <TableCell className={`text-right tabular ${l.shortageInBaseUnits > 0 ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>{l.shortageInBaseUnits > 0 ? formatQty(l.shortageInBaseUnits) : '—'}</TableCell>}
                      {showCost && <TableCell className="text-right"><MoneyText value={l.unitCost} currency={false} /></TableCell>}
                    </TableRow>
                    {/* Batch-tracked lines: the lots dispatched FEFO; the same lots, with the same expiry, arrive. */}
                    {l.batches.length > 0 && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={received ? (showCost ? 5 : 4) : (showCost ? 4 : 3)} className="pt-0">
                          <ul className="flex flex-wrap gap-1.5 text-xs">
                            {l.batches.map((b) => (
                              <li key={b.batchNumber} className="rounded border bg-muted/40 px-2 py-0.5">
                                Lot <span className="font-medium">{b.batchNumber}</span>{b.expiryDate ? ` · exp ${formatDateOnly(b.expiryDate)}` : ''} · {formatQty(b.quantityInBaseUnits)}
                                {b.quantityReceivedInBaseUnits != null && b.quantityReceivedInBaseUnits !== b.quantityInBaseUnits && <span className="text-destructive"> · {formatQty(b.quantityReceivedInBaseUnits)} arrived</span>}
                              </li>
                            ))}
                          </ul>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Details</CardTitle></CardHeader>
              <CardContent>
                <DetailList
                  columns={1}
                  items={[
                    { label: 'From', value: `${t.fromKraBranchId} · ${t.fromBranchName}` },
                    { label: 'To', value: `${t.toKraBranchId} · ${t.toBranchName}` },
                    { label: 'Created', value: formatDateTime(t.createdAt) },
                    { label: 'Dispatched', value: t.dispatchedAt ? formatDateTime(t.dispatchedAt) : '—' },
                    { label: 'Received', value: t.receivedAt ? formatDateTime(t.receivedAt) : '—' },
                    ...(showCost ? [{ label: 'Value dispatched', value: <MoneyText value={t.dispatchedValue} /> }] : []),
                    ...(t.notes ? [{ label: 'Notes', value: t.notes }] : []),
                    ...(t.receiveNotes ? [{ label: 'Receiving notes', value: t.receiveNotes }] : []),
                  ]}
                />
              </CardContent>
            </Card>
            {can('AuditLog.View') && (
              <Card>
                <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
                <CardContent><ActivityTimeline entityType="StockTransfer" entityId={id} /></CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'dispatch'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Dispatch ${t.transferNumber}?`}
        description={`The stock leaves ${t.fromKraBranchId} · ${t.fromBranchName} now and is in transit until ${t.toBranchName} receives it. Batch-tracked items go first-expiry-first-out. A dispatched transfer can’t be cancelled.`}
        confirmLabel="Dispatch"
        // INSUFFICIENT_STOCK (409) shows here and the draft stays.
        onConfirm={async () => { await stockTransfersApi.dispatch(id); await refresh(); toast.success(`${t.transferNumber} dispatched`); }}
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Cancel ${t.transferNumber}?`}
        description="It is a draft: nothing has moved. It stays on record as cancelled."
        confirmLabel="Cancel transfer"
        destructive
        onConfirm={async () => { await stockTransfersApi.cancel(id); await refresh(); toast.success('Transfer cancelled'); }}
      />
      <ReceiveTransferDialog transfer={t} open={receiving} onOpenChange={setReceiving} onReceived={(r) => qc.setQueryData(key('stock-transfers', { id }), r)} />
    </>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <PermissionRoute permission="StockTransfers.View"><TransferDetail id={id} /></PermissionRoute>;
}
