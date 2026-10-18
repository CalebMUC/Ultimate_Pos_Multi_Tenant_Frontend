'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { MoneyText, PageHeader, StatCard } from '@/components/shared/Display';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { formulasApi, productionApi } from '@/api/endpoints/other';
import { humanize } from '@/api/mappers';
import { unitSymbol, useUnits } from '@/hooks/useLookups';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateTime, formatMoney, formatPercent, formatQty } from '@/lib/format';

function RunDetail({ id }: { id: string }) {
  const key = useQueryKey();
  const units = useUnits();
  const run = useQuery({ queryKey: key('production-runs', { id }), queryFn: () => productionApi.get(id) });
  // Run inputs carry only ids; the formula version used has the ingredient names.
  const formula = useQuery({ queryKey: key('formulas', { id: run.data?.formulaId }), queryFn: () => formulasApi.get(run.data!.formulaId), enabled: !!run.data });
  if (run.isLoading) return <LoadingState />;
  if (run.error || !run.data) return <ErrorState error={run.error} onRetry={() => run.refetch()} />;
  const r = run.data;
  const names = new Map(formula.data?.lines.map((l) => [l.ingredientProductId, l.ingredientName]) ?? []);
  const sym = (uid: string) => unitSymbol(units.data, uid);
  return (
    <>
      <PageHeader
        title={`Run ${r.runNumber}`}
        description={`${r.productName} · formula v${r.formulaVersion} · ${formatDateTime(r.createdAt)}`}
        actions={<Button variant="ghost" asChild><Link href="/production/runs"><ArrowLeft />Production runs</Link></Button>}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Produced" value={formatQty(r.quantityProduced, sym(r.unitOfMeasureId))} hint={`Planned ${formatQty(r.quantityPlanned)}`} />
        <StatCard label="Yield" value={formatPercent(r.yieldPercentage)} tone={r.yieldPercentage < 95 ? 'warning' : 'success'} />
        <StatCard label="Total cost" value={formatMoney(r.totalCost)} hint={`Materials ${formatMoney(r.materialCost)} + other ${formatMoney(r.additionalCost)}`} />
        <StatCard label="Cost per unit" value={formatMoney(r.costPerUnit)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader><CardTitle>Materials consumed</CardTitle></CardHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Ingredient</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Unit cost</TableHead><TableHead className="text-right">Cost</TableHead></TableRow></TableHeader>
            <TableBody>
              {r.inputs.map((i) => (
                <TableRow key={i.ingredientProductId}>
                  <TableCell><Link className="font-medium hover:underline" href={`/products/${i.ingredientProductId}`}>{names.get(i.ingredientProductId) ?? 'Ingredient'}</Link></TableCell>
                  <TableCell className="text-right tabular">{formatQty(i.quantityConsumed, sym(i.unitOfMeasureId))}</TableCell>
                  <TableCell className="text-right"><MoneyText value={i.unitCostPerBaseUnit} currency={false} /></TableCell>
                  <TableCell className="text-right"><MoneyText value={i.totalCost} currency={false} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <div className="space-y-4">
          {r.additionalCosts.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Other costs</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y text-sm">
                  {r.additionalCosts.map((c, idx) => (
                    <li key={idx} className="flex justify-between gap-2 py-1.5">
                      <span>{humanize(c.costType)}{c.description ? <span className="text-muted-foreground"> · {c.description}</span> : null}</span>
                      <MoneyText value={c.amount} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {r.notes && <Card><CardHeader><CardTitle>Notes</CardTitle></CardHeader><CardContent className="text-sm">{r.notes}</CardContent></Card>}
        </div>
      </div>
    </>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <PermissionRoute permission="Production.View" requires="production"><RunDetail id={id} /></PermissionRoute>;
}
