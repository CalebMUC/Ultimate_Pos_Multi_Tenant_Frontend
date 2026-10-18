'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Copy, Factory, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DetailList, PageHeader, StatusBadge } from '@/components/shared/Display';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { formulasApi } from '@/api/endpoints/other';
import { useApiMutation } from '@/hooks/useApiMutation';
import { unitSymbol, useUnits } from '@/hooks/useLookups';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateTime, formatQty } from '@/lib/format';

function FormulaDetail({ id }: { id: string }) {
  const key = useQueryKey();
  const units = useUnits();
  const formula = useQuery({ queryKey: key('formulas', { id }), queryFn: () => formulasApi.get(id) });
  const [deactivating, setDeactivating] = useState(false);
  const deactivate = useApiMutation(() => formulasApi.deactivate(id), { invalidate: ['formulas'], success: 'Formula deactivated', toastErrors: false });

  if (formula.isLoading) return <LoadingState />;
  if (formula.error || !formula.data) return <ErrorState error={formula.error} onRetry={() => formula.refetch()} />;
  const f = formula.data;

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2">{f.productName} · v{f.versionNumber} <StatusBadge kind="active" value={f.isActive} /></span>}
        description={`Makes ${formatQty(f.outputQuantity, unitSymbol(units.data, f.outputUnitOfMeasureId))} per batch`}
        actions={
          <>
            <Button variant="ghost" asChild><Link href="/production/formulas"><ArrowLeft />Formulas</Link></Button>
            {f.isActive && <Can permission="Production.Run"><Button asChild><Link href={`/production/runs/new?formulaId=${id}`}><Factory />Run production</Link></Button></Can>}
            <Can permission="Formulas.Create"><Button variant="outline" asChild><Link href={`/production/formulas/new?productId=${f.productId}`}><Copy />New version</Link></Button></Can>
            {f.isActive && <Can permission="Formulas.Deactivate"><Button variant="outline" onClick={() => setDeactivating(true)}><PowerOff />Deactivate</Button></Can>}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader><CardTitle>Ingredients per batch</CardTitle></CardHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Ingredient</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Quantity</TableHead></TableRow></TableHeader>
            <TableBody>
              {f.lines.map((l) => (
                <TableRow key={l.formulaLineId}>
                  <TableCell className="font-medium"><Link href={`/products/${l.ingredientProductId}`} className="hover:underline">{l.ingredientName}</Link></TableCell>
                  <TableCell><code className="text-xs">{l.ingredientSku}</code></TableCell>
                  <TableCell className="text-right tabular">{formatQty(l.quantity, unitSymbol(units.data, l.unitOfMeasureId))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent>
            <DetailList columns={1} items={[{ label: 'Product SKU', value: f.productSku }, { label: 'Created', value: formatDateTime(f.createdAt) }, { label: 'Notes', value: f.notes }]} />
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={deactivating}
        onOpenChange={setDeactivating}
        title={`Deactivate v${f.versionNumber}?`}
        description="It can no longer be used for production runs. Past runs keep their record."
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => deactivate.mutateAsync(undefined)}
      />
    </>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <PermissionRoute permission="Formulas.View" requires="production"><FormulaDetail id={id} /></PermissionRoute>;
}
