'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { Input, Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea } from '@/components/ui/primitives';
import { FormAlert } from '@/components/shared/States';
import { stockTransfersApi } from '@/api/endpoints/branches';
import { formatQty } from '@/lib/format';
import { emptyToNull } from '@/lib/utils';
import type { StockTransferDto } from '@/api/dto/branches';

/** What arrived, per line, in the line's own unit. Every line starts at the full quantity: only short deliveries are edited. */
export function ReceiveTransferDialog({ transfer, open, onOpenChange, onReceived }: {
  transfer: StockTransferDto;
  open: boolean;
  onOpenChange(o: boolean): void;
  onReceived(t: StockTransferDto): void;
}) {
  const qc = useQueryClient();
  const [received, setReceived] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!open) return;
    setReceived(Object.fromEntries(transfer.lines.map((l) => [l.stockTransferLineId, String(l.quantity)])));
    setNotes('');
    setError(null);
  }, [open, transfer]);

  const short = transfer.lines.filter((l) => Number(received[l.stockTransferLineId] ?? l.quantity) < l.quantity);

  async function submit() {
    setError(null);
    for (const l of transfer.lines) {
      const q = Number(received[l.stockTransferLineId]);
      if (received[l.stockTransferLineId] === '' || Number.isNaN(q) || q < 0) return setError(new Error(`Enter what arrived of ${l.productName} (0 if nothing).`));
      if (q > l.quantity) return setError(new Error(`More ${l.productName} can’t arrive than was sent (${l.quantity}).`));
    }
    setPending(true);
    try {
      // Only the short lines need sending: the rest arrived in full.
      const lines = transfer.lines
        .filter((l) => Number(received[l.stockTransferLineId]) !== l.quantity)
        .map((l) => ({ stockTransferLineId: l.stockTransferLineId, quantityReceived: Number(received[l.stockTransferLineId]) }));
      const t = await stockTransfersApi.receive(transfer.stockTransferId, { lines: lines.length ? lines : null, notes: emptyToNull(notes) });
      await Promise.all(['stock-transfers', 'stock', 'dashboard'].map((r) => qc.invalidateQueries({ queryKey: [r] })));
      toast.success(`${t.transferNumber} received${t.lines.some((l) => l.shortageInBaseUnits > 0) ? ' with shortages' : ''}`);
      onReceived(t);
      onOpenChange(false);
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Receive {transfer.transferNumber}</DialogTitle>
          <DialogDescription>Check what arrived. Change a quantity only if the delivery was short; the stock goes into this branch at the sending branch’s cost.</DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Product</TableHead><TableHead className="text-right">Sent</TableHead><TableHead className="text-right">Received</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {transfer.lines.map((l) => {
              const value = received[l.stockTransferLineId] ?? '';
              const isShort = value !== '' && Number(value) < l.quantity;
              return (
                <TableRow key={l.stockTransferLineId} className={isShort ? 'bg-destructive/5' : undefined}>
                  <TableCell>
                    <span className="font-medium">{l.productName}</span>
                    {l.batches.length > 0 && <span className="block text-xs text-muted-foreground">{l.batches.map((b) => b.batchNumber).join(', ')}</span>}
                  </TableCell>
                  <TableCell className="text-right tabular">{formatQty(l.quantity, l.unitSymbol)}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={0}
                      max={l.quantity}
                      step="any"
                      value={value}
                      onChange={(e) => setReceived((r) => ({ ...r, [l.stockTransferLineId]: e.target.value }))}
                      className={`ml-auto h-8 w-24 text-right ${isShort ? 'border-destructive text-destructive' : ''}`}
                      aria-label={`Received of ${l.productName}`}
                    />
                    {isShort && <span className="mt-0.5 block text-xs text-destructive">Short {formatQty(l.quantity - Number(value), l.unitSymbol)}</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="space-y-1.5">
          <Label htmlFor="receive-notes">Notes{short.length ? ' (what happened to the missing stock?)' : ''}</Label>
          <Textarea id="receive-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <FormAlert error={error} />
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={pending} onClick={submit}>{short.length ? `Receive with ${short.length} short line${short.length === 1 ? '' : 's'}` : 'Receive everything'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
