'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { navigation, platformNavigation, type NavGroup } from '@/config/navigation';
import { useActiveBusiness, usePermissions } from '@/hooks/useSessionInfo';
import { usePharmacyMenu } from '@/features/auth/usePharmacyMenu';
import { cn } from '@/lib/utils';
import { BrandMark } from './BrandMark';
import { useTransferInbox } from '@/features/transfers/useTransferInbox';

export type ShellArea = 'business' | 'platform';

/**
 * The navigation the user can see: an item needs both its module (what the business uses, from the API) and its permission, plus the
 * pharmacy rule for that group. Each area has its own menu; the platform menu has no modules.
 */
export function useVisibleNavigation(area: ShellArea = 'business'): NavGroup[] {
  const can = usePermissions();
  const { hasModule } = useActiveBusiness();
  const pharmacy = usePharmacyMenu(area === 'business');

  return useMemo(() => {
    const platform = area === 'platform';
    const source = platform ? platformNavigation : navigation;
    const used = (module?: NavGroup['module']) => platform || !module || hasModule(module);
    return source
      .filter((g) => used(g.module) && (!g.pharmacy || pharmacy) && can(g.permission))
      .map((g) => ({ ...g, items: g.items?.filter((i) => used(i.module) && can(i.permission)) }))
      .filter((g) => g.href || (g.items && g.items.length > 0));
  }, [area, hasModule, pharmacy, can]);
}

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

/** The longest matching href wins, so /sales/returns doesn't also light up /sales. */
function bestMatch(pathname: string, groups: NavGroup[]): string | null {
  const hrefs = groups.flatMap((g) => [g.href, ...(g.items?.map((i) => i.href) ?? [])]).filter(Boolean) as string[];
  return hrefs.filter((h) => isActive(pathname, h)).sort((a, b) => b.length - a.length)[0] ?? null;
}

export function Sidebar({ collapsed, onNavigate, area = 'business' }: { collapsed: boolean; onNavigate?: () => void; area?: ShellArea }) {
  const pathname = usePathname();
  const groups = useVisibleNavigation(area);
  const active = bestMatch(pathname, groups);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // Open the group that holds the current page.
  useEffect(() => {
    const group = groups.find((g) => g.items?.some((i) => i.href === active));
    if (group) setOpen((o) => (o[group.label] ? o : { ...o, [group.label]: true }));
  }, [active, groups]);

  return (
    <nav className="flex h-full flex-col bg-sidebar text-sidebar-foreground" aria-label="Main">
      <div className={cn('flex h-14 shrink-0 items-center border-b border-white/10', collapsed ? 'justify-center' : 'px-4')}>
        <BrandMark compact={collapsed} />
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {groups.map((group) => {
          const Icon = group.icon;
          const linkClass = (on: boolean) =>
            cn(
              'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors',
              on ? 'bg-primary text-primary-foreground' : 'text-sidebar-foreground/85 hover:bg-white/5 hover:text-sidebar-foreground',
              collapsed && 'justify-center px-0',
            );
          if (group.href) {
            return (
              <Link key={group.label} href={group.href} onClick={onNavigate} className={linkClass(active === group.href)} title={collapsed ? group.label : undefined}>
                <Icon className="size-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{group.label}</span>}
              </Link>
            );
          }
          const containsActive = group.items?.some((i) => i.href === active);
          const isOpen = collapsed ? false : open[group.label] ?? false;
          return (
            <div key={group.label}>
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [group.label]: !isOpen }))}
                className={cn(linkClass(false), containsActive && 'text-sidebar-foreground', containsActive && collapsed && 'bg-white/10')}
                aria-expanded={isOpen}
                title={collapsed ? group.label : undefined}
              >
                <Icon className={cn('size-[18px] shrink-0', containsActive && 'text-primary')} />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate text-left">{group.label}</span>
                    <ChevronDown className={cn('size-4 text-sidebar-muted transition-transform', isOpen && 'rotate-180')} />
                  </>
                )}
              </button>
              {isOpen && (
                <div className="mb-1 ml-[1.35rem] mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                  {group.items!.map((item) => (
                    <Link
                      key={item.href + item.label}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'flex items-center gap-2 truncate rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                        active === item.href ? 'bg-white/10 font-medium text-primary' : 'text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground',
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.badge === 'transferInbox' && <TransferInboxBadge />}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

/** Transfers waiting to be received at the active branch. Hidden at 0. */
function TransferInboxBadge() {
  const { count } = useTransferInbox();
  if (!count) return null;
  return (
    <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground" aria-label={`${count} transfer${count === 1 ? '' : 's'} to receive`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
