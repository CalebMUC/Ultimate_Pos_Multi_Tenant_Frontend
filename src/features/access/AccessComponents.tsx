'use client';

import { Mail, Phone } from 'lucide-react';
import { env } from '@/config/env';
import { cn } from '@/lib/utils';
import { accessStatusStyle } from './access';

/** The business's licence position as a badge. */
export function AccessStatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const style = accessStatusStyle(status);
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', style.className, className)}>
      {style.label}
    </span>
  );
}

/** "Contact the Ultimate POS team", with the configured email and phone when there are any. */
export function SupportContact({ className, lead = 'Contact the Ultimate POS team' }: { className?: string; lead?: string }) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)}>
      {lead}
      {(env.supportEmail || env.supportPhone) && (
        <span className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          {env.supportEmail && <a href={`mailto:${env.supportEmail}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Mail className="size-3.5" />{env.supportEmail}</a>}
          {env.supportPhone && <a href={`tel:${env.supportPhone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="size-3.5" />{env.supportPhone}</a>}
        </span>
      )}
      {!env.supportEmail && !env.supportPhone && '.'}
    </p>
  );
}

