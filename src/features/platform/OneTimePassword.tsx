'use client';

import { useState } from 'react';
import { Check, Copy, KeyRound, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * A temporary password the API returns once. It is shown here only, in memory: it is never cached, stored or logged, and is gone
 * when the panel closes. The user is made to change it at first sign-in.
 */
export function OneTimePasswordPanel({ email, password, className }: { email: string; password: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className={cn('space-y-3 rounded-lg border border-warning/50 bg-warning/10 p-4', className)} data-testid="one-time-password">
      <p className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4 text-warning" />Temporary password</p>
      <div className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Sign in as</span>
        <span className="font-medium">{email}</span>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 select-all rounded-md border bg-background px-3 py-2 font-mono text-base tracking-wide" data-testid="temporary-password">{password}</code>
        <Button type="button" variant="outline" onClick={copy} aria-label="Copy the password">{copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy'}</Button>
      </div>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
        This won’t be shown again. Give it to them in person or by phone; they will be asked to change it when they first sign in.
      </p>
    </div>
  );
}
