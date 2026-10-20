'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Ban, KeyRound, Layers, Lock, Plus, Power, RefreshCw, ShieldAlert, ShieldCheck, Unlock, UserPlus, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle, Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { DetailList, PageHeader, StatCard } from '@/components/shared/Display';
import { FormDialog } from '@/components/shared/FormDialog';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { platformApi } from '@/api/endpoints/platform';
import { BusinessSector, enumOptions, labels, LicenseState, sectorLabel } from '@/api/enums';
import { Label, NativeSelect } from '@/components/ui/primitives';
import { FormAlert } from '@/components/shared/States';
import { usePermission, useQueryKey } from '@/hooks/useSessionInfo';
import { formatDateOnly, formatDateTime, formatMoney } from '@/lib/format';
import { daysUntil } from '@/features/access/access';
import { AccessStatusBadge } from '@/features/access/AccessComponents';
import { AuditLogView } from '@/features/audit/AuditLogPage';
import { LicenseTable } from '@/features/licensing/LicenseTable';
import { relativeTime } from '@/features/notifications/format';
import { daysLeftText } from '@/features/platform/ExpiringLicensesTable';
import { IssueLicenseDialog } from '@/features/platform/IssueLicenseDialog';
import { OneTimePasswordPanel } from '@/features/platform/OneTimePassword';
import { emptyOwner, OwnerFields, ownerSchema, toOwnerRequest, type OwnerValues } from '@/features/platform/OwnerFields';
import { ReasonDialog } from '@/features/platform/ReasonDialog';
import type { UserDto } from '@/api/dto/identity';
import type { BusinessLicenseDto } from '@/api/dto/platform';

type Confirm = 'suspend' | 'reactivate' | 'close' | 'reopen' | null;
type OneTime = { title: string; email: string; password: string | null; note?: string };
const TABS = ['overview', 'licenses', 'users', 'activity'] as const;

