'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, NativeSelect } from '@/components/ui/primitives';
import { Switch } from '@/components/ui/overlays';
import { PageHeader } from '@/components/shared/Display';
import { getStorageMode, tokenStorage, type RefreshTokenStorageMode } from '@/api/tokenStorage';
import { usePreferences, type ReceiptPaper, type ScannerSuffix, type Theme } from '@/stores/preferences';

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div><Label>{label}</Label>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
      <div className="sm:w-64">{children}</div>
    </div>
  );
}

/** Preferences for this device. Business-wide settings live in Business Profile. */
export default function SettingsPage() {
  const p = usePreferences();
  const [mode, setMode] = useState<RefreshTokenStorageMode>(() => getStorageMode());
  const [quick, setQuick] = useState(p.quickCashAmounts.join(', '));
  return (
    <>
      <PageHeader title="Settings" description="Preferences for this device and browser." />
      <div className="grid max-w-3xl gap-4">
        <Card>
          <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
          <CardContent className="divide-y">
            <Row label="Theme">
              <NativeSelect value={p.theme} onChange={(e) => p.set('theme', e.target.value as Theme)}>
                <option value="system">Match device</option><option value="light">Light</option><option value="dark">Dark</option>
              </NativeSelect>
            </Row>
            <Row label="Pharmacy menu" hint="Automatic shows it once the business has batch-tracked or prescription products.">
              <NativeSelect value={p.showPharmacyMenu === null ? 'auto' : p.showPharmacyMenu ? 'on' : 'off'} onChange={(e) => p.set('showPharmacyMenu', e.target.value === 'auto' ? null : e.target.value === 'on')}>
                <option value="auto">Automatic</option><option value="on">Always show</option><option value="off">Hide</option>
              </NativeSelect>
            </Row>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Point of sale</CardTitle><CardDescription>How this till behaves.</CardDescription></CardHeader>
          <CardContent className="divide-y">
            <Row label="Receipt paper">
              <NativeSelect value={p.receiptPaper} onChange={(e) => p.set('receiptPaper', e.target.value as ReceiptPaper)}>
                <option value="80mm">80 mm thermal</option><option value="a4">A4</option>
              </NativeSelect>
            </Row>
            <Row label="Quick cash buttons" hint="Amounts in KES, separated by commas.">
              <Input
                value={quick}
                onChange={(e) => setQuick(e.target.value)}
                onBlur={() => {
                  const amounts = quick.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, 8);
                  p.set('quickCashAmounts', amounts);
                  setQuick(amounts.join(', '));
                }}
              />
            </Row>
            <Row label="M-Pesa prompt timeout" hint="Seconds to wait for the customer before offering to check manually.">
              <Input type="number" min={30} max={600} value={p.stkTimeoutSeconds} onChange={(e) => p.set('stkTimeoutSeconds', Math.min(600, Math.max(30, Number(e.target.value) || 120)))} />
            </Row>
            <Row label="Barcode scanner ends with" hint="Most scanners send Enter after the code.">
              <NativeSelect value={p.scannerSuffix} onChange={(e) => p.set('scannerSuffix', e.target.value as ScannerSuffix)}>
                <option value="Enter">Enter</option><option value="Tab">Tab</option>
              </NativeSelect>
            </Row>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Security</CardTitle></CardHeader>
          <CardContent>
            <Row label="Shared till" hint="Forget the sign-in when this browser tab closes. Use on shared computers.">
              <Switch
                checked={mode === 'session'}
                onCheckedChange={(v) => {
                  const next: RefreshTokenStorageMode = v ? 'session' : 'local';
                  tokenStorage.setMode(next);
                  setMode(next);
                }}
              />
            </Row>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
