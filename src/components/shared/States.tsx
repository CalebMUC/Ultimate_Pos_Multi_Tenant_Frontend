'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, FileQuestion, Inbox, Loader2, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/primitives';
import { normaliseError } from '@/api/errors';
import { cn } from '@/lib/utils';

function StateFrame({ icon, title, message, action, className }: { icon: ReactNode; title: string; message?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-4 py-12 text-center', className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6">{icon}</div>
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        {message && <p className="max-w-md text-sm text-muted-foreground">{message}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', message, action, className }: { title?: string; message?: ReactNode; action?: ReactNode; className?: string }) {
  return <StateFrame icon={<Inbox />} title={title} message={message} action={action} className={className} />;
}

export function LoadingState({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground', className)} role="status">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function ForbiddenState({ title = "You don't have permission", message = 'Ask an administrator of this business for access.' }: { title?: string; message?: string }) {
  return <StateFrame icon={<ShieldOff />} title={title} message={message} />;
}

export function NotFoundState({ title = 'Not found', message = 'It may have been removed, or it belongs to another business.', action }: { title?: string; message?: string; action?: ReactNode }) {
  return <StateFrame icon={<FileQuestion />} title={title} message={message} action={action} />;
}

/** Error view for failed queries. 404 renders as not-found; other errors offer Retry. */
export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const apiError = normaliseError(error);
  if (apiError.status === 404) return <NotFoundState />;
  if (apiError.status === 403) return <ForbiddenState message={apiError.message} />;
  return (
    <StateFrame
      icon={<AlertTriangle />}
      title="Couldn't load this"
      message={apiError.message}
      className={className}
      action={onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>}
    />
  );
}

/** Form-level alert: the API's message for errors that are not about a single field. */
export function FormAlert({ error, messages, title }: { error?: unknown; messages?: string[]; title?: string }) {
  const lines = [...(error ? [normaliseError(error).message] : []), ...(messages ?? [])].filter(Boolean);
  const unique = Array.from(new Set(lines));
  if (unique.length === 0) return null;
  return (
    <Alert variant="destructive">
      <AlertTriangle />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>
        {unique.map((m) => (
          <p key={m}>{m}</p>
        ))}
      </AlertDescription>
    </Alert>
  );
}
