'use client';

import { z } from 'zod';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/primitives';
import { Field } from '@/components/shared/Field';
import { passwordRule } from '@/features/auth/ChangePasswordDialog';
import { emptyToNull } from '@/lib/utils';
import type { BusinessOwnerRequestDto } from '@/api/dto/platform';

export const ownerSchema = z.object({
  fullName: z.string().trim().min(1, 'The full name is required.').max(150),
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
  phoneNumber: z.string().trim().refine((v) => v === '' || /^\+?[\d\s-]{9,15}$/.test(v), 'Enter a valid phone number.'),
  /** Optional: without one the API generates a temporary password and returns it once. */
  password: z.union([z.literal(''), passwordRule]),
});
export type OwnerValues = z.infer<typeof ownerSchema>;

export const emptyOwner: OwnerValues = { fullName: '', email: '', phoneNumber: '', password: '' };

export function toOwnerRequest(v: OwnerValues): BusinessOwnerRequestDto {
  return { fullName: v.fullName.trim(), email: v.email.trim(), phoneNumber: emptyToNull(v.phoneNumber), password: v.password || null };
}

/** Name, email, phone and an optional password. An email that already has an account adds that account instead. */
export function OwnerFields({ register, errors, prefix }: {
  // Works inside the register wizard (fields under "owner.") and on its own.
  register: UseFormRegister<never>;
  errors: FieldErrors<OwnerValues> | undefined;
  prefix?: string;
}) {
  const name = (field: keyof OwnerValues) => (prefix ? `${prefix}.${field}` : field) as never;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Full name" required error={errors?.fullName}><Input autoComplete="off" {...register(name('fullName'))} /></Field>
      <Field label="Email" required error={errors?.email} hint="If this email already has an account, that person is added instead.">
        <Input type="email" autoComplete="off" {...register(name('email'))} />
      </Field>
      <Field label="Phone" error={errors?.phoneNumber}><Input type="tel" {...register(name('phoneNumber'))} /></Field>
      <Field label="Password (optional)" error={errors?.password} hint="Leave empty to generate a temporary one. Either way they must change it at first sign-in.">
        <Input type="password" autoComplete="new-password" {...register(name('password'))} />
      </Field>
    </div>
  );
}
