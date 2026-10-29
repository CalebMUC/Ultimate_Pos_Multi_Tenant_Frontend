'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, Input } from '@/components/ui/primitives';
import { EntityCombobox } from '@/components/shared/EntityCombobox';
import type { EtimsItemClassDto } from '@/api/dto/etims';
import { isNotFound, useListsDevice } from './etims';
import { useEtimsScope } from './scope';

interface ItemClassPickerProps {
  value: string | null;
  onChange(code: string | null): void;
  /** Offers an empty choice with this label (e.g. "Use the category's"). Without it a code is required. */
  emptyLabel?: string;
  invalid?: boolean;
  // Set by <Field>.
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

/**
 * KRA's item classification: a search over the list the first active device downloaded. Before any device has downloaded KRA's
 * lists, the code is typed as it is.
 */
export function ItemClassPicker({ value, onChange, emptyLabel, id, ...rest }: ItemClassPickerProps) {
  const invalid = rest.invalid || rest['aria-invalid'];
  const { calls, resource } = useEtimsScope();
  const device = useListsDevice();
  // The device says it has the lists but the API has none (404): type the code instead.
  const [missing, setMissing] = useState(false);

  if (!device?.lastCodeSyncAt || missing) {
    return (
      <Input
        id={id}
        aria-describedby={rest['aria-describedby']}
        aria-invalid={invalid || undefined}
        inputMode="numeric"
        placeholder={emptyLabel ?? 'e.g. 1010160100'}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value.trim() || null)}
      />
    );
  }

  return (
    <EntityCombobox<EtimsItemClassDto>
      resource={resource}
      params={{ itemClasses: device.etimsDeviceId }}
      fetcher={async (search, signal) => {
        try {
          return await calls.itemClasses(device.etimsDeviceId, search, 50, signal);
        } catch (e) {
          if (isNotFound(e)) setMissing(true);
          throw e;
        }
      }}
      getId={(c) => c.itemClassCode}
      getLabel={(c) => `${c.itemClassCode} — ${c.itemClassName}`}
      renderItem={(c) => (
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0"><span className="font-mono text-xs">{c.itemClassCode}</span> — {c.itemClassName}</span>
          {c.taxTypeCode && <Badge variant="outline" className="shrink-0">Tax {c.taxTypeCode}</Badge>}
        </span>
      )}
      value={value}
      selectedLabel={value}
      onChange={(code) => onChange(code)}
      placeholder={emptyLabel ?? 'Search KRA’s classifications…'}
      searchPlaceholder="Code or name, e.g. soap"
      clearable={!!emptyLabel}
      invalid={invalid}
      footer={emptyLabel && value ? <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={() => onChange(null)}>{emptyLabel}</Button> : undefined}
    />
  );
}