function BusinessDetail({ id }: { id: string }) {
  const key = useQueryKey();
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const canSupport = usePermission('Platform.Support');
  const canLicenses = usePermission('Licenses.View');
  const detail = useQuery({ queryKey: key('platform', { business: id }), queryFn: () => platformApi.business(id) });
  const users = useQuery({ queryKey: key('platform', { business: id, users: true }), queryFn: () => platformApi.businessUsers(id), enabled: canSupport });
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [issuing, setIssuing] = useState(false);
  const [cancelling, setCancelling] = useState<BusinessLicenseDto | null>(null);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [resetting, setResetting] = useState<UserDto | null>(null);
  const [oneTime, setOneTime] = useState<OneTime | null>(null);
  const [changingSector, setChangingSector] = useState(false);

  const requested = params.get('tab');
  const tab = TABS.includes(requested as (typeof TABS)[number]) ? requested! : 'overview';
  const setTab = (t: string) => router.replace(`${pathname}?tab=${t}`, { scroll: false });
  const refresh = () => qc.invalidateQueries({ queryKey: ['platform'] });

  if (detail.isLoading) return <LoadingState />;
  if (detail.error || !detail.data) return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />;
  const { summary, licenses, last30Days } = detail.data;
  const b = summary.business;
  const name = b.tradingName || b.businessName;
  const n = summary.activeUsers;
  const usersText = `${n} user${n === 1 ? '' : 's'}`;
  const latest = [...licenses].filter((l) => l.state === LicenseState.Active).sort((x, y) => y.endsOn.localeCompare(x.endsOn))[0] ?? null;

  const userColumns: ColumnDef<UserDto, unknown>[] = [
    { header: 'Name', accessorKey: 'fullName', cell: ({ row }) => <span><span className="font-medium">{row.original.fullName}</span><span className="block text-xs text-muted-foreground">{row.original.email}</span></span> },
    { header: 'Phone', accessorKey: 'phoneNumber', cell: ({ row }) => row.original.phoneNumber ?? '—' },
    { header: 'Roles', id: 'roles', accessorFn: (u) => u.roles.join(', '), cell: ({ row }) => <span className="flex flex-wrap gap-1">{row.original.roles.map((r) => <Badge key={r} variant="outline">{r}</Badge>)}</span> },
    {
      header: 'Status',
      id: 'status',
      accessorFn: (u) => (u.isLocked ? 'Locked' : u.isActive ? 'Active' : 'Inactive'),
      cell: ({ row }) => (row.original.isLocked ? <Badge variant="destructive"><Lock className="size-3" />Locked</Badge> : <Badge variant={row.original.isActive ? 'success' : 'secondary'}>{row.original.isActive ? 'Active' : 'Inactive'}</Badge>),
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right' },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setResetting(row.original)}><KeyRound />Reset password</Button>
          {row.original.isLocked && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  await platformApi.unlockUser(id, row.original.id);
                  await refresh();
                  toast.success(`${row.original.fullName} unlocked`);
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              <Unlock />Unlock
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-2">{name} <AccessStatusBadge status={summary.access.status} /></span>}
        description={
          <span>
            {sectorLabel(b.sector)} · {labels.businessKind[b.kind]} · {labels.businessType[b.businessType]} · {b.kraPin} · Licence {b.licenseEndsOn ? `to ${formatDateOnly(b.licenseEndsOn)} (${daysLeftText(daysUntil(b.licenseEndsOn))})` : 'none'}
          </span>
        }
        actions={
          <>
            <Button variant="ghost" asChild><Link href="/platform/businesses"><ArrowLeft />Businesses</Link></Button>
            <Can permission="Businesses.Register"><Button variant="outline" onClick={() => setChangingSector(true)}><Layers />Change sector</Button></Can>
            <Can permission="Licenses.Manage"><Button variant="outline" onClick={() => setIssuing(true)}><RefreshCw />{b.licenseEndsOn ? 'Renew licence' : 'Issue licence'}</Button></Can>
            {b.isActive && (
              <Can permission="Businesses.Suspend">
                {b.isSuspended
                  ? <Button variant="outline" onClick={() => setConfirm('reactivate')}><ShieldCheck />Reactivate</Button>
                  : <Button variant="outline" onClick={() => setConfirm('suspend')}><ShieldAlert />Suspend</Button>}
              </Can>
            )}
            <Can permission="Businesses.Deactivate">
              {b.isActive
                ? <Button variant="destructive" onClick={() => setConfirm('close')}><Ban />Close</Button>
                : <Button variant="outline" onClick={() => setConfirm('reopen')}><Power />Reopen</Button>}
            </Can>
          </>
        }
      />
      {b.isSuspended && b.suspensionReason && (
        <Alert variant="destructive" className="mb-4"><ShieldAlert /><AlertTitle>Suspended</AlertTitle><AlertDescription>{b.suspensionReason}</AlertDescription></Alert>
      )}
      {summary.access.message && !b.isSuspended && summary.access.status !== 'Active' && (
        <Alert variant="warning" className="mb-4"><AlertDescription>{summary.access.message}</AlertDescription></Alert>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {canLicenses && <TabsTrigger value="licenses">Licences</TabsTrigger>}
          {canSupport && <TabsTrigger value="users">Users</TabsTrigger>}
          {canSupport && <TabsTrigger value="activity">Activity</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Revenue (30 days)" value={formatMoney(last30Days.revenue)} hint={`${last30Days.saleCount} sale(s)`} />
            <StatCard label="Average sale" value={formatMoney(last30Days.averageSale)} />
            <StatCard label="Active users / products" value={`${last30Days.activeUsers} / ${last30Days.activeProducts}`} />
            <StatCard label="Last sale / sign-in" value={last30Days.lastSaleAt ? relativeTime(last30Days.lastSaleAt) : '—'} hint={last30Days.lastSignInAt ? `Last sign-in ${relativeTime(last30Days.lastSignInAt)}` : 'No sign-in yet'} />
          </div>
          <Card>
            <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
            <CardContent>
              <DetailList
                columns={3}
                items={[
                  { label: 'Registered name', value: b.businessName },
                  { label: 'Sector', value: sectorLabel(b.sector) },
                  { label: 'Trading name', value: b.tradingName },
                  { label: 'KRA PIN', value: b.kraPin },
                  { label: 'Registration no.', value: b.registrationNumber },
                  { label: 'VAT registered', value: b.isVatRegistered ? 'Yes' : 'No' },
                  { label: 'M-Pesa short code', value: b.mpesaShortCode },
                  { label: 'Discount cap', value: b.maxDiscountPercent != null ? `${b.maxDiscountPercent}%` : 'None' },
                  { label: 'Selling below zero stock', value: b.allowNegativeStock === false ? 'Refused' : 'Allowed' },
                  { label: 'User limit', value: b.licenseMaxUsers ?? 'Unlimited' },
                  { label: 'Branches', value: `${summary.activeBranches ?? '—'} open${b.licenseMaxBranches != null ? ` of ${b.licenseMaxBranches}` : ' · unlimited'}` },
                  { label: 'Phone', value: b.phoneNumber },
                  { label: 'Email', value: b.email },
                  { label: 'County', value: b.county },
                  { label: 'Address', value: b.physicalAddress },
                  { label: 'Registered', value: formatDateTime(summary.createdAt) },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {canLicenses && (
          <TabsContent value="licenses" className="space-y-3">
            <div className="flex justify-end">
              <Can permission="Licenses.Manage"><Button onClick={() => setIssuing(true)}><Plus />{b.licenseEndsOn ? 'Renew licence' : 'Issue licence'}</Button></Can>
            </div>
            <LicenseTable
              licenses={licenses}
              actions={(l) => l.state === LicenseState.Active && (
                <Can permission="Licenses.Manage">
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setCancelling(l); }}><XCircle />Cancel</Button>
                </Can>
              )}
            />
          </TabsContent>
        )}

        {canSupport && (
          <TabsContent value="users" className="space-y-3">
            <div className="flex justify-end"><Button onClick={() => setAddingAdmin(true)}><UserPlus />Add administrator</Button></div>
            <DataTable columns={userColumns} data={users.data} isLoading={users.isLoading} error={users.error} onRetry={() => users.refetch()} getRowId={(u) => u.id} searchable emptyTitle="No users" />
          </TabsContent>
        )}

        {canSupport && (
          <TabsContent value="activity">
            {/* Mounted only when open: the log is a separate, paged query. */}
            {tab === 'activity' && <AuditLogView platform={{ businessId: id }} header={false} />}
          </TabsContent>
        )}
      </Tabs>

      <ReasonDialog
        open={confirm === 'suspend'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Suspend ${name}?`}
        description={<>Its {usersText} will be signed out and refused until it is reactivated. Nothing is deleted. They will see the reason.</>}
        confirmLabel="Suspend business"
        placeholder="e.g. Licence fee unpaid since September"
        onConfirm={async (reason) => { await platformApi.suspend(id, reason); await refresh(); toast.success(`${name} suspended`); }}
      />
      <ReasonDialog
        open={confirm === 'close'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Close ${name}?`}
        description={<>For a business leaving the platform. Its {usersText} will be signed out and refused. Its records are kept, and it can be reopened.</>}
        confirmLabel="Close business"
        onConfirm={async (reason) => { await platformApi.close(id, reason); await refresh(); toast.success(`${name} closed`); }}
      />
      <ConfirmDialog
        open={confirm === 'reactivate' || confirm === 'reopen'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === 'reopen' ? `Reopen ${name}?` : `Reactivate ${name}?`}
        description={`Its ${usersText} can sign in again${summary.access.licenseEndsOn ? '' : ', once it has a licence'}.`}
        confirmLabel={confirm === 'reopen' ? 'Reopen' : 'Reactivate'}
        onConfirm={async () => {
          await (confirm === 'reopen' ? platformApi.reopen(id) : platformApi.reactivate(id));
          await refresh();
          toast.success(`${name} ${confirm === 'reopen' ? 'reopened' : 'reactivated'}`);
        }}
      />
      <ReasonDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
        title={`Cancel ${cancelling?.licenseNumber ?? 'licence'}?`}
        description={<>The period {cancelling ? `${formatDateOnly(cancelling.startsOn)} – ${formatDateOnly(cancelling.endsOn)}` : ''} stops counting. If it covers today, the business may lose access at once.</>}
        confirmLabel="Cancel licence"
        onConfirm={async (reason) => { await platformApi.cancelLicense(cancelling!.businessLicenseId, reason); await refresh(); toast.success('Licence cancelled'); }}
      />
      {changingSector && (
        <ChangeSectorDialog
          businessId={id}
          name={name}
          current={b.sector ?? BusinessSector.General}
          onOpenChange={setChangingSector}
          onChanged={refresh}
        />
      )}
      <IssueLicenseDialog
        open={issuing}
        onOpenChange={setIssuing}
        business={{ businessId: id, businessName: name, licenseEndsOn: b.licenseEndsOn ?? null }}
        previous={latest}
      />
      <ConfirmDialog
        open={!!resetting}
        onOpenChange={(o) => !o && setResetting(null)}
        title={`Reset ${resetting?.fullName ?? ''}’s password?`}
        description="They get a temporary password, are unlocked and signed out everywhere, and must change it when they next sign in."
        confirmLabel="Reset password"
        onConfirm={async () => {
          const result = await platformApi.resetUserPassword(id, resetting!.id);
          await refresh();
          setOneTime({ title: `New password for ${result.user.fullName}`, email: result.user.email, password: result.temporaryPassword });
        }}
      />
      <FormDialog<OwnerValues>
        open={addingAdmin}
        onOpenChange={setAddingAdmin}
        title={`Add an administrator to ${name}`}
        description="An existing account is added by its email; otherwise a new account is created."
        size="lg"
        schema={ownerSchema}
        defaultValues={emptyOwner}
        submitLabel="Add administrator"
        onSubmit={async (v) => {
          const result = await platformApi.addAdmin(id, toOwnerRequest(v));
          await refresh();
          setOneTime({
            title: `${result.fullName} is an administrator`,
            email: result.email,
            password: result.temporaryPassword,
            note: result.created ? undefined : 'Added to an existing account: they sign in with their usual password.',
          });
        }}
      >
        {(form) => <OwnerFields register={form.register as never} errors={form.formState.errors} />}
      </FormDialog>

      <Dialog open={!!oneTime} onOpenChange={(o) => !o && setOneTime(null)}>
        <DialogContent size="md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>{oneTime?.title}</DialogTitle></DialogHeader>
          {oneTime?.password
            ? <OneTimePasswordPanel email={oneTime.email} password={oneTime.password} />
            : <p className="text-sm text-muted-foreground">{oneTime?.note ?? 'Done.'}</p>}
          <DialogFooter><Button onClick={() => setOneTime(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return (
    <PermissionRoute permission="Businesses.ViewAll">
      <Suspense><BusinessDetail id={id} /></Suspense>
    </PermissionRoute>
  );
}

/** Reclassifies a business. Its menus follow on its users' next refresh; what it started with stays. */
function ChangeSectorDialog({ businessId, name, current, onOpenChange, onChanged }: {
  businessId: string;
  name: string;
  current: BusinessSector;
  onOpenChange(open: boolean): void;
  onChanged(): Promise<unknown>;
}) {
  const [sector, setSector] = useState<BusinessSector>(current);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function save() {
    setPending(true);
    setError(null);
    try {
      await platformApi.changeSector(businessId, sector);
      await onChanged();
      toast.success(`${name} is now ${sectorLabel(sector)}`);
      onOpenChange(false);
    } catch (e) {
      setError(e); // 400: the same sector as now, or one the API doesn't know.
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent size="sm">
        <DialogHeader><DialogTitle>Change sector of {name}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Only the classification and its menus change. Units, expense categories and settings it already has stay as they are. Its users
          see the new menus when their session next refreshes.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="sector">Sector</Label>
          <NativeSelect id="sector" value={sector} onChange={(e) => setSector(Number(e.target.value) as BusinessSector)}>
            {enumOptions(labels.businessSector).map((o) => <option key={o.value} value={o.value}>{o.label}{o.value === current ? ' (now)' : ''}</option>)}
          </NativeSelect>
        </div>
        <FormAlert error={error} />
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={pending} disabled={sector === current} onClick={save}>Change sector</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
