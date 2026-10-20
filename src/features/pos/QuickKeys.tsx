'use client';

import { toast } from 'sonner';
import { Pin, PinOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/overlays';
import { usePreferences, type QuickKey } from '@/stores/preferences';
import type { CartLine } from '@/stores/cart';
import { containerOf } from './cartActions';

const NO_KEYS: QuickKey[] = [];

export const sameKey = (a: Pick<QuickKey, 'productId' | 'unitOfMeasureId'>, b: Pick<QuickKey, 'productId' | 'unitOfMeasureId'>) =>
  a.productId === b.productId && a.unitOfMeasureId === b.unitOfMeasureId;

export function useQuickKeys(businessId: string): QuickKey[] {
  return usePreferences((s) => s.quickKeys[businessId]) ?? NO_KEYS;
}

function saveQuickKeys(businessId: string, keys: QuickKey[]) {
  const { quickKeys, set } = usePreferences.getState();
  set('quickKeys', { ...quickKeys, [businessId]: keys });
}

/** One-tap buttons for a product in one unit (1L, 10L and 20L refills of the same water). Pinned from a cart line. */
export function QuickKeys({ businessId, onAdd }: { businessId: string; onAdd(k: QuickKey): void }) {
  const keys = useQuickKeys(businessId);
  if (keys.length === 0) return null;
  return (
    <div className="flex flex-wrap items-start gap-2" role="group" aria-label="Quick keys">
      {keys.map((k) => (
        <div key={`${k.productId}:${k.unitOfMeasureId}`} className="group relative">
          <button
            type="button"
            onClick={() => onAdd(k)}
            className="flex min-h-16 min-w-24 flex-col items-center justify-center rounded-lg border-2 border-primary/40 bg-primary/5 px-3 py-2 text-center transition-colors hover:border-primary hover:bg-primary/10 active:scale-[0.98]"
          >
            <span className="text-xl font-bold leading-none">{k.unitSymbol}</span>
            <span className="mt-1 line-clamp-1 max-w-32 text-xs text-muted-foreground">{k.productName}</span>
          </button>
          <button
            type="button"
            onClick={() => saveQuickKeys(businessId, keys.filter((x) => !sameKey(x, k)))}
            className="absolute -right-1.5 -top-1.5 hidden size-5 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm hover:text-destructive focus-visible:flex group-hover:flex"
            aria-label={`Remove quick key ${k.productName} ${k.unitSymbol}`}
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Pins (or unpins) the line's product in its current unit as a quick key on this device. */
export function QuickKeyToggle({ businessId, line }: { businessId: string; line: Pick<CartLine, 'productId' | 'productName' | 'unitOfMeasureId' | 'units'> }) {
  const keys = useQuickKeys(businessId);
  const pinned = keys.some((k) => sameKey(k, line));
  const symbol = line.units.find((u) => u.unitOfMeasureId === line.unitOfMeasureId)?.symbol ?? '';
  function toggle() {
    if (pinned) return saveQuickKeys(businessId, keys.filter((k) => !sameKey(k, line)));
    saveQuickKeys(businessId, [...keys, { productId: line.productId, unitOfMeasureId: line.unitOfMeasureId, productName: line.productName, unitSymbol: symbol }]);
    toast.success(`${line.productName} (${symbol}) added to quick keys`);
  }
  const label = pinned ? `Remove ${symbol} from quick keys` : `Pin ${symbol} as a quick key`;
  return (
    <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label={label} title={label} className={pinned ? 'text-primary' : 'text-muted-foreground'}>
      {pinned ? <PinOff /> : <Pin />}
    </Button>
  );
}

/**
 * "Customer has a container?" Shown when a line's size is sold with a container (set on the product's pack unit). Off: the container
 * lines are added beside the refills.
 */
export function ContainerToggle({ lines, needsContainer, onChange }: {
  lines: Pick<CartLine, 'unitOfMeasureId' | 'units'>[];
  needsContainer: boolean;
  onChange(needsContainer: boolean): void;
}) {
  const applies = lines.some((l) => !!containerOf(l));
  if (!applies) return null;
  return (
    <label className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <span>
        <span className="font-medium">Customer has a container</span>
        <span className="block text-xs text-muted-foreground">{needsContainer ? 'Selling a container with each refill.' : 'Refill only.'}</span>
      </span>
      <Switch checked={!needsContainer} onCheckedChange={(v) => onChange(!v)} aria-label="Customer has a container" />
    </label>
  );
}
