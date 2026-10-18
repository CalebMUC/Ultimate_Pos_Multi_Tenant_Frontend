'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Catches render errors inside the app shell so one broken page doesn't take down the navigation. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset(): void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <AlertTriangle className="size-10 text-destructive" />
      <h1 className="text-lg font-semibold">This page hit a problem</h1>
      <p className="max-w-md text-sm text-muted-foreground">{error.message || 'Something went wrong while showing this page.'}</p>
      <Button variant="outline" onClick={reset}>Try again</Button>
    </div>
  );
}
