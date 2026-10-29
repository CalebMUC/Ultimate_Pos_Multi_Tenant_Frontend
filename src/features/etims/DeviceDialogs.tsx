'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, Input } from '@/components/ui/primitives';
import { Switch } from '@/components/ui/overlays';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { normaliseError } from '@/api/errors';
import { emptyToNull } from '@/lib/utils';
import type { EtimsDeviceDto } from '@/api/dto/etims';
import { branchLabel } from '@/features/branches/branches';
import { ItemClassPicker } from './ItemClassPicker';
import { RECEIPT_MESSAGE_MAX, useListsDevice } from './etims';
import { useEtimsScope } from './scope';

const message = z.string().trim().max(RECEIPT_MESSAGE_MAX, `KRA prints at most ${RECEIPT_MESSAGE_MAX} characters.`);
const itemClass = z.string().trim().min(1, 'Choose the classification for products with none of their own.').max(20);

const registerSchema = z.object({
  deviceSerialNumber: z.string().trim().min(1, 'The device serial number is required.').max(50),
  defaultItemClassCode: itemClass,
  receiptTopMessage: message,
  receiptBottomMessage: message,
  cmcKey: z.string().trim().max(200),
});
type RegisterValues = z.infer<typeof registerSchema>;

const editSchema = z.object({
  defaultItemClassCode: itemClass,
  receiptTopMessage: message,
  receiptBottomMessage: message,
  isActive: z.boolean(),
});
type EditValues = z.infer<typeof editSchema>;

const counter = (value: string | undefined) => `${(value ?? '').length}/${RECEIPT_MESSAGE_MAX}`;

/** Initialises a branch's device with KRA. KRA can be slow, and initialises a device only once. */
export function RegisterDeviceDialog({ branch, open, onOpenChange, tin }: {
  branch: { branchId: string; name: string; kraBranchId?: string | null } | null;
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The business's KRA PIN, shown as the device's (the platform knows it; the API defaults to it either way). */
  tin?: string;
}) {
  const qc = useQueryClient();
  const { calls, resource } = useEtimsScope();
  const listsDevice = useListsDevice();
  const [showKey, setShowKey] = useState(false);
  useEffect(() => {
    if (open) setShowKey(false);
  }, [open]);

  return (
    <FormDialog<RegisterValues>
      open={open && !!branch}
      onOpenChange={onOpenChange}
      title="Register device with KRA"
      description="Initialises this branch's eTIMS device. From then on its sales, returns and stock movements are reported to KRA by themselves."
      size="lg"
      schema={registerSchema}
      defaultValues={{ deviceSerialNumber: '', defaultItemClassCode: '', receiptTopMessage: '', receiptBottomMessage: '', cmcKey: '' }}
      submitLabel="Register device"
      onSubmit={async (v) => {
        try {
          const device = await calls.registerDevice({
            branchId: branch!.branchId,
            deviceSerialNumber: v.deviceSerialNumber,
            defaultItemClassCode: v.defaultItemClassCode,
            receiptTopMessage: emptyToNull(v.receiptTopMessage),
            receiptBottomMessage: emptyToNull(v.receiptBottomMessage),
            cmcKey: emptyToNull(v.cmcKey),
          });
          await qc.invalidateQueries({ queryKey: [resource] });
          toast.success(`${device.branchName} is registered with KRA`, { description: `SCU ID ${device.sdcId ?? '—'} · MRC ${device.mrcNo ?? '—'}` });
        } catch (e) {
          // KRA initialises a device once: the cue to paste the key it issued then.
          if (/installed/i.test(normaliseError(e).message)) setShowKey(true);
          throw e;
        }
      }}
    >
      {(form) => {
        const e = form.formState.errors;
        const [top, bottom] = form.watch(['receiptTopMessage', 'receiptBottomMessage']);
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {form.formState.isSubmitting && (
              <Alert variant="info" className="sm:col-span-2"><Loader2 className="animate-spin" /><AlertDescription>Contacting KRA…</AlertDescription></Alert>
            )}
            <Field label="Branch"><Input readOnly className="bg-muted" value={branchLabel(branch)} /></Field>
            {tin && <Field label="KRA PIN (TIN)" hint="The business's KRA PIN."><Input readOnly className="bg-muted" value={tin} /></Field>}
            <Field label="Device serial number" required error={e.deviceSerialNumber} hint="As registered on KRA's eTIMS portal for this branch.">
              <Input autoFocus autoComplete="off" spellCheck={false} placeholder="e.g. UPOSP052446551J001" {...form.register('deviceSerialNumber')} />
            </Field>
            <Field
              label="Default item classification"
              required
              error={e.defaultItemClassCode}
              className="sm:col-span-2"
              hint={listsDevice?.lastCodeSyncAt ? 'For products with no classification of their own or from their category.' : 'e.g. 1010160100. You can change it after downloading KRA’s lists.'}
            >
              <ItemClassPicker value={form.watch('defaultItemClassCode') || null} onChange={(code) => form.setValue('defaultItemClassCode', code ?? '', { shouldValidate: form.formState.isSubmitted })} />
            </Field>
            <Field label="Receipt top message" error={e.receiptTopMessage} hint={counter(top)}>
              <Input maxLength={RECEIPT_MESSAGE_MAX} placeholder="e.g. Karibu" {...form.register('receiptTopMessage')} />
            </Field>
            <Field label="Receipt bottom message" error={e.receiptBottomMessage} hint={counter(bottom)}>
              <Input maxLength={RECEIPT_MESSAGE_MAX} placeholder="e.g. Asante" {...form.register('receiptBottomMessage')} />
            </Field>
            <details className="rounded-md border p-3 sm:col-span-2" open={showKey} onToggle={(ev) => setShowKey((ev.target as HTMLDetailsElement).open)}>
              <summary className="cursor-pointer text-sm font-medium">Device already initialised with KRA?</summary>
              <div className="mt-2 space-y-2">
                <p className="text-sm text-muted-foreground">
                  KRA initialises a device once. If it was set up before (for example while testing), paste the key KRA issued then.
                </p>
                <Field label="Communication key (cmcKey)" error={e.cmcKey}>
                  <Input autoComplete="off" spellCheck={false} {...form.register('cmcKey')} />
                </Field>
              </div>
            </details>
          </div>
        );
      }}
    </FormDialog>
  );
}

