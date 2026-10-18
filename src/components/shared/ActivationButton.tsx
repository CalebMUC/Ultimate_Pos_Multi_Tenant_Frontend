'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Power, PowerOff } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { ConfirmDialog } from './ConfirmDialog';

/** Activate / deactivate with a confirm on deactivate. Invalidates the given resources afterwards. */
export function ActivationButton({ isActive, name, activate, deactivate, invalidate, size = 'sm', deactivateWarning }: {
  isActive: boolean;
  name: string;
  activate(): Promise<unknown>;
  deactivate(): Promise<unknown>;
  invalidate: string[];
  size?: ButtonProps['size'];
  deactivateWarning?: string;
}) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function run(fn: () => Promise<unknown>, done: string) {
    await fn();
    await Promise.all(invalidate.map((r) => qc.invalidateQueries({ queryKey: [r] })));
    toast.success(done);
  }

  if (isActive) {
    return (
      <>
        <Button variant="outline" size={size} onClick={(e) => { e.stopPropagation(); setConfirming(true); }}>
          <PowerOff />Deactivate
        </Button>
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={`Deactivate ${name}?`}
          description={deactivateWarning ?? 'It stays in history and reports but can’t be used for new records. You can activate it again later.'}
          confirmLabel="Deactivate"
          destructive
          onConfirm={() => run(deactivate, `${name} deactivated`)}
        />
      </>
    );
  }
  return (
    <Button
      variant="outline"
      size={size}
      loading={pending}
      onClick={async (e) => {
        e.stopPropagation();
        setPending(true);
        try {
          await run(activate, `${name} activated`);
        } catch (err) {
          toast.error((err as Error).message);
        } finally {
          setPending(false);
        }
      }}
    >
      <Power />Activate
    </Button>
  );
}
