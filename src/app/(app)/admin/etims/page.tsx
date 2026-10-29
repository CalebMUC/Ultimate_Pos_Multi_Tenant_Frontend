'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PermissionRoute } from '@/components/shared/Can';
import { PageHeader } from '@/components/shared/Display';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/States';
import type { BranchDto } from '@/api/dto/branches';
import type { EtimsDeviceDto } from '@/api/dto/etims';
import { useBranchList } from '@/features/branches/branches';
import { DeviceCard, NoDeviceCard, type DeviceSlot as Slot } from '@/features/etims/DeviceCards';
import { EditDeviceDialog, RegisterDeviceDialog } from '@/features/etims/DeviceDialogs';
import { useEtimsDevices } from '@/features/etims/etims';

function EtimsDevices() {
  const branches = useBranchList(false);
  const devices = useEtimsDevices();
  const [registering, setRegistering] = useState<Slot | null>(null);
  const [editing, setEditing] = useState<EtimsDeviceDto | null>(null);

  if (branches.isLoading || devices.isLoading) return <LoadingState />;
  if (branches.error || devices.error) {
    return <ErrorState error={branches.error ?? devices.error} onRetry={() => { void branches.refetch(); void devices.refetch(); }} />;
  }

  // One card per branch; a device whose branch has since closed still shows.
  const byBranch = new Map((devices.data ?? []).map((d) => [d.branchId, d]));
  const slots: Slot[] = (branches.data ?? []).map((b: BranchDto) => ({ branchId: b.branchId, name: b.name, kraBranchId: b.kraBranchId, device: byBranch.get(b.branchId) ?? null }));
  for (const d of devices.data ?? []) {
    if (!slots.some((s) => s.branchId === d.branchId)) slots.push({ branchId: d.branchId, name: d.branchName, kraBranchId: d.bhfId, device: d });
  }

  return (
    <>
      <PageHeader
        title="KRA eTIMS"
        description="Each branch reports its sales, returns and stock movements to KRA through its own device, by itself. Register each branch's device once."
        actions={<Button variant="outline" asChild><Link href="/admin/etims/submissions"><ReceiptText />Submissions</Link></Button>}
      />
      {slots.length === 0 ? (
        <EmptyState title="No branches" message="Open a branch first." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {slots.map((s) => (s.device
            ? <DeviceCard key={s.branchId} device={s.device} onEdit={() => setEditing(s.device)} />
            : <NoDeviceCard key={s.branchId} slot={s} onRegister={() => setRegistering(s)} />))}
        </div>
      )}
      <RegisterDeviceDialog branch={registering} open={!!registering} onOpenChange={(o) => !o && setRegistering(null)} />
      <EditDeviceDialog device={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Etims.View" module="etims"><EtimsDevices /></PermissionRoute>;
}
