'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { FormAlert } from '@/components/shared/States';
import { platformApi } from '@/api/endpoints/platform';

/** Switches KRA eTIMS reporting on or off for a business. Its menus follow on its users' next refresh. */
export function ChangeEtimsDialog({ businessId, name, enabled, onOpenChange, onChanged }: {
  businessId: string;
  name: string;
  /** What it is now: the dialog turns it the other way. */
  enabled: boolean;
  onOpenChange(open: boolean): void;
  onChanged(): Promise<unknown>;
}) {
  const turningOn = !enabled;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function save() {
    setPending(true);
    setError(null);
    try {
      await platformApi.changeEtims(businessId, turningOn);
      await onChanged();
      toast.success(`KRA eTIMS ${turningOn ? 'on' : 'off'} for ${name}`);
      onOpenChange(false);
    } catch (e) {
      setError(e); // 400: already in that state.
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent size="sm">
        <DialogHeader><DialogTitle>Turn eTIMS {turningOn ? 'on' : 'off'} for {name}?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          {turningOn
            ? `${name} will start reporting to KRA from now. Register each branch's device next, here on the platform or by its admin under Administration → KRA eTIMS.`
            : `${name} will stop reporting to KRA now. Sales made while it is off are never reported. Devices and history are kept.`}
        </p>
        <FormAlert error={error} />
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant={turningOn ? 'default' : 'destructive'} loading={pending} onClick={save}>Turn eTIMS {turningOn ? 'on' : 'off'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
