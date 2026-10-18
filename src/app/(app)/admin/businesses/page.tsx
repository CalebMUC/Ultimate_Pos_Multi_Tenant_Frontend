'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LogIn, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActivationButton } from '@/components/shared/ActivationButton';
import { Can, PermissionRoute } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { PageHeader, StatusBadge } from '@/components/shared/Display';
import { FormDialog } from '@/components/shared/FormDialog';
import { businessesApi } from '@/api/endpoints/business';
import { labels } from '@/api/enums';
import { usePermissions, useQueryKey } from '@/hooks/useSessionInfo';
import { refreshMe } from '@/features/auth/sessionActions';
import { useSwitchBusiness } from '@/features/auth/BusinessSwitcher';
import { useSession } from '@/stores/session';
import { BusinessFields, businessDefaults, businessSchema, toBusinessRequest, type BusinessValues } from '@/features/admin/BusinessForm';
import type { BusinessDto } from '@/api/dto/business';

function Businesses() {
  const key = useQueryKey();
  const qc = useQueryClient();
  const can = usePermissions();
  const memberships = useSession((s) => s.businesses);
  const activeBusinessId = useSession((s) => s.activeBusinessId);
  const { switchTo, pending } = useSwitchBusiness();
  const [registering, setRegistering] = useState(false);
  const query = useQuery({ queryKey: key('businesses'), queryFn: businessesApi.list });

  const columns: ColumnDef<BusinessDto, unknown>[] = [
    { header: 'Business', accessorKey: 'businessName', cell: ({ row }) => <span><span className="font-medium">{row.original.tradingName || row.original.businessName}</span>{row.original.tradingName && <span className="block text-xs text-muted-foreground">{row.original.businessName}</span>}</span> },
    { header: 'Kind', accessorKey: 'kind', cell: ({ row }) => labels.businessKind[row.original.kind] },
    { header: 'Type', accessorKey: 'businessType', cell: ({ row }) => labels.businessType[row.original.businessType] },
    { header: 'KRA PIN', accessorKey: 'kraPin' },
    { header: 'County', accessorKey: 'county', cell: ({ row }) => row.original.county ?? '—' },
    { header: 'Status', accessorKey: 'isActive', cell: ({ row }) => <StatusBadge kind="active" value={row.original.isActive} /> },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right' },
      cell: ({ row }) => {
        const b = row.original;
        const member = memberships.some((m) => m.businessId === b.businessId);
        return (
          <div className="flex justify-end gap-1">
            {member && b.businessId !== activeBusinessId && b.isActive && (
              <Button variant="ghost" size="sm" loading={pending === b.businessId} onClick={() => switchTo(b.businessId)}><LogIn />Open</Button>
            )}
            {can('Businesses.Deactivate') && (
              <ActivationButton
                isActive={b.isActive}
                name={b.tradingName || b.businessName}
                activate={() => businessesApi.activate(b.businessId)}
                deactivate={() => businessesApi.deactivate(b.businessId)}
                invalidate={['businesses']}
                deactivateWarning="Its users can no longer sign in to it. Data is kept."
              />
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Businesses"
        description={can('Businesses.ViewAll') ? 'Every business on the platform.' : 'Businesses you belong to.'}
        actions={<Can permission="Businesses.Register"><Button onClick={() => setRegistering(true)}><Plus />Register business</Button></Can>}
      />
      <DataTable columns={columns} data={query.data} isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()} getRowId={(b) => b.businessId} searchable emptyTitle="No businesses yet" />
      <FormDialog<BusinessValues>
        open={registering}
        onOpenChange={setRegistering}
        title="Register a business"
        description="You are added to it as its administrator."
        size="xl"
        schema={businessSchema}
        defaultValues={businessDefaults()}
        submitLabel="Register"
        onSubmit={async (v) => {
          const b = await businessesApi.register({ ...toBusinessRequest(v), kind: v.kind });
          await qc.invalidateQueries({ queryKey: ['businesses'] });
          // The new membership appears in the switcher.
          await refreshMe().catch(() => undefined);
          toast.success(`${b.businessName} registered`);
        }}
      >
        {(form) => <BusinessFields form={form} registering />}
      </FormDialog>
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission={['Businesses.ViewAll', 'Businesses.Register']}><Businesses /></PermissionRoute>;
}
