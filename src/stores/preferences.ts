import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Client-side preferences only. Business settings (VAT, short code, discount cap) live on the business profile.
export type Theme = 'light' | 'dark' | 'system';
export type ReceiptPaper = '80mm' | 'a4';
export type ScannerSuffix = 'Enter' | 'Tab';

interface PreferencesState {
  theme: Theme;
  receiptPaper: ReceiptPaper;
  quickCashAmounts: number[];
  stkTimeoutSeconds: number;
  scannerSuffix: ScannerSuffix;
  /** null = automatic (shown when the business has batch-tracked or prescription products). */
  showPharmacyMenu: boolean | null;
  sidebarCollapsed: boolean;
  set<K extends keyof Omit<PreferencesState, 'set'>>(key: K, value: PreferencesState[K]): void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      receiptPaper: '80mm',
      quickCashAmounts: [50, 100, 200, 500, 1000],
      stkTimeoutSeconds: 120,
      scannerSuffix: 'Enter',
      showPharmacyMenu: null,
      sidebarCollapsed: false,
      set: (key, value) => set({ [key]: value } as Partial<PreferencesState>),
    }),
    { name: 'upos.preferences', storage: createJSONStorage(() => localStorage) },
  ),
);

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', !!dark);
}
