'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { BrandMark } from './BrandMark';

/** The client's logo and name, or Ultimate POS when they have no logo or it won't load. */
export function TenantMark({ name, logoUrl, dark = true, compact = false, className }: { name?: string | null; logoUrl?: string | null; dark?: boolean; compact?: boolean; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!logoUrl || logoUrl === failedUrl) return <BrandMark dark={dark} compact={compact} className={className} />;
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      {/* White behind it: many logos are dark on transparent, and the sidebar is dark. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoUrl} alt={compact ? name ?? '' : ''} onError={() => setFailedUrl(logoUrl)} className="size-8 shrink-0 rounded-md bg-white object-contain" />
      {!compact && <span className={cn('truncate text-lg font-semibold tracking-tight', dark ? 'text-sidebar-foreground' : 'text-foreground')}>{name}</span>}
    </div>
  );
}
