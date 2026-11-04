'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Landmark, UserRound, UserRoundCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { DetailList } from '@/components/shared/Display';
import { FormAlert } from '@/components/shared/States';
import { businessesApi } from '@/api/endpoints/business';
import { normaliseError } from '@/api/errors';
import { labels, sectorLabel } from '@/api/enums';
import { sectorProfile } from '@/config/sectors';
import { formatDateOnly } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BusinessFields, businessDefaults, businessSchema, toBusinessRequest, type BusinessValues } from '@/features/admin/BusinessForm';
import {
  allBlank, applyInvoiceErrors, emptyInvoiceDetails, InvoiceDetailsFields, invoiceDetailsSchema, toInvoiceSettings, type InvoiceDetailsValues,
} from '@/features/invoices/InvoiceDetailsFields';
import { sendPaymentTo } from '@/features/invoices/paymentDetails';
import { SendPaymentTo } from '@/features/invoices/SendPaymentTo';
import type { RegisterBusinessResultDto } from '@/api/dto/platform';
import { OneTimePasswordPanel } from './OneTimePassword';
import { emptyOwner, OwnerFields, ownerSchema, toOwnerRequest, type OwnerValues } from './OwnerFields';

const STEPS = [
  { id: 0, label: 'Business', icon: Building2 },
  { id: 1, label: 'Payment details', icon: Landmark },
  { id: 2, label: 'Owner', icon: UserRound },
  { id: 3, label: 'Review', icon: CheckCircle2 },
] as const;
const PAYMENT_STEP = 1;
const OWNER_STEP = 2;
const REVIEW_STEP = 3;

