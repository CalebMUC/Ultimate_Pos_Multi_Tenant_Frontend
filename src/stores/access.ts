import { create } from 'zustand';
import type { AccessCode } from '@/api/dto/platform';

export interface LicenseWarning {
  message: string;
  /** From /auth/me when known (GracePeriod or ExpiringSoon); the header and login give only text. */
  status?: string | null;
}

interface AccessState {
  /** The refusal the blocking screen shows. */
  blocked: { code: AccessCode; message: string | null } | null;
  /** The licence warning for the business signed in to. */
  warning: LicenseWarning | null;
  setBlocked(blocked: AccessState['blocked']): void;
  setWarning(warning: LicenseWarning | null): void;
}

export const useAccess = create<AccessState>((set) => ({
  blocked: null,
  warning: null,
  setBlocked: (blocked) => set({ blocked }),
  setWarning: (warning) =>
    set((s) => (s.warning?.message === warning?.message && s.warning?.status === warning?.status ? s : { warning })),
}));
