'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/primitives';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/overlays';
import { useSession } from '@/stores/session';
import { labels } from '@/api/enums';
import { toastError } from '@/lib/forms';
import { cn } from '@/lib/utils';
import type { Guid } from '@/api/dto/common';
import type { BusinessMembershipDto } from '@/api/dto/identity';
import { switchBusiness } from './sessionActions';
import { homePathFor } from './AuthGuard';

export function BusinessBadges({ membership, vat }: { membership: Pick<BusinessMembershipDto, 'kind' | 'businessType'>; vat?: boolean }) {
  return (
    <span className="flex flex-wrap gap-1">
      <Badge variant="secondary">{labels.businessKind[membership.kind]}</Badge>
      <Badge variant="outline">{labels.businessType[membership.businessType]}</Badge>
      {vat && <Badge variant="info">VAT</Badge>}
    </span>
  );
}

export function useSwitchBusiness() {
  const router = useRouter();
  const [pending, setPending] = useState<Guid | null>(null);
  async function run(businessId: Guid, returnTo?: string | null) {
    setPending(businessId);
    try {
      const data = await switchBusiness(businessId);
      const name = data.businesses.find((b) => b.businessId === businessId)?.businessName;
      toast.success(name ? `Switched to ${name}` : 'Business switched');
      router.replace(returnTo ?? homePathFor(data.user.permissions, data.activeBusinessId));
    } catch (e) {
      toastError(e);
    } finally {
      setPending(null);
    }
  }
  return { switchTo: run, pending };
}

/** Header control: current business with kind, type and VAT badges; switch when the user has several. */
export function BusinessSwitcher() {
  const businesses = useSession((s) => s.businesses);
  const activeBusinessId = useSession((s) => s.activeBusinessId);
  const profile = useSession((s) => s.business);
  const { switchTo, pending } = useSwitchBusiness();
  const active = businesses.find((b) => b.businessId === activeBusinessId);

  const display = (
    <span className="flex min-w-0 items-center gap-2.5">
      {profile?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.logoUrl} alt="" className="size-8 shrink-0 rounded-md border object-cover" />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Building2 className="size-4" /></span>
      )}
      <span className="min-w-0 text-left">
        <span className="block truncate text-sm font-semibold leading-tight">{active?.tradingName || active?.businessName || 'No business'}</span>
        {active && (
          <span className="hidden text-xs text-muted-foreground md:block">
            {labels.businessKind[active.kind]} · {labels.businessType[active.businessType]}
            {profile?.isVatRegistered ? ' · VAT' : ''}
          </span>
        )}
      </span>
    </span>
  );

  if (businesses.length <= 1) return <div className="min-w-0 max-w-[16rem] px-1">{display}</div>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-w-0 max-w-[18rem] items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Switch business">
        {display}
        {pending ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Switch business</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {businesses.map((b) => (
          <DropdownMenuItem key={b.businessId} disabled={!!pending} onSelect={() => b.businessId !== activeBusinessId && switchTo(b.businessId)} className="items-start">
            <Check className={cn('mt-0.5', b.businessId === activeBusinessId ? 'opacity-100' : 'opacity-0')} />
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block truncate font-medium">{b.tradingName || b.businessName}</span>
              <BusinessBadges membership={b} />
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
