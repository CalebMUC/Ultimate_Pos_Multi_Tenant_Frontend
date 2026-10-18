'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { usePreferences } from '@/stores/preferences';
import { cn } from '@/lib/utils';
import { CommandPalette } from './CommandPalette';
import { Header } from './Header';
import { Sidebar, type ShellArea } from './Sidebar';
import { LicenseBanner } from '@/features/access/LicenseBanner';

export function AppShell({ children, area = 'business' }: { children: ReactNode; area?: ShellArea }) {
  const collapsed = usePreferences((s) => s.sidebarCollapsed);
  const setPref = usePreferences((s) => s.set);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="flex min-h-screen">
      <aside className={cn('fixed inset-y-0 left-0 z-40 hidden transition-[width] lg:block no-print', collapsed ? 'w-16' : 'w-60')}>
        <Sidebar collapsed={collapsed} area={area} />
      </aside>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent
          className="left-0 top-0 h-full max-h-full w-64 max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-0"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Menu</DialogTitle>
          <Sidebar collapsed={false} area={area} onNavigate={() => setMobileOpen(false)} />
        </DialogContent>
      </Dialog>
      <div className={cn('flex min-w-0 flex-1 flex-col transition-[padding]', collapsed ? 'lg:pl-16' : 'lg:pl-60')}>
        <Header area={area} onToggleSidebar={() => setPref('sidebarCollapsed', !collapsed)} onOpenMobileNav={() => setMobileOpen(true)} />
        {area === 'business' && <LicenseBanner />}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
      {area === 'business' && <CommandPalette />}
    </div>
  );
}
