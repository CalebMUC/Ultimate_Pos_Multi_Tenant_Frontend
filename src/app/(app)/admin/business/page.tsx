'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/primitives';
import { PermissionRoute } from '@/components/shared/Can';
import { PageHeader } from '@/components/shared/Display';
import { ErrorState, FormAlert, LoadingState } from '@/components/shared/States';
import { businessesApi } from '@/api/endpoints/business';
import { normaliseError } from '@/api/errors';
import { useQueryKey } from '@/hooks/useSessionInfo';
import { applyApiErrors } from '@/lib/forms';
import { useSession } from '@/stores/session';
import { BusinessFields, businessDefaults, businessSchema, toBusinessRequest, type BusinessValues } from '@/features/admin/BusinessForm';

function BusinessProfile() {
  const key = useQueryKey();
  const qc = useQueryClient();
  const business = useQuery({ queryKey: key('business-current'), queryFn: businessesApi.current });
  const [messages, setMessages] = useState<string[]>([]);
  const form = useForm<BusinessValues>({ resolver: zodResolver(businessSchema), defaultValues: businessDefaults() });

  useEffect(() => {
    if (business.data) form.reset(businessDefaults(business.data));
  }, [business.data, form]);

  async function submit(v: BusinessValues) {
    setMessages([]);
    try {
      const saved = await businessesApi.update(business.data!.businessId, toBusinessRequest(v));
      useSession.getState().setBusiness(saved);
      await qc.invalidateQueries({ queryKey: ['business-current'] });
      toast.success('Business profile saved');
    } catch (err) {
      const rest = applyApiErrors(form, err);
      setMessages(rest.length ? rest : normaliseError(err).hasFieldErrors() ? [] : [normaliseError(err).message]);
    }
  }

  if (business.isLoading) return <LoadingState />;
  if (business.error) return <ErrorState error={business.error} onRetry={() => business.refetch()} />;
  return (
    <>
      <PageHeader title="Business profile" description="Shown on receipts and invoices. Also sets VAT, the M-Pesa till and the discount cap." />
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
        <FormAlert messages={messages} />
        <Card><CardContent className="pt-4"><BusinessFields form={form} registering={false} /></CardContent></Card>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={!form.formState.isDirty} onClick={() => form.reset(businessDefaults(business.data))}>Discard</Button>
          <Button type="submit" loading={form.formState.isSubmitting} disabled={!form.formState.isDirty}>Save</Button>
        </div>
      </form>
    </>
  );
}

export default function Page() {
  return <PermissionRoute permission="Businesses.Update"><BusinessProfile /></PermissionRoute>;
}
