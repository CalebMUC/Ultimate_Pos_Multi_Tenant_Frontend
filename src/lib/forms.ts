import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiError, normaliseError } from '@/api/errors';

/**
 * Puts the API's field errors beside their inputs, including nested paths like prescription.patientName and lines.0.quantity.
 * Returns the messages that matched no form field, so the caller can show them in the form alert.
 */
export function applyApiErrors<T extends FieldValues>(form: UseFormReturn<T>, error: unknown, knownFields?: readonly string[]): string[] {
  const apiError = normaliseError(error);
  const unmatched: string[] = [];
  const registered = knownFields ?? Object.keys(form.getValues() ?? {});
  for (const [path, messages] of Object.entries(apiError.fieldErrors)) {
    const root = path.split('.')[0];
    if (registered.includes(root)) {
      form.setError(path as Path<T>, { type: 'server', message: messages.join(' ') }, { shouldFocus: true });
    } else {
      unmatched.push(...messages);
    }
  }
  return unmatched;
}

/** Shows an error as a toast. 403s and conflicts keep the user where they are. */
export function toastError(error: unknown, fallback = 'Something went wrong.') {
  const apiError = error instanceof ApiError ? error : normaliseError(error);
  if (apiError.code === 'CANCELLED') return;
  toast.error(apiError.message || fallback);
}
