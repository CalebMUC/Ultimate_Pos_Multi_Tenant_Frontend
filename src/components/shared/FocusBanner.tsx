'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Shown when a link (usually from a notification) narrowed a list to one record. "Show all" drops the query parameter. */
export function FocusBanner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
      <Filter className="size-4 text-primary" />
      <span className="flex-1">{children}</span>
      <Button variant="ghost" size="sm" onClick={() => router.replace(pathname)}><X />Show all</Button>
    </div>
  );
}