/** Registers a business with its owner, who becomes its first Admin. The Super User doesn't join it. */
export function RegisterBusinessWizard() {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegisterBusinessResultDto | null>(null);
  const business = useForm<BusinessValues>({ resolver: zodResolver(businessSchema), defaultValues: businessDefaults() });
  const owner = useForm<OwnerValues>({ resolver: zodResolver(ownerSchema), defaultValues: emptyOwner });
  const invoice = useForm<InvoiceDetailsValues>({ resolver: zodResolver(invoiceDetailsSchema), defaultValues: emptyInvoiceDetails });

  async function next() {
    if (step === 0 && !(await business.trigger())) return;
    if (step === PAYMENT_STEP && !(await invoice.trigger())) return;
    if (step === OWNER_STEP && !(await owner.trigger())) return;
    setStep((s) => Math.min(REVIEW_STEP, s + 1));
  }

  /** The owner has no bank details yet: nothing is sent, and they add them later in Settings. */
  function addLater() {
    invoice.reset(emptyInvoiceDetails);
    setStep(OWNER_STEP);
  }

  async function submit() {
    setMessages([]);
    setSubmitting(true);
    try {
      // getValues() gives the raw inputs (select values are strings); the schema turns them into the numbers the API expects.
      const b = businessSchema.parse(business.getValues());
      const payment = toInvoiceSettings(invoice.getValues());
      const created = await businessesApi.register({
        ...toBusinessRequest(b), kind: b.kind, sector: b.sector, etimsEnabled: b.etimsEnabled, owner: toOwnerRequest(owner.getValues()),
        invoice: allBlank(payment) ? null : payment,
      });
      setResult(created);
      await qc.invalidateQueries({ queryKey: ['platform'] });
      toast.success(`${created.business.businessName} registered`);
    } catch (e) {
      // Put each field error on its step: "owner.email" belongs to the owner, bankName and the other payment details to the payment
      // step, the rest to the business profile.
      const apiError = normaliseError(e);
      let firstStep: number | null = null;
      const unmatched: string[] = [];
      const earliest = (n: number) => { firstStep = firstStep === null ? n : Math.min(firstStep, n); };
      for (const [path, msgs] of Object.entries(apiError.fieldErrors)) {
        if (path === 'owner' || path.startsWith('owner.')) {
          const field = path.slice('owner.'.length) as keyof OwnerValues;
          if (field && field in emptyOwner) owner.setError(field, { type: 'server', message: msgs.join(' ') });
          else unmatched.push(...msgs);
          earliest(OWNER_STEP);
        } else if (path.replace(/^invoice\./, '') in emptyInvoiceDetails) {
          applyInvoiceErrors(invoice, { [path]: msgs });
          earliest(PAYMENT_STEP);
        } else if (path in businessDefaults()) {
          business.setError(path as keyof BusinessValues, { type: 'server', message: msgs.join(' ') });
          earliest(0);
        } else unmatched.push(...msgs);
      }
      if (firstStep !== null) setStep(firstStep);
      setMessages(unmatched.length ? unmatched : apiError.hasFieldErrors() ? [] : [apiError.message]);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return <RegisteredPanel result={result} onAnother={() => { setResult(null); business.reset(businessDefaults()); invoice.reset(emptyInvoiceDetails); owner.reset(emptyOwner); setStep(0); }} />;
  }

  const b = business.watch();
  const o = owner.watch();
  const pay = toInvoiceSettings(invoice.watch());
  // No invoice date yet, so days to pay are listed as they are rather than as a due date.
  const payBlock = sendPaymentTo(pay, null);
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
          {step === PAYMENT_STEP && (
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold">Payment details (for invoices)</h3>
                <p className="text-sm text-muted-foreground">
                  Optional. Where credit customers send the money, printed on every invoice. Separate from the M-Pesa till and paybill above,
                  which bring payments into the till. The owner can add or change them later in Settings.
                </p>
              </div>
              <InvoiceDetailsFields form={invoice} />
            </div>
          )}
          {step === OWNER_STEP && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">The person who will run the business. They become its first administrator.</p>
              <OwnerFields register={owner.register as never} errors={owner.formState.errors} />
            </div>
          )}
          {step === REVIEW_STEP && (
            <div className="space-y-4">
              <section>
                <h3 className="mb-2 font-semibold">Business</h3>
                <DetailList
                  columns={3}
                  items={[
                    { label: 'Name', value: b.tradingName ? `${b.tradingName} (${b.businessName})` : b.businessName },
                    { label: 'Sector', value: sectorLabel(Number(b.sector)) },
                    { label: 'Kind', value: <span>{labels.businessKind[Number(b.kind) as 0 | 1]} <span className="text-xs text-muted-foreground">(fixed once created)</span></span> },
                    { label: 'Sells as', value: labels.businessType[Number(b.businessType) as 0 | 1] },
                    { label: 'KRA PIN', value: b.kraPin },
                    { label: 'VAT registered', value: b.isVatRegistered ? 'Yes' : 'No' },
                    { label: 'KRA eTIMS', value: b.etimsEnabled ? 'On' : 'Off' },
                    { label: 'M-Pesa till', value: b.mpesaTillNumber || '—' },
                    { label: 'M-Pesa paybill', value: b.mpesaPaybillNumber || '—' },
                    { label: 'Discount cap', value: b.maxDiscountPercent != null && !Number.isNaN(b.maxDiscountPercent) ? `${b.maxDiscountPercent}%` : 'None' },
                    { label: 'Selling below zero stock', value: b.allowNegativeStock ? 'Allowed' : 'Refused' },
                    { label: 'Phone', value: b.phoneNumber || '—' },
                    { label: 'Email', value: b.email || '—' },
                  ]}
                />
              </section>
              <section aria-label="Payment details review">
                {payBlock || pay.dueDays !== null || pay.note ? (
                  <div className="max-w-md rounded-md border bg-white p-3 text-[13px] text-neutral-900">
                    {payBlock
                      ? <SendPaymentTo block={payBlock} variant="invoice" />
                      : <h3 className="text-sm font-extrabold uppercase tracking-wide">Send payment to:</h3>}
                    {pay.dueDays !== null && <p className="mt-1.5 text-neutral-700">Days to pay: {pay.dueDays}</p>}
                    {!payBlock && pay.note && <p className="mt-1 text-xs text-neutral-700">{pay.note}</p>}
                    {!payBlock && <p className="mt-1 text-xs text-neutral-500">No bank, till or phone yet, so invoices leave this block off.</p>}
                  </div>
                ) : (
                  <>
                    <h3 className="mb-1 font-semibold">Send payment to</h3>
                    <p className="text-sm text-muted-foreground">Added later: the owner can set them in Settings → Invoices.</p>
                  </>
                )}
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
        <div className="flex gap-2">
          {step === PAYMENT_STEP && <Button variant="ghost" onClick={addLater}>Add later</Button>}
          {step < REVIEW_STEP
            ? <Button onClick={next}>Next<ArrowRight /></Button>
            : <Button loading={submitting} onClick={submit}>Register business</Button>}
        </div>
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
            { label: 'Sector', value: `${sectorLabel(business.sector)} · ${labels.businessKind[business.kind]}` },
            { label: 'KRA eTIMS', value: business.etimsEnabled ? 'On: its admin registers each branch’s device' : 'Off' },
          ]}
        />
        <p className="text-sm text-muted-foreground">
          Starts with the standard units and expense categories{sectorProfile(business.sector).startsWith ? `, plus ${lowerFirst(sectorProfile(business.sector).startsWith!)}` : '.'}
        </p>
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

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
