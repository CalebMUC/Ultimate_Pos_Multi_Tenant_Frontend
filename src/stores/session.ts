import { create } from 'zustand';
import type { BusinessDto } from '@/api/dto/business';
import type { BusinessMembershipDto, UserDto } from '@/api/dto/identity';
import type { BranchMembershipDto } from '@/api/dto/branches';
import type { Guid } from '@/api/dto/common';
import { PLATFORM_PERMISSIONS } from '@/api/permissions';
import { tokenStorage } from '@/api/tokenStorage';

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
  /** When `business` and `businesses` were last replaced (a sequence, not a clock): the newer one's modules win. */
  businessLoadedAt: number;
  membershipsAt: number;
  /** Someone else set the password: nothing else is usable until it is changed. */
  mustChangePassword: boolean;
  /** The branch the token is for: every write happens here. */
  activeBranchId: Guid | null;
  /** Where the user may work in this business, default first. */
  branches: BranchMembershipDto[];

  setAuthenticated(payload: {
    accessToken: string;
    expiresAt: string;
    user: UserDto;
    activeBusinessId: Guid | null;
    businesses: BusinessMembershipDto[];
    mustChangePassword?: boolean;
    activeBranchId?: Guid | null;
    branches?: BranchMembershipDto[];
  }): void;
  setBusiness(business: BusinessDto | null): void;
  setUser(user: UserDto, businesses: BusinessMembershipDto[], activeBusinessId: Guid | null, mustChangePassword?: boolean, branches?: BranchMembershipDto[]): void;
  clear(): void;
}

let seq = 0;
const next = () => ++seq;

export const useSession = create<SessionState>((set) => ({
  status: 'booting',
  accessToken: null,
  expiresAt: null,
  user: null,
  activeBusinessId: null,
  businesses: [],
  business: null,
  businessLoadedAt: 0,
  membershipsAt: 0,
  mustChangePassword: false,
  activeBranchId: null,
  branches: [],

  setAuthenticated: ({ accessToken, expiresAt, user, activeBusinessId, businesses, mustChangePassword, activeBranchId, branches }) =>
    set((state) => ({
      status: 'authenticated',
      accessToken,
      expiresAt,
      user,
      activeBusinessId,
      businesses,
      membershipsAt: next(),
      mustChangePassword: !!mustChangePassword,
      activeBranchId: activeBranchId ?? null,
      branches: branches ?? [],
      // Keep the loaded profile only if the business did not change.
      business: state.business && state.business.businessId === activeBusinessId ? state.business : null,
    })),
  setBusiness: (business) => {
    // Outlives the session, for the sign-in screen.
    if (business) tokenStorage.setBranding({ name: business.tradingName || business.businessName, logoUrl: business.logoUrl ?? null, backgroundImageUrl: business.backgroundImageUrl ?? null });
    set({ business, businessLoadedAt: next() });
  },
  setUser: (user, businesses, activeBusinessId, mustChangePassword, branches) =>
    set((s) => ({ user, businesses, membershipsAt: next(), activeBusinessId, mustChangePassword: mustChangePassword ?? s.mustChangePassword, branches: branches ?? s.branches })),
  clear: () =>
    set({ status: 'anonymous', accessToken: null, expiresAt: null, user: null, activeBusinessId: null, businesses: [], business: null, mustChangePassword: false, activeBranchId: null, branches: [] }),
}));

export const sessionSelectors = {
  permissions: (s: SessionState) => s.user?.permissions ?? [],
  /** A Super User: platform permissions and no business. */
  isPlatformUser: (s: SessionState) => !s.activeBusinessId && (s.user?.permissions ?? []).some((p) => (PLATFORM_PERMISSIONS as readonly string[]).includes(p)),
};