/** The device's editable settings (full replace). Deactivating stops the branch reporting; nothing it missed is sent later. */
export function EditDeviceDialog({ device, open, onOpenChange }: { device: EtimsDeviceDto | null; open: boolean; onOpenChange(open: boolean): void }) {
  const qc = useQueryClient();
  const { calls, resource } = useEtimsScope();
  return (
    <FormDialog<EditValues>
      open={open && !!device}
      onOpenChange={onOpenChange}
      title={`Edit ${device?.branchName ?? 'device'}`}
      size="lg"
      schema={editSchema}
      defaultValues={{
        defaultItemClassCode: device?.defaultItemClassCode ?? '',
        receiptTopMessage: device?.receiptTopMessage ?? '',
        receiptBottomMessage: device?.receiptBottomMessage ?? '',
        isActive: device?.isActive ?? true,
      }}
      onSubmit={async (v) => {
        await calls.updateDevice(device!.etimsDeviceId, {
          defaultItemClassCode: v.defaultItemClassCode,
          isActive: v.isActive,
          receiptTopMessage: emptyToNull(v.receiptTopMessage),
          receiptBottomMessage: emptyToNull(v.receiptBottomMessage),
        });
        await qc.invalidateQueries({ queryKey: [resource] });
        toast.success('Device saved');
      }}
    >
      {(form) => {
        const e = form.formState.errors;
        const [top, bottom, active] = form.watch(['receiptTopMessage', 'receiptBottomMessage', 'isActive']);
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Default item classification" required error={e.defaultItemClassCode} className="sm:col-span-2" hint="For products with no classification of their own or from their category.">
              <ItemClassPicker value={form.watch('defaultItemClassCode') || null} onChange={(code) => form.setValue('defaultItemClassCode', code ?? '', { shouldDirty: true })} />
            </Field>
            <Field label="Receipt top message" error={e.receiptTopMessage} hint={counter(top)}>
              <Input maxLength={RECEIPT_MESSAGE_MAX} {...form.register('receiptTopMessage')} />
            </Field>
            <Field label="Receipt bottom message" error={e.receiptBottomMessage} hint={counter(bottom)}>
              <Input maxLength={RECEIPT_MESSAGE_MAX} {...form.register('receiptBottomMessage')} />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Switch checked={active} onCheckedChange={(v) => form.setValue('isActive', v, { shouldDirty: true })} />
              Active: this branch reports to KRA
            </label>
            {device?.isActive && !active && (
              <Alert variant="warning" className="sm:col-span-2">
                <AlertDescription>This branch stops reporting to KRA. What it sells while inactive is never reported.</AlertDescription>
              </Alert>
            )}
          </div>
        );
      }}
    </FormDialog>
  );
}
