'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, UserRound, UserRoundCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { DetailList } from '@/components/shared/Display';
import { FormAlert } from '@/components/shared/States';
import { businessesApi } from '@/api/endpoints/business';
import { normaliseError } from '@/api/errors';
import { labels } from '@/api/enums';
import { formatDateOnly } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BusinessFields, businessDefaults, businessSchema, toBusinessRequest, type BusinessValues } from '@/features/admin/BusinessForm';
import type { RegisterBusinessResultDto } from '@/api/dto/platform';
import { OneTimePasswordPanel } from './OneTimePassword';
import { emptyOwner, OwnerFields, ownerSchema, toOwnerRequest, type OwnerValues } from './OwnerFields';

const STEPS = [
  { id: 0, label: 'Business', icon: Building2 },
  { id: 1, label: 'Owner', icon: UserRound },
  { id: 2, label: 'Review', icon: CheckCircle2 },
] as const;

/** Registers a business with its owner, who becomes its first Admin. The Super User doesn't join it. */
export function RegisterBusinessWizard() {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegisterBusinessResultDto | null>(null);
  const business = useForm<BusinessValues>({ resolver: zodResolver(businessSchema), defaultValues: businessDefaults() });
  const owner = useForm<OwnerValues>({ resolver: zodResolver(ownerSchema), defaultValues: emptyOwner });

  async function next() {
    if (step === 0 && !(await business.trigger())) return;
    if (step === 1 && !(await owner.trigger())) return;
    setStep((s) => Math.min(2, s + 1));
  }

  async function submit() {
    setMessages([]);
    setSubmitting(true);
    try {
      const b = business.getValues();
      const created = await businessesApi.register({ ...toBusinessRequest(b), kind: b.kind, owner: toOwnerRequest(owner.getValues()) });
      setResult(created);
      await qc.invalidateQueries({ queryKey: ['platform'] });
      toast.success(`${created.business.businessName} registered`);
    } catch (e) {
      // Put each field error on its step: "owner.email" belongs to the owner, the rest to the business profile.
      const apiError = normaliseError(e);
      let firstStep: number | null = null;
      const unmatched: string[] = [];
      for (const [path, msgs] of Object.entries(apiError.fieldErrors)) {
        if (path === 'owner' || path.startsWith('owner.')) {
          const field = path.slice('owner.'.length) as keyof OwnerValues;
          if (field && field in emptyOwner) owner.setError(field, { type: 'server', message: msgs.join(' ') });
          else unmatched.push(...msgs);
          firstStep = firstStep === null ? 1 : Math.min(firstStep, 1);
        } else if (path in businessDefaults()) {
          business.setError(path as keyof BusinessValues, { type: 'server', message: msgs.join(' ') });
          firstStep = 0;
        } else unmatched.push(...msgs);
      }
      if (firstStep !== null) setStep(firstStep);
      setMessages(unmatched.length ? unmatched : apiError.hasFieldErrors() ? [] : [apiError.message]);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) return <RegisteredPanel result={result} onAnother={() => { setResult(null); business.reset(businessDefaults()); owner.reset(emptyOwner); setStep(0); }} />;

  const b = business.watch();
  const o = owner.watch();
  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap gap-2" aria-label="Steps">
        {STEPS.map((s) => (
          <li key={s.id} aria-current={step === s.id ? 'step' : undefined}
            className={cn('flex items-center gap-2 rounded-full border px-3 py-1 text-sm', step === s.id ? 'border-primary bg-primary/10 font-medium text-primary' : step > s.id ? 'text-foreground' : 'text-muted-foreground')}>
            <s.icon className="size-4" />{s.id + 1}. {s.label}
          </li>
        ))}
      </ol>
      <FormAlert messages={messages} />
      <Card>
        <CardContent className="pt-4">
          {step === 0 && <BusinessFields form={business} registering />}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">The person who will run the business. They become its first administrator.</p>
              <OwnerFields register={owner.register as never} errors={owner.formState.errors} />
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <section>
                <h3 className="mb-2 font-semibold">Business</h3>
                <DetailList
                  columns={3}
                  items={[
                    { label: 'Name', value: b.tradingName ? `${b.tradingName} (${b.businessName})` : b.businessName },
                    { label: 'Kind', value: <span>{labels.businessKind[Number(b.kind) as 0 | 1]} <span className="text-xs text-muted-foreground">(fixed once created)</span></span> },
                    { label: 'Sells as', value: labels.businessType[Number(b.businessType) as 0 | 1] },
                    { label: 'KRA PIN', value: b.kraPin },
                    { label: 'VAT registered', value: b.isVatRegistered ? 'Yes' : 'No' },
                    { label: 'M-Pesa short code', value: b.mpesaShortCode || '—' },
                    { label: 'Discount cap', value: b.maxDiscountPercent != null && !Number.isNaN(b.maxDiscountPercent) ? `${b.maxDiscountPercent}%` : 'None' },
                    { label: 'Phone', value: b.phoneNumber || '—' },
                    { label: 'Email', value: b.email || '—' },
                  ]}
                />
              </section>
              <section>
                <h3 className="mb-2 font-semibold">Owner</h3>
                <DetailList
                  columns={3}
                  items={[
                    { label: 'Name', value: o.fullName },
                    { label: 'Email', value: o.email },
                    { label: 'Password', value: o.password ? 'Set by you' : 'Generated, shown once after registering' },
                  ]}
                />
              </section>
              <Alert variant="info"><AlertDescription>The business starts on a trial licence. You won’t be added to it.</AlertDescription></Alert>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0 || submitting} onClick={() => setStep((s) => s - 1)}><ArrowLeft />Back</Button>
        {step < 2
          ? <Button onClick={next}>Next<ArrowRight /></Button>
          : <Button loading={submitting} onClick={submit}>Register business</Button>}
      </div>
    </div>
  );
}

function RegisteredPanel({ result, onAnother }: { result: RegisterBusinessResultDto; onAnother(): void }) {
  const { business, owner, trialLicense } = result;
  return (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-success" />{business.tradingName || business.businessName} is registered</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <DetailList
          columns={2}
          items={[
            { label: 'Owner', value: `${owner.fullName} · ${owner.email}` },
            { label: 'Trial ends', value: trialLicense ? formatDateOnly(trialLicense.endsOn) : 'No trial: issue a licence' },
          ]}
        />
        {owner.created ? (
          owner.temporaryPassword
            ? <OneTimePasswordPanel email={owner.email} password={owner.temporaryPassword} />
            : <Alert variant="info"><AlertDescription>A new account was created with the password you set. They will be asked to change it at first sign-in.</AlertDescription></Alert>
        ) : (
          <Alert variant="info"><UserRoundCheck /><AlertDescription>Added to an existing account. {owner.fullName} signs in with their usual password and can switch to this business.</AlertDescription></Alert>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link href={`/platform/businesses/${business.businessId}`}>Open business</Link></Button>
          <Button variant="outline" onClick={onAnother}>Register another</Button>
        </div>
      </CardContent>
    </Card>
  );
}
