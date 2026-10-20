'use client';

import { z } from 'zod';
import type { UseFormReturn } from 'react-hook-form';
import { Input, NativeSelect, Textarea } from '@/components/ui/primitives';
import { Switch } from '@/components/ui/overlays';
import { Field } from '@/components/shared/Field';
import { BusinessKind, BusinessSector, BusinessType, enumOptions, labels, sectorLabel } from '@/api/enums';
import { sectorProfile } from '@/config/sectors';
import { email, optionalNumber, phone, requiredText, text } from '@/lib/schemas';
import { emptyToNull } from '@/lib/utils';
import type { BusinessDto, UpdateBusinessRequestDto } from '@/api/dto/business';

const url = z.string().trim().max(500).refine((v) => v === '' || /^https?:\/\//i.test(v), 'Use a full link starting with https://');

export const businessSchema = z.object({
  businessName: requiredText('Business name', 200),
  tradingName: text(200),
  // Empty until chosen when registering a General or Agrovet business: those can be either.
  kind: z.union([z.number(), z.string()]).refine((v) => v !== '', 'Choose Manufacturer or Trader.').transform(Number).pipe(z.nativeEnum(BusinessKind)),
  sector: z.coerce.number().pipe(z.nativeEnum(BusinessSector)),
  businessType: z.coerce.number().pipe(z.nativeEnum(BusinessType)),
  registrationNumber: text(50),
  kraPin: z.string().trim().toUpperCase().regex(/^[A-Z]\d{9}[A-Z]$/, 'A KRA PIN looks like P051234567X.'),
  physicalAddress: text(300),
  county: text(50),
  phoneNumber: phone,
  email,
  logoUrl: url,
  backgroundImageUrl: url,
  isVatRegistered: z.boolean(),
  mpesaShortCode: z.string().trim().refine((v) => v === '' || /^\d{5,7}$/.test(v), 'A till or paybill number is 5–7 digits.'),
  maxDiscountPercent: optionalNumber({ min: 0, max: 100, label: 'Discount cap' }),
  allowNegativeStock: z.boolean(),
});
export type BusinessValues = z.infer<typeof businessSchema>;

export function businessDefaults(b?: BusinessDto | null): BusinessValues {
  return {
    businessName: b?.businessName ?? '',
    tradingName: b?.tradingName ?? '',
    // Registering: General, which suggests no kind. Editing: what it is.
    kind: b ? b.kind : ('' as unknown as BusinessKind),
    sector: b?.sector ?? BusinessSector.General,
    businessType: b?.businessType ?? BusinessType.Retailer,
    registrationNumber: b?.registrationNumber ?? '',
    kraPin: b?.kraPin ?? '',
    physicalAddress: b?.physicalAddress ?? '',
    county: b?.county ?? '',
    phoneNumber: b?.phoneNumber ?? '',
    email: b?.email ?? '',
    logoUrl: b?.logoUrl ?? '',
    backgroundImageUrl: b?.backgroundImageUrl ?? '',
    isVatRegistered: b?.isVatRegistered ?? false,
    mpesaShortCode: b?.mpesaShortCode ?? '',
    maxDiscountPercent: b?.maxDiscountPercent ?? null,
    allowNegativeStock: b?.allowNegativeStock ?? true,
  };
}

export function toBusinessRequest(v: BusinessValues): UpdateBusinessRequestDto {
  return {
    businessName: v.businessName,
    tradingName: emptyToNull(v.tradingName),
    businessType: v.businessType,
    registrationNumber: emptyToNull(v.registrationNumber),
    kraPin: v.kraPin,
    physicalAddress: emptyToNull(v.physicalAddress),
    county: emptyToNull(v.county),
    phoneNumber: emptyToNull(v.phoneNumber),
    email: emptyToNull(v.email),
    logoUrl: emptyToNull(v.logoUrl),
    backgroundImageUrl: emptyToNull(v.backgroundImageUrl),
    isVatRegistered: v.isVatRegistered,
    mpesaShortCode: emptyToNull(v.mpesaShortCode),
    maxDiscountPercent: v.maxDiscountPercent,
    allowNegativeStock: v.allowNegativeStock,
  };
}

/** The business profile fields. Kind can only be chosen when registering. */
export function BusinessFields({ form, registering }: { form: UseFormReturn<BusinessValues>; registering: boolean }) {
  const e = form.formState.errors;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Registered name" required error={e.businessName}><Input {...form.register('businessName')} /></Field>
      <Field label="Trading name" error={e.tradingName}><Input {...form.register('tradingName')} /></Field>
      <Field label="KRA PIN" required error={e.kraPin}><Input className="uppercase" {...form.register('kraPin')} /></Field>
      <Field label="Sector" error={e.sector} hint={registering ? 'Decides its menus and what it starts with.' : 'Set by the platform.'}>
        {registering ? (
          <NativeSelect
            {...form.register('sector', {
              // A sector suggests a kind and an overselling default (both still editable).
              onChange: (ev: { target: { value: string } }) => {
                const profile = sectorProfile(Number(ev.target.value));
                if (profile.kind !== null) form.setValue('kind', profile.kind, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
                form.setValue('allowNegativeStock', profile.allowNegativeStock, { shouldDirty: true });
              },
            })}
          >
            {enumOptions(labels.businessSector).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </NativeSelect>
        ) : (
          <Input readOnly className="bg-muted" value={sectorLabel(form.getValues('sector'))} />
        )}
      </Field>
      <Field label="Kind" required={registering} error={e.kind} hint={registering ? 'Manufacturers get Production. This can’t change later.' : 'Fixed when the business was registered.'}>
        {registering ? (
          <NativeSelect {...form.register('kind')}>
            <option value="">Choose…</option>
            {enumOptions(labels.businessKind).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </NativeSelect>
        ) : (
          <Input readOnly className="bg-muted" value={labels.businessKind[form.getValues('kind')]} />
        )}
      </Field>
      <Field label="Sells as" error={e.businessType} hint="Sets the default price list.">
        <NativeSelect {...form.register('businessType')}>{enumOptions(labels.businessType).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
      </Field>
      <Field label="Registration no." error={e.registrationNumber}><Input {...form.register('registrationNumber')} /></Field>
      <Field label="Phone" error={e.phoneNumber}><Input type="tel" {...form.register('phoneNumber')} /></Field>
      <Field label="Email" error={e.email}><Input type="email" {...form.register('email')} /></Field>
      <Field label="County" error={e.county}><Input {...form.register('county')} /></Field>
      <Field label="Address" error={e.physicalAddress} className="sm:col-span-2 lg:col-span-3"><Textarea {...form.register('physicalAddress')} /></Field>
      <Field label="M-Pesa till / paybill" error={e.mpesaShortCode} hint="Till payments are routed to the business by this number."><Input inputMode="numeric" {...form.register('mpesaShortCode')} /></Field>
      <Field label="Max discount per sale (%)" error={e.maxDiscountPercent} hint="Empty for no cap."><Input type="number" step="0.1" min={0} max={100} {...form.register('maxDiscountPercent', { valueAsNumber: true })} /></Field>
      <Field label="VAT" error={e.isVatRegistered}>
        <label className="flex h-9 items-center gap-2 text-sm">
          <Switch checked={form.watch('isVatRegistered')} onCheckedChange={(v) => form.setValue('isVatRegistered', v, { shouldDirty: true })} />
          VAT registered (receipts show VAT)
        </label>
      </Field>
      <Field label="Stock" error={e.allowNegativeStock} hint={form.watch('allowNegativeStock') ? 'Sales go through even when stock shows less than is sold.' : 'A sale needing more than is in stock is refused.'}>
        <label className="flex h-9 items-center gap-2 text-sm">
          <Switch checked={form.watch('allowNegativeStock')} onCheckedChange={(v) => form.setValue('allowNegativeStock', v, { shouldDirty: true })} />
          Allow selling below zero stock
        </label>
      </Field>
      <Field label="Logo link" error={e.logoUrl} className="sm:col-span-2"><Input type="url" placeholder="https://…" {...form.register('logoUrl')} /></Field>
      <Field label="Login background link" error={e.backgroundImageUrl}><Input type="url" placeholder="https://…" {...form.register('backgroundImageUrl')} /></Field>
    </div>
  );
}
