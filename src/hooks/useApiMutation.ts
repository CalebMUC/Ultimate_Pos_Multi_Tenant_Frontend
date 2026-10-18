'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toastError } from '@/lib/forms';

interface Options<TData> {
  /** Resource prefixes to invalidate on success, e.g. ['products', 'stock']. */
  invalidate?: string[];
  success?: string | ((data: TData) => string);
  /** Toast errors (default). Turn off when the form shows them. */
  toastErrors?: boolean;
  onSuccess?: (data: TData) => void;
}

/** useMutation with the app's conventions: invalidate by resource, toast success, toast errors. */
export function useApiMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>, opts: Options<TData> = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (data) => {
      await Promise.all((opts.invalidate ?? []).map((r) => qc.invalidateQueries({ queryKey: [r] })));
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(data) : opts.success);
      opts.onSuccess?.(data);
    },
    onError: (error) => {
      if (opts.toastErrors !== false) toastError(error);
    },
  });
}
