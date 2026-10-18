import { create } from 'zustand';
import type { BusinessDto } from '@/api/dto/business';
import type { BusinessMembershipDto, UserDto } from '@/api/dto/identity';
import type { Guid } from '@/api/dto/common';
import { PLATFORM_PERMISSIONS } from '@/api/permissions';

export type SessionStatus = 'booting' | 'anonymous' | 'authenticated';

interface SessionState {
  status: SessionStatus;
  /** In memory only. */
  accessToken: string | null;
  expiresAt: string | null;
  user: UserDto | null;
  activeBusinessId: Guid | null;
  businesses: BusinessMembershipDto[];
  /** GET /businesses/current, loaded after sign-in and after every switch. */
  business: BusinessDto | null;
  /** Someone else set the password: nothing else is usable until it is changed. */
  mustChangePassword: boolean;

  setAuthenticated(payload: {
    accessToken: string;
    expiresAt: string;
    user: UserDto;
    activeBusinessId: Guid | null;
    businesses: BusinessMembershipDto[];
    mustChangePassword?: boolean;
  }): void;
  setBusiness(business: BusinessDto | null): void;
  setUser(user: UserDto, businesses: BusinessMembershipDto[], activeBusinessId: Guid | null, mustChangePassword?: boolean): void;
  clear(): void;
}

export const useSession = create<SessionState>((set) => ({
  status: 'booting',
  accessToken: null,
  expiresAt: null,
  user: null,
  activeBusinessId: null,
  businesses: [],
  business: null,
  mustChangePassword: false,

  setAuthenticated: ({ accessToken, expiresAt, user, activeBusinessId, businesses, mustChangePassword }) =>
    set((state) => ({
      status: 'authenticated',
      accessToken,
      expiresAt,
      user,
      activeBusinessId,
      businesses,
      mustChangePassword: !!mustChangePassword,
      // Keep the loaded profile only if the business did not change.
      business: state.business && state.business.businessId === activeBusinessId ? state.business : null,
    })),
  setBusiness: (business) => set({ business }),
  setUser: (user, businesses, activeBusinessId, mustChangePassword) =>
    set((s) => ({ user, businesses, activeBusinessId, mustChangePassword: mustChangePassword ?? s.mustChangePassword })),
  clear: () =>
    set({ status: 'anonymous', accessToken: null, expiresAt: null, user: null, activeBusinessId: null, businesses: [], business: null, mustChangePassword: false }),
}));

export const sessionSelectors = {
  permissions: (s: SessionState) => s.user?.permissions ?? [],
  /** A Super User: platform permissions and no business. */
  isPlatformUser: (s: SessionState) => !s.activeBusinessId && (s.user?.permissions ?? []).some((p) => (PLATFORM_PERMISSIONS as readonly string[]).includes(p)),
};
