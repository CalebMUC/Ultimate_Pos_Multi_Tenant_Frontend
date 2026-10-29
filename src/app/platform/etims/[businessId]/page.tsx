'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle, Badge, Card, CardContent } from '@/components/ui/primitives';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { PageHeader } from '@/components/shared/Display';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/States';
import { platformEtimsApi } from '@/api/endpoints/platformEtims';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateTime } from '@/lib/format';
import type { EtimsDeviceDto } from '@/api/dto/etims';
import { DeviceCard, NoDeviceCard, type DeviceSlot } from '@/features/etims/DeviceCards';
import { EditDeviceDialog, RegisterDeviceDialog } from '@/features/etims/DeviceDialogs';
import { PlatformEtimsScope } from '@/features/etims/scope';
import { ChangeEtimsDialog } from '@/features/platform/ChangeEtimsDialog';

const STEPS = [
  'Turn eTIMS on.',
  'Register the head office (00) device.',
  'Download KRA’s lists.',
  'Register the other branches.',
  'Ask the business to check product classifications before its first sale.',
];

/** Onboarding one business onto KRA eTIMS: its branches' devices, through the platform's routes. */
function PlatformEtimsBusiness({ businessId }: { businessId: string }) {
  const key = useQueryKey();
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: key('platform', { etimsBusiness: businessId }), queryFn: () => platformEtimsApi.business(businessId) });
  const [registering, setRegistering] = useState<DeviceSlot | null>(null);
  const [editing, setEditing] = useState<EtimsDeviceDto | null>(null);
  const [switching, setSwitching] = useState(false);
  const devices = useMemo(() => detail.data?.branches.flatMap((b) => (b.device ? [b.device] : [])) ?? [], [detail.data]);

  if (detail.isLoading) return <LoadingState />;
  if (detail.error || !detail.data) return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />;
  const b = detail.data;
  const off = !b.etimsEnabled;
  const slots: DeviceSlot[] = b.branches.map((br) => ({ branchId: br.branchId, name: br.name, kraBranchId: br.kraBranchId, device: br.device }));

  return (
    <PlatformEtimsScope businessId={businessId} devices={devices}>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-2">{b.businessName} <Badge variant={off ? 'secondary' : 'success'}>eTIMS {off ? 'Off' : 'On'}</Badge></span>}
        description={
          <span>
            KRA PIN <span className="font-mono">{b.kraPin}</span>
            {b.etimsEnabledAt && !off && ` · reporting since ${formatDateTime(b.etimsEnabledAt)}`}
          </span>
        }
        actions={
          <>
            <Button variant="ghost" asChild><Link href="/platform/etims"><ArrowLeft />KRA eTIMS</Link></Button>
            <Button variant="outline" asChild><Link href={`/platform/businesses/${businessId}`}><Building2 />Business</Link></Button>
            <Can permission="Businesses.Register">
              <Button variant={off ? 'default' : 'outline'} onClick={() => setSwitching(true)}><ReceiptText />Turn eTIMS {off ? 'on' : 'off'}</Button>
            </Can>
          </>
        }
      />
      {off && (
        <Alert variant="warning" className="mb-4">
          <AlertTitle>eTIMS is off for this business</AlertTitle>
          <AlertDescription>Turn it on before registering devices. Its devices and history are kept while it is off.</AlertDescription>
        </Alert>
      )}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <p className="mb-2 text-sm font-medium">Suggested order</p>
          <ol className="list-decimal space-y-0.5 pl-5 text-sm text-muted-foreground">{STEPS.map((s) => <li key={s}>{s}</li>)}</ol>
          <p className="mt-2 text-xs text-muted-foreground">Products and categories stay with the business: its staff set classifications on them.</p>
        </CardContent>
      </Card>
      {slots.length === 0 ? (
        <EmptyState title="No branches" message="The business has no branches yet." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {slots.map((s) => (s.device
            ? <DeviceCard key={s.branchId} device={s.device} disabled={off} onEdit={() => setEditing(s.device)} />
            : <NoDeviceCard key={s.branchId} slot={s} disabled={off} onRegister={() => setRegistering(s)} />))}
        </div>
      )}
      <RegisterDeviceDialog branch={registering} tin={b.kraPin} open={!!registering} onOpenChange={(o) => !o && setRegistering(null)} />
      <EditDeviceDialog device={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
      {switching && (
        <ChangeEtimsDialog
          businessId={businessId}
          name={b.businessName}
          enabled={b.etimsEnabled}
          onOpenChange={setSwitching}
          onChanged={() => qc.invalidateQueries({ queryKey: ['platform'] })}
        />
      )}
    </PlatformEtimsScope>
  );
}

export default function Page() {
  const { businessId } = useParams<{ businessId: string }>();
  return <PermissionRoute permission="Platform.Etims.View"><PlatformEtimsBusiness businessId={businessId} /></PermissionRoute>;
}
