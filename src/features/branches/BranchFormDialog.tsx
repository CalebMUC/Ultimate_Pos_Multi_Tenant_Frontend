'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown } from 'lucide-react';
import { Input, Textarea } from '@/components/ui/primitives';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { branchesApi } from '@/api/endpoints/branches';
import { normaliseError } from '@/api/errors';
import { email, optionalNumber, phone, requiredText, text } from '@/lib/schemas';
import { emptyToNull } from '@/lib/utils';
import type { BranchDto } from '@/api/dto/branches';

const schema = z.object({
  name: requiredText('Name', 100),
  code: z.string().trim().toUpperCase().refine((v) => v === '' || /^[A-Z0-9]{1,10}$/.test(v), 'Up to 10 letters or digits, e.g. NBO.'),
  branchNumber: optionalNumber({ min: 1, max: 99, label: 'Branch number' }),
  physicalAddress: text(300),
  county: text(50),
  phoneNumber: phone,
  email,
  mpesaShortCode: z.string().trim().refine((v) => v === '' || /^\d{5,7}$/.test(v), 'A till or paybill number is 5–7 digits.'),
});
type Values = z.infer<typeof schema>;

/** BRANCH_LIMIT_REACHED is not a blocking screen: the API's message, with who to ask, in the form. */
export function branchLimitMessage(error: unknown): string | null {
  const apiError = normaliseError(error);
  return apiError.code === 'BRANCH_LIMIT_REACHED' ? `${apiError.message} Contact Ultimate POS to upgrade.` : null;
}

export function BranchFormDialog({ open, onOpenChange, branch }: { open: boolean; onOpenChange(o: boolean): void; branch?: BranchDto | null }) {
  const qc = useQueryClient();
  const editing = !!branch;
  const [advanced, setAdvanced] = useState(false);
  return (
    <FormDialog<Values>
      open={open}
      onOpenChange={(o) => { if (!o) setAdvanced(false); onOpenChange(o); }}
      title={editing ? `Edit ${branch!.kraBranchId} · ${branch!.name}` : 'New branch'}
      description={editing ? 'The branch number is fixed: it identifies the branch to KRA.' : 'Products, prices, customers and suppliers are shared; stock is kept per branch.'}
      size="lg"
      schema={schema}
      submitLabel={editing ? 'Save' : 'Open branch'}
      defaultValues={{
        name: branch?.name ?? '',
        code: branch?.code ?? '',
        branchNumber: null,
        physicalAddress: branch?.physicalAddress ?? '',
        county: branch?.county ?? '',
        phoneNumber: branch?.phoneNumber ?? '',
        email: branch?.email ?? '',
        mpesaShortCode: branch?.mpesaShortCode ?? '',
      }}
      onSubmit={async (v) => {
        const body = {
          name: v.name,
          code: emptyToNull(v.code)?.toUpperCase() ?? null,
          physicalAddress: emptyToNull(v.physicalAddress),
          county: emptyToNull(v.county),
          phoneNumber: emptyToNull(v.phoneNumber),
          email: emptyToNull(v.email),
          mpesaShortCode: emptyToNull(v.mpesaShortCode),
        };
        try {
          const saved = editing ? await branchesApi.update(branch!.branchId, body) : await branchesApi.create({ ...body, branchNumber: v.branchNumber });
          await qc.invalidateQueries({ queryKey: ['branches'] });
          toast.success(editing ? 'Branch saved' : `Branch ${saved.kraBranchId} · ${saved.name} opened`);
        } catch (e) {
          const limit = branchLimitMessage(e);
          throw limit ? new Error(limit) : e;
        }
      }}
    >
      {(form) => {
        const e = form.formState.errors;
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" required error={e.name}><Input autoFocus placeholder="Westlands" {...form.register('name')} /></Field>
            <Field label="Code" error={e.code} hint="Optional: up to 10 letters or digits."><Input className="uppercase" placeholder="NBO" maxLength={10} {...form.register('code')} /></Field>
            {editing ? (
              <Field label="Branch number"><Input readOnly className="bg-muted" value={branch!.kraBranchId} /></Field>
            ) : (
              <div className="space-y-1.5 sm:col-span-2">
                <p className="text-sm"><span className="font-medium">Branch number:</span> <span className="text-muted-foreground">next free number</span></p>
                <button type="button" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced}>
                  <ChevronDown className={`size-3.5 transition-transform ${advanced ? 'rotate-180' : ''}`} />Advanced: choose number (1–99)
                </button>
                {advanced && (
                  <Field label="Branch number" error={e.branchNumber} hint="For businesses that already have KRA branch numbers. Numbers are never reused.">
                    <Input type="number" min={1} max={99} step={1} className="w-32" {...form.register('branchNumber', { valueAsNumber: true })} />
                  </Field>
                )}
              </div>
            )}
            <Field label="M-Pesa till / short code" error={e.mpesaShortCode} hint="Optional: payments to this till belong to this branch.">
              <Input inputMode="numeric" {...form.register('mpesaShortCode')} />
            </Field>
            <Field label="Phone" error={e.phoneNumber}><Input type="tel" {...form.register('phoneNumber')} /></Field>
            <Field label="Email" error={e.email}><Input type="email" {...form.register('email')} /></Field>
            <Field label="County" error={e.county}><Input {...form.register('county')} /></Field>
            <Field label="Address" error={e.physicalAddress} className="sm:col-span-2"><Textarea {...form.register('physicalAddress')} /></Field>
          </div>
        );
      }}
    </FormDialog>
  );
}
