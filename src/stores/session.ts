import { create } from 'zustand';
import type { BusinessDto } from '@/api/dto/business';
import type { BusinessMembershipDto, UserDto } from '@/api/dto/identity';
import type { Guid } from '@/api/dto/common';

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

  setAuthenticated(payload: {
    accessToken: string;
    expiresAt: string;
    user: UserDto;
    activeBusinessId: Guid | null;
    businesses: BusinessMembershipDto[];
  }): void;
  setBusiness(business: BusinessDto | null): void;
  setUser(user: UserDto, businesses: BusinessMembershipDto[], activeBusinessId: Guid | null): void;
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

  setAuthenticated: ({ accessToken, expiresAt, user, activeBusinessId, businesses }) =>
    set((state) => ({
      status: 'authenticated',
      accessToken,
      expiresAt,
      user,
      activeBusinessId,
      businesses,
      // Keep the loaded profile only if the business did not change.
      business: state.business && state.business.businessId === activeBusinessId ? state.business : null,
    })),
  setBusiness: (business) => set({ business }),
  setUser: (user, businesses, activeBusinessId) => set({ user, businesses, activeBusinessId }),
  clear: () =>
    set({ status: 'anonymous', accessToken: null, expiresAt: null, user: null, activeBusinessId: null, businesses: [], business: null }),
}));

export const sessionSelectors = {
  permissions: (s: SessionState) => s.user?.permissions ?? [],
};
