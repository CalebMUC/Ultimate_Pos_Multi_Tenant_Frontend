'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KeyRound, LogOut, Menu, Monitor, Moon, PanelLeft, Plus, Search, Sun, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/overlays';
import { Can } from '@/components/shared/Can';
import { BusinessSwitcher } from '@/features/auth/BusinessSwitcher';
import { ChangePasswordDialog } from '@/features/auth/ChangePasswordDialog';
import { logout } from '@/features/auth/sessionActions';
import { usePreferences, type Theme } from '@/stores/preferences';
import { useSession } from '@/stores/session';

function ThemeToggle() {
  const theme = usePreferences((s) => s.theme);
  const set = usePreferences((s) => s.set);
  const next: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' };
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  return (
    <Button variant="ghost" size="icon" onClick={() => set('theme', next[theme])} aria-label={`Theme: ${theme}. Change theme`} title={`Theme: ${theme}`}>
      <Icon />
    </Button>
  );
}

function UserMenu() {
  const user = useSession((s) => s.user);
  const [changing, setChanging] = useState(false);
  const initials = (user?.fullName ?? '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{initials}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm font-semibold text-foreground">{user?.fullName}</span>
            <span className="block truncate text-xs">{user?.email}</span>
            {user?.roles.length ? <span className="mt-1 block truncate text-xs">{user.roles.join(', ')}</span> : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/account"><UserRound />Profile & session</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setChanging(true)}><KeyRound />Change password</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            onSelect={async () => {
              await logout();
              window.location.assign('/login');
            }}
          >
            <LogOut />Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog open={changing} onOpenChange={setChanging} />
    </>
  );
}

export function Header({ onToggleSidebar, onOpenMobileNav }: { onToggleSidebar(): void; onOpenMobileNav(): void }) {
  const hasBusiness = useSession((s) => !!s.activeBusinessId);
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur no-print">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobileNav} aria-label="Open menu"><Menu /></Button>
      <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={onToggleSidebar} aria-label="Toggle sidebar"><PanelLeft /></Button>
      <BusinessSwitcher />
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event('upos:open-command'))}
        className="hidden h-9 w-64 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground hover:bg-accent md:flex"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="rounded border bg-muted px-1.5 text-[10px] font-medium">Ctrl K</kbd>
      </button>
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => window.dispatchEvent(new Event('upos:open-command'))} aria-label="Search">
        <Search />
      </Button>
      {hasBusiness && (
        <Can permission="Sales.Create">
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/pos"><Plus />New Sale</Link>
          </Button>
        </Can>
      )}
      <ThemeToggle />
      <UserMenu />
    </header>
  );
}
