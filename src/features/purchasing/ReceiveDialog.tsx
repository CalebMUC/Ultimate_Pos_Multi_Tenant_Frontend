'use client';

import { useEffect, useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { Input, Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea } from '@/components/ui/primitives';
import { ProductFlags } from '@/components/shared/Display';
import { FormAlert } from '@/components/shared/States';
import { purchaseOrdersApi } from '@/api/endpoints/inventory';
import { PurchaseOrderStatus } from '@/api/enums';
import { useApiMutation } from '@/hooks/useApiMutation';
import { formatQty } from '@/lib/format';
import { emptyToNull } from '@/lib/utils';
import type { PurchaseOrderDto } from '@/api/dto/inventory';

interface Row { key: string; lineId: string; quantity: string; batchNumber: string; expiryDate: string; manufactureDate: string }

let seq = 0;
const row = (lineId: string, quantity = ''): Row => ({ key: `r${++seq}`, lineId, quantity, batchNumber: '', expiryDate: '', manufactureDate: '' });

/** Receives stock against an order. A batch-tracked line can be split into several batches. */
export function ReceiveDialog({ order, open, onOpenChange }: { order: PurchaseOrderDto; open: boolean; onOpenChange(o: boolean): void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [invoice, setInvoice] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!open) return;
    // Pre-fill the outstanding quantity on every open line.
    setRows(order.lines.filter((l) => l.quantityReceived < l.quantityOrdered).map((l) => row(l.purchaseOrderLineId, String(l.quantityOrdered - l.quantityReceived))));
    setInvoice('');
    setNotes('');
    setError(null);
  }, [open, order]);

  const mutation = useApiMutation(() => purchaseOrdersApi.receive(order.purchaseOrderId, {
    supplierInvoiceNumber: emptyToNull(invoice),
    notes: emptyToNull(notes),
    lines: rows.filter((r) => Number(r.quantity) > 0).map((r) => {
      const line = order.lines.find((l) => l.purchaseOrderLineId === r.lineId)!;
      return {
        purchaseOrderLineId: r.lineId,
        quantityReceived: Number(r.quantity),
        ...(line.isBatchTracked ? { batchNumber: r.batchNumber.trim(), expiryDate: r.expiryDate || null, manufactureDate: r.manufactureDate || null } : {}),
      };
    }),
  }), {
    invalidate: ['purchase-orders', 'stock', 'suppliers', 'dashboard'],
    success: (po) => `Stock received. Order is now ${po.status === PurchaseOrderStatus.Received ? 'fully received' : 'partly received'}.`,
    toastErrors: false,
    onSuccess: () => onOpenChange(false),
  });

  const set = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function submit() {
    setError(null);
    const chosen = rows.filter((r) => Number(r.quantity) > 0);
    if (chosen.length === 0) return setError(new Error('Enter a quantity on at least one line.'));
    for (const l of order.lines) {
      const total = rows.filter((r) => r.lineId === l.purchaseOrderLineId).reduce((a, r) => a + (Number(r.quantity) || 0), 0);
      if (total > l.quantityOrdered - l.quantityReceived) return setError(new Error(`${l.productName}: only ${l.quantityOrdered - l.quantityReceived} is still to come.`));
      if (l.isBatchTracked && rows.some((r) => r.lineId === l.purchaseOrderLineId && Number(r.quantity) > 0 && (!r.batchNumber.trim() || !r.expiryDate))) {
        return setError(new Error(`${l.productName} is batch-tracked: give each batch a number and expiry date.`));
      }
    }
    mutation.mutate(undefined, { onError: setError });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>Receive {order.orderNumber}</DialogTitle>
          <DialogDescription>Enter what arrived. Anything left stays on order. The supplier is billed for what you receive.</DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead>Receive</TableHead>
              <TableHead>Batch no.</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Manufactured</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => {
              const l = order.lines.find((x) => x.purchaseOrderLineId === r.lineId)!;
              const first = rows.findIndex((x) => x.lineId === r.lineId) === i;
              return (
                <TableRow key={r.key}>
                  <TableCell>
                    {first ? <span className="flex items-center gap-2 font-medium">{l.productName}<ProductFlags isBatchTracked={l.isBatchTracked} /></span> : <span className="pl-4 text-xs text-muted-foreground">another batch</span>}
                  </TableCell>
                  <TableCell className="text-right tabular">{first ? formatQty(l.quantityOrdered - l.quantityReceived, l.unitSymbol) : ''}</TableCell>
                  <TableCell><Input type="number" step="any" min={0} value={r.quantity} onChange={(e) => set(r.key, { quantity: e.target.value })} className="h-8 w-24" aria-label="Quantity received" /></TableCell>
                  {l.isBatchTracked ? (
                    <>
                      <TableCell><Input value={r.batchNumber} onChange={(e) => set(r.key, { batchNumber: e.target.value })} className="h-8 w-32" aria-label="Batch number" /></TableCell>
                      <TableCell><Input type="date" value={r.expiryDate} onChange={(e) => set(r.key, { expiryDate: e.target.value })} className="h-8 w-36" aria-label="Expiry date" /></TableCell>
                      <TableCell><Input type="date" value={r.manufactureDate} onChange={(e) => set(r.key, { manufactureDate: e.target.value })} className="h-8 w-36" aria-label="Manufacture date" /></TableCell>
                    </>
                  ) : (
                    <TableCell colSpan={3} className="text-xs text-muted-foreground">Not batch-tracked</TableCell>
                  )}
                  <TableCell>
                    {l.isBatchTracked && first && (
                      <Button variant="ghost" size="icon-sm" title="Split into another batch" onClick={() => setRows((rs) => [...rs.slice(0, i + 1), row(l.purchaseOrderLineId), ...rs.slice(i + 1)])}><Copy /></Button>
                    )}
                    {!first && <Button variant="ghost" size="icon-sm" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Remove batch"><Trash2 /></Button>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Supplier invoice no.</Label><Input value={invoice} onChange={(e) => setInvoice(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-9" /></div>
        </div>
        <FormAlert error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button>
          <Button loading={mutation.isPending} onClick={submit}>Receive stock</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
