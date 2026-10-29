'use client';

import Link from 'next/link';
import { AlertTriangle, Download, Pencil, Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Can } from '@/components/shared/Can';
import { DetailList } from '@/components/shared/Display';
import { EtimsSubmissionStatus } from '@/api/enums';
import { useApiMutation } from '@/hooks/useApiMutation';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { EtimsDeviceDto, EtimsStatusName } from '@/api/dto/etims';
import { useEtimsScope } from './scope';

/** A branch, with its device once registered. */
export type DeviceSlot = { branchId: string; name: string; kraBranchId: string | null; device: EtimsDeviceDto | null };

export function NoDeviceCard({ slot, onRegister, disabled }: { slot: DeviceSlot; onRegister(): void; disabled?: boolean }) {
  const { manage } = useEtimsScope();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{slot.name}{slot.kraBranchId && <span className="ml-2 font-mono text-sm text-muted-foreground">{slot.kraBranchId}</span>}</CardTitle>
        <CardDescription>Not reporting to KRA</CardDescription>
      </CardHeader>
      <CardContent>
        <Can permission={manage}><Button disabled={disabled} onClick={onRegister}><Plus />Register device</Button></Can>
      </CardContent>
    </Card>
  );
}

const COUNTS: { name: EtimsStatusName; status: EtimsSubmissionStatus }[] = [
  { name: 'Sent', status: EtimsSubmissionStatus.Sent },
  { name: 'Pending', status: EtimsSubmissionStatus.Pending },
  { name: 'Failed', status: EtimsSubmissionStatus.Failed },
  { name: 'Rejected', status: EtimsSubmissionStatus.Rejected },
];

/** A registered device: what KRA knows it as, what it has sent, and the actions to look after it. */
export function DeviceCard({ device: d, onEdit, disabled }: { device: EtimsDeviceDto; onEdit(): void; disabled?: boolean }) {
  const { calls, resource, manage, submissionsHref } = useEtimsScope();
  const sync = useApiMutation(() => calls.syncCodes(d.etimsDeviceId), {
    invalidate: [resource],
    success: (lists) => `KRA's lists downloaded: ${lists.map((l) => `${l.kind} ${l.count}${l.resultCode && !['000', '001'].includes(l.resultCode) ? ` (${l.resultMessage ?? l.resultCode})` : ''}`).join(', ')}`,
  });
  const run = useApiMutation(() => calls.run(d.etimsDeviceId), {
    invalidate: [resource],
    success: (r) => `Queued ${r.queued}, sent ${r.sent}, failed ${r.failed}, waiting ${r.waiting}`,
  });
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {d.branchName}<span className="font-mono text-sm text-muted-foreground">{d.bhfId}</span>
            <Badge variant={d.isActive ? 'success' : 'secondary'}>{d.isActive ? 'Active' : 'Inactive'}</Badge>
          </CardTitle>
          {d.taxpayerName && <CardDescription>{d.taxpayerName}{d.kraBranchName ? ` · ${d.kraBranchName}` : ''}</CardDescription>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <DetailList
          columns={2}
          items={[
            { label: 'SCU ID', value: d.sdcId },
            { label: 'MRC', value: d.mrcNo },
            { label: 'Device serial', value: <span className="font-mono text-xs">{d.deviceSerialNumber}</span> },
            { label: 'Key', value: <span className="font-mono text-xs">{d.cmcKeyHint}</span> },
            { label: 'Last invoice no.', value: d.lastInvoiceNumber },
            { label: 'Last stock no.', value: d.lastStockAdjustmentNumber },
            { label: 'Default classification', value: d.defaultItemClassCode },
            { label: 'Reporting since', value: formatDateTime(d.activatedAt) },
          ]}
        />
        <div className="grid grid-cols-4 gap-2 text-center">
          {COUNTS.map(({ name, status }) => {
            const n = d.submissionCounts[name] ?? 0;
            const alarm = status === EtimsSubmissionStatus.Rejected && n > 0;
            return (
              <Link
                key={name}
                href={submissionsHref(d.etimsDeviceId, status)}
                className={cn('rounded-md border p-2 hover:bg-muted', alarm && 'border-destructive/50 bg-destructive/5 text-destructive')}
              >
                <span className="block text-lg font-semibold tabular-nums">{n}</span>
                <span className="text-xs">{name}</span>
              </Link>
            );
          })}
        </div>
        {d.lastCodeSyncAt
          ? <p className="text-sm text-muted-foreground">KRA’s lists downloaded {formatDateTime(d.lastCodeSyncAt)}</p>
          : <Alert variant="warning"><AlertTriangle /><AlertDescription>KRA’s lists not downloaded yet</AlertDescription></Alert>}
        <Can permission={manage}>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" loading={sync.isPending} disabled={disabled} onClick={() => sync.mutate(undefined)}><Download />Download KRA lists</Button>
            <Button variant="outline" size="sm" loading={run.isPending} disabled={disabled || !d.isActive} onClick={() => run.mutate(undefined)}><Send />Send now</Button>
            <Button variant="outline" size="sm" disabled={disabled} onClick={onEdit}><Pencil />Edit</Button>
          </div>
        </Can>
      </CardContent>
    </Card>
  );
}
