import { z } from 'zod';

// Shared zod pieces. Optional text fields stay strings in the form and become null on submit (emptyToNull).
export const text = (max = 200) => z.string().trim().max(max, `At most ${max} characters.`);
export const requiredText = (label: string, max = 200) => z.string().trim().min(1, `${label} is required.`).max(max, `At most ${max} characters.`);

/** KRA PIN: a letter, nine digits, a letter (A123456789Z). */
export const kraPin = z.string().trim().toUpperCase().refine((v) => v === '' || /^[A-Z]\d{9}[A-Z]$/.test(v), 'A KRA PIN looks like A123456789Z.');
export const email = z.string().trim().refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email address.');
export const phone = z.string().trim().refine((v) => v === '' || /^\+?[\d\s-]{9,15}$/.test(v), 'Enter a valid phone number.');

/** A number input: '' means "not given". */
export const optionalNumber = (opts: { min?: number; max?: number; label?: string } = {}) =>
  z
    .union([z.number(), z.nan(), z.literal(''), z.null(), z.undefined()])
    .transform((v) => (v === '' || v === null || v === undefined || Number.isNaN(v) ? null : v))
    .refine((v) => v === null || opts.min === undefined || v >= opts.min, `${opts.label ?? 'Value'} must be at least ${opts.min}.`)
    .refine((v) => v === null || opts.max === undefined || v <= opts.max, `${opts.label ?? 'Value'} must be at most ${opts.max}.`);

export const requiredNumber = (label: string, opts: { min?: number; gt?: number; max?: number } = {}) => {
  let n = z.number({ invalid_type_error: `${label} is required.`, required_error: `${label} is required.` });
  if (opts.min !== undefined) n = n.min(opts.min, `${label} must be at least ${opts.min}.`);
  if (opts.gt !== undefined) n = n.gt(opts.gt, `${label} must be more than ${opts.gt}.`);
  if (opts.max !== undefined) n = n.max(opts.max, `${label} must be at most ${opts.max}.`);
  return n;
};

export const requiredId = (label: string) => z.string().min(1, `Select a ${label.toLowerCase()}.`);
