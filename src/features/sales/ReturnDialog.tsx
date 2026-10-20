'use client';

import { Fragment, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { Input, Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea } from '@/components/ui/primitives';
import { EnumSelect } from '@/components/shared/Pickers';
import { FormAlert } from '@/components/shared/States';
import { salesApi } from '@/api/endpoints/sales';
import { labels, PaymentMethod, RefundMethod } from '@/api/enums';
import { useApiMutation } from '@/hooks/useApiMutation';
import { formatMoney, formatQty } from '@/lib/format';
import { emptyToNull } from '@/lib/utils';
import type { SaleDto, SaleLineDto } from '@/api/dto/sales';

interface LineState { quantity: string; restock: boolean }

/** Returns part or all of a completed sale. A credit sale can only be refunded as a credit note. */
export function ReturnDialog({ sale, open, onOpenChange }: { sale: SaleDto; open: boolean; onOpenChange(o: boolean): void }) {
  const creditSale = sale.paymentMethod === PaymentMethod.Credit;
  const [lines, setLines] = useState<Record<string, LineState>>({});
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<RefundMethod>(creditSale ? RefundMethod.CreditNote : RefundMethod.Cash);
  const [reference, setReference] = useState('');
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!open) return;
    setLines(Object.fromEntries(sale.lines.map((l) => [l.saleLineId, { quantity: '', restock: true }])));
    setReason('');
    setReference('');
    setError(null);
    setRefundMethod(creditSale ? RefundMethod.CreditNote : RefundMethod.Cash);
  }, [open, sale, creditSale]);

  const mutation = useApiMutation(() => salesApi.createReturn(sale.saleId, {
    reason: reason.trim(),
    refundMethod,
    refundReference: emptyToNull(reference),
    lines: Object.entries(lines).filter(([, v]) => Number(v.quantity) > 0).map(([saleLineId, v]) => ({ saleLineId, quantity: Number(v.quantity), restock: v.restock })),
  }), {
    invalidate: ['sales', 'stock', 'customers', 'dashboard'],
    success: (r) => `Return ${r.returnNumber} recorded · ${formatMoney(r.totalAmount)}`,
    toastErrors: false,
    onSuccess: () => onOpenChange(false),
  });

  /** A line to return; a bundle's part is indented under its bundle. */
  const lineRow = (l: SaleLineDto, part = false) => {
              const left = l.quantity - l.quantityReturned;
              const state = lines[l.saleLineId] ?? { quantity: '', restock: true };
              return (
                <TableRow key={l.saleLineId}>
                  <TableCell className={part ? 'pl-8' : 'font-medium'}>{l.productName}</TableCell>
                  <TableCell className="text-right tabular">{l.quantity} {l.unitSymbol}</TableCell>
                  <TableCell className="text-right tabular">{left}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={left}
                        step="any"
                        disabled={left <= 0}
                        value={state.quantity}
                        onChange={(e) => setLines((s) => ({ ...s, [l.saleLineId]: { ...state, quantity: e.target.value } }))}
                        className="h-8 w-20"
                        aria-label={`Return quantity for ${l.productName}`}
                      />
                      <Button variant="ghost" size="sm" disabled={left <= 0} onClick={() => setLines((s) => ({ ...s, [l.saleLineId]: { ...state, quantity: String(left) } }))}>All</Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Checkbox checked={state.restock} onCheckedChange={(v) => setLines((s) => ({ ...s, [l.saleLineId]: { ...state, restock: v === true } }))} aria-label="Restock" />
                  </TableCell>
                </TableRow>
              );
  };

  function submit() {
    setError(null);
    const chosen = Object.values(lines).filter((v) => Number(v.quantity) > 0);
    if (chosen.length === 0) return setError(new Error('Enter a quantity to return on at least one line.'));
    for (const l of sale.lines) {
      const q = Number(lines[l.saleLineId]?.quantity || 0);
      if (q > l.quantity - l.quantityReturned) return setError(new Error(`Only ${l.quantity - l.quantityReturned} of ${l.productName} is left to return.`));
    }
    if (!reason.trim()) return setError(new Error('Give a reason for the return.'));
    mutation.mutate(undefined, { onError: setError });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Return items from {sale.saleNumber}</DialogTitle>
          <DialogDescription>The refund is worked out by the server from the price paid. Untick “Restock” for damaged or expired goods.</DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Product</TableHead><TableHead className="text-right">Sold</TableHead><TableHead className="text-right">Left</TableHead><TableHead>Return</TableHead><TableHead>Restock</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {sale.lines.filter((l) => !l.productBundleId).map((l) => lineRow(l))}
            {sale.bundles?.map((b) => {
              const parts = sale.lines.filter((l) => l.productBundleId === b.productBundleId);
              const anyLeft = parts.some((l) => l.quantity - l.quantityReturned > 0);
              return (
                <Fragment key={b.productBundleId}>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={3} className="font-medium">
                      {formatQty(b.quantity)} × {b.name}
                      <span className="block text-xs font-normal text-muted-foreground">Return a part on its own (a cracked bottle) or the whole bundle. Each part refunds its own share.</span>
                    </TableCell>
                    <TableCell colSpan={2}>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!anyLeft}
                        onClick={() => setLines((s) => ({
                          ...s,
                          ...Object.fromEntries(parts.map((l) => [l.saleLineId, { ...(s[l.saleLineId] ?? { restock: true }), quantity: String(l.quantity - l.quantityReturned) }])),
                        }))}
                      >
                        Return whole bundle
                      </Button>
                    </TableCell>
                  </TableRow>
                  {parts.map((l) => lineRow(l, true))}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Refund method</Label>
            <EnumSelect map={labels.refundMethod} value={refundMethod} onChange={(v) => v !== null && setRefundMethod(v)} disabled={creditSale} />
            {creditSale && <p className="text-xs text-muted-foreground">Credit sales are refunded to the customer’s account.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Refund reference</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={refundMethod === RefundMethod.Mpesa ? 'M-Pesa code' : 'Optional'} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Reason *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </div>
        </div>
        <FormAlert error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button>
          <Button loading={mutation.isPending} onClick={submit}>Record return</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
